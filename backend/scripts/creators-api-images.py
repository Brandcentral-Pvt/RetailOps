#!/usr/bin/env python3
"""
Fetch product image links for ASINs from the Amazon Creators API.

Why Creators API and not PA-API 5?
----------------------------------
PA-API 5.0 is DEPRECATED. Amazon now returns HTTP 403 AccessDeniedException
to every caller with the message "Product Advertising API is deprecated.
Please migrate to Creators API". Any tutorial you find for PA-API 5
(searchv1 / webservices.amazon.com/paapi5) is dead code.

Creators API is the supported successor. Endpoints mirror the shape
implemented by the vendored JS SDK in backend/lib/creatorsapi-sdk.

Requirements
------------
- Python 3.8+ (standard library only, no pip install needed)
- Creators API credentials: client id, client secret, partner tag
- Your app's API version (see VERSION_TO_TOKEN_ENDPOINT below)

Usage
-----
    # single ASIN
    python creators_api_images.py B0CX23V2ZK

    # several
    python creators_api_images.py B0CX23V2ZK B0CX23V2ZL B0CX23V2ZM

    # from a file, one ASIN per line (# comments allowed)
    python creators_api_images.py --file asins.txt --out images.csv

Credentials are read from the environment. If they are not set, the
script falls back to loading the nearest .env file (searched upward
from the current directory), then to the LIVE_SYNC_* names this repo
already uses. So usually you can just run it with no setup:

    python creators-api-images.py --file asins.txt --out images.csv

Recognised variables, in priority order:
    CREATORS_API_CLIENT_ID      or LIVE_SYNC_CLIENT_ID
    CREATORS_API_CLIENT_SECRET  or LIVE_SYNC_CLIENT_SECRET
    CREATORS_API_PARTNER_TAG    or LIVE_SYNC_PARTNER_TAG
    CREATORS_API_VERSION        or LIVE_SYNC_CLIENT_VERSION (default 3.1)
    CREATORS_API_MARKETPLACE    or LIVE_SYNC_MARKETPLACE  (default www.amazon.in)

Downloading images
------------------
Add --download to also save the images to disk, one folder per ASIN:

    python creators-api-images.py --file asins.txt --out images.csv --download

creates:

    images_by_asin/
      B0BVHXR3F3/
        primary.jpg
        variant_01.jpg
        variant_02.jpg
      B0BNXFTR55/
        primary.jpg
        ...

Re-running skips files already on disk, so a long run that is cut off
by the daily API quota can simply be repeated to continue.
"""

import argparse
import concurrent.futures
import csv
import datetime
import json
import mimetypes
import os
import re
import sys
import time
import urllib.error
import urllib.request

API_BASE = "https://creatorsapi.amazon"
GET_ITEMS_PATH = "/catalog/v1/getItems"

# Mirrors OAuth2Config.determineTokenEndpoint() in the vendored SDK.
# v2.x -> Cognito (scope "creatorsapi/default")
# v3.x -> LWA      (scope "creatorsapi::default")
VERSION_TO_TOKEN_ENDPOINT = {
    "2.1": "https://creatorsapi.auth.us-east-1.amazoncognito.com/oauth2/token",
    "2.2": "https://creatorsapi.auth.eu-south-2.amazoncognito.com/oauth2/token",
    "2.3": "https://creatorsapi.auth.us-west-2.amazoncognito.com/oauth2/token",
    "3.1": "https://api.amazon.com/auth/o2/token",
    "3.2": "https://api.amazon.co.uk/auth/o2/token",
    "3.3": "https://api.amazon.co.jp/auth/o2/token",
}

# Asking for every size wastes quota. Trim to what you actually need.
ALL_IMAGE_RESOURCES = [
    "images.primary.small",
    "images.primary.medium",
    "images.primary.large",
    "images.primary.hiRes",
    "images.variants.small",
    "images.variants.medium",
    "images.variants.large",
    "images.variants.hiRes",
]

# getItems accepts multiple itemIds per call. 10 is the safe documented cap.
BATCH_SIZE = 10

# The account is throttled to roughly 1 request/second, shared across
# all credentials on the account.
MIN_SECONDS_BETWEEN_CALLS = 1.0

# Daily transaction budget. Mirrors backend/services/creatorsApiRateGate.js:
# a 8640/day limit with a 40-request safety buffer, counted per UTC day and
# persisted so a restart (or a crash) can never re-spend the same day's budget.
DEFAULT_TPD_LIMIT = 8640
DEFAULT_TPD_BUFFER = 40
DEFAULT_QUOTA_FILE = ".creators_api_quota.json"

# If a 429 says the day is finished, do not keep retrying - that wastes the
# whole run's wall clock for nothing.
QUOTA_EXHAUSTED_HINTS = ("tpd", "quota", "throttl", "rate limit exceeded")

# Amazon's image CDN embeds the rendered size in the filename, e.g.
#   .../418mafCtedL._SL500_.jpg   (500px)
# The SAME path serves other sizes just by swapping the token, which means
# we can fetch a larger render than the one the API handed us.
CDN_SIZE_TOKEN = re.compile(r"\._SL\d+_\.")
CDN_SIZES = {
    "small": "_SL160_",
    "medium": "_SL500_",
    "large": "_SL1000_",
    "xlarge": "_SL1500_",
    "hires": "_SL2000_",
}

# Be polite to the CDN. These are static image requests, not API calls,
# so they are not bound by the 1 req/s API limit.
IMAGE_MIN_INTERVAL = 0.05
IMAGE_WORKERS = 6


class CreatorsApiError(RuntimeError):
    pass


class QuotaExhausted(RuntimeError):
    """Raised when the account's daily budget is gone. Stop, do not retry."""


def _utc_today():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")


class QuotaLedger:
    """Durable per-UTC-day request ledger.

    Keeps a JSON file of how many API requests this script has spent today.
    Because the limit is checked BEFORE spending, a run that is stopped and
    restarted on the same day continues from where it left off rather than
    blowing through the budget again.

    IMPORTANT: this only tracks what THIS SCRIPT spends. The daily budget
    belongs to the whole account and is shared with the backend server, so
    use --tpd-limit to reserve headroom for the app.
    """

    def __init__(self, path, tpd_limit=DEFAULT_TPD_LIMIT, buffer=DEFAULT_TPD_BUFFER):
        self.path = path
        self.limit = max(1, tpd_limit - buffer)
        self._used_today = 0
        self._day = _utc_today()
        self._load()

    def _load(self):
        try:
            with open(self.path, "r", encoding="utf-8") as handle:
                state = json.load(handle)
        except (OSError, ValueError):
            return
        # A new UTC day resets the budget.
        if state.get("day") == _utc_today():
            self._used_today = int(state.get("used", 0) or 0)

    def _save(self):
        payload = {"day": _utc_today(), "used": self._used_today, "limit": self.limit}
        try:
            with open(self.path, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, indent=2)
        except OSError:
            pass  # Never fail a run because the ledger could not be written.

    @property
    def used(self):
        return self._used_today

    def remaining(self):
        return max(0, self.limit - self._used_today)

    def can_spend(self, count=1):
        return self._used_today + count <= self.limit

    def spend(self, count=1):
        """Record a request. Returns False if that would breach the budget."""
        if not self.can_spend(count):
            return False
        self._used_today += count
        self._save()
        return True

    def describe(self):
        return "%d/%d used today, %d remaining" % (self._used_today, self.limit, self.remaining())


def load_dotenv(start_dir=None, max_up=6):
    """Load the nearest .env upward from start_dir without overriding real env vars.

    Minimal stdlib stand-in for python-dotenv. Handles KEY=VALUE, # comments,
    optional `export ` prefix and single/double quoted values.
    """
    current = os.path.abspath(start_dir or os.getcwd())
    for _ in range(max_up):
        candidate = os.path.join(current, ".env")
        if os.path.isfile(candidate):
            try:
                with open(candidate, "r", encoding="utf-8-sig") as handle:
                    for raw in handle:
                        line = raw.strip()
                        if not line or line.startswith("#"):
                            continue
                        if line.startswith("export "):
                            line = line[len("export "):].strip()
                        if "=" not in line:
                            continue
                        key, _, value = line.partition("=")
                        key = key.strip()
                        value = value.strip()
                        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                            value = value[1:-1]
                        # Real env vars always win over the file.
                        if key and key not in os.environ and value:
                            os.environ[key] = value
                return candidate
            except OSError:
                return None
        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent
    return None


def resolve(name, fallback_name, default=None):
    """Read a setting, preferring the CREATORS_API_* name over LIVE_SYNC_*."""
    value = os.environ.get(name)
    if value:
        return value
    if fallback_name:
        value = os.environ.get(fallback_name)
        if value:
            return value
    return default


class CreatorsClient:
    """Minimal Creators API client: OAuth2 token + getItems."""

    def __init__(self, client_id, client_secret, partner_tag, version, marketplace, ledger=None):
        if version not in VERSION_TO_TOKEN_ENDPOINT:
            raise CreatorsApiError(
                "Unsupported CREATORS_API_VERSION %r. Supported: %s"
                % (version, ", ".join(sorted(VERSION_TO_TOKEN_ENDPOINT)))
            )
        self.client_id = client_id
        self.client_secret = client_secret
        self.partner_tag = partner_tag
        self.version = version
        self.marketplace = marketplace
        self.ledger = ledger
        self.scope = "creatorsapi::default" if version.startswith("3.") else "creatorsapi/default"
        self.token_url = VERSION_TO_TOKEN_ENDPOINT[version]
        self._access_token = None
        self._token_expires_at = 0.0
        self._last_call_at = 0.0
        # Seconds to wait between API calls. Starts at 1.0 (1 req/s) and can
        # only ever get SLOWER, never faster, if the server asks for less.
        self.min_interval = MIN_SECONDS_BETWEEN_CALLS

    # ---------- auth ----------

    def _fetch_token(self):
        payload = json.dumps(
            {
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": self.scope,
            }
        ).encode("utf-8")

        req = urllib.request.Request(
            self.token_url,
            data=payload,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))

        token = body.get("access_token")
        if not token:
            raise CreatorsApiError("Token response had no access_token: %s" % body)

        # Refresh 60s early so a token never expires mid-request.
        expires_in = int(body.get("expires_in", 3600))
        self._access_token = token
        self._token_expires_at = time.time() + max(expires_in - 60, 30)
        return token

    def token(self):
        if not self._access_token or time.time() >= self._token_expires_at:
            return self._fetch_token()
        return self._access_token

    # ---------- rate limiting ----------

    def _throttle(self):
        wait = self._last_call_at + self.min_interval - time.time()
        if wait > 0:
            time.sleep(wait)
        self._last_call_at = time.time()

    def reserve(self, count=1):
        """Check the daily budget before spending a request.

        Raises QuotaExhausted so the caller can stop cleanly and save
        partial results instead of hammering the API into a hard 429.
        """
        if self.ledger is None:
            return
        if not self.ledger.can_spend(count):
            raise QuotaExhausted(
                "Daily API budget reached (%s). Stopping before it can be "
                "wasted. Run again after the UTC day rolls over, or raise "
                "--tpd-limit if you know the account has headroom."
                % self.ledger.describe())

    def _apply_rate_headers(self, headers):
        """Tighten (never loosen) our pacing from what the server reports."""
        try:
            pairs = dict(headers.items())
        except AttributeError:
            return
        for key, value in pairs.items():
            lowered = key.lower()
            if lowered == "x-amzn-ratelimit-limit":
                try:
                    server_tps = float(value)
                except (TypeError, ValueError):
                    continue
                if 0 < server_tps < (1.0 / self.min_interval):
                    self.min_interval = 1.0 / server_tps + 0.1
                    print("  [server requests %.2f req/s; pacing slowed to %.2fs]"
                          % (server_tps, self.min_interval), file=sys.stderr)
            elif lowered in ("x-amzn-tpd-remaining", "x-amzn-ratelimit-remaining-tpd"):
                try:
                    remaining = int(value)
                except (TypeError, ValueError):
                    continue
                print("  [%s: %s]" % (lowered, remaining), file=sys.stderr)
                if remaining <= 0 and self.ledger is not None:
                    self.ledger._used_today = self.ledger.limit
            elif lowered == "retry-after":
                try:
                    print("  [retry-after: %ss]" % value, file=sys.stderr)
                except Exception:  # noqa: BLE001
                    pass

    # ---------- api ----------

    def get_items(self, asins, resources):
        # Never spend a request we have not budgeted for.
        self.reserve(1)
        self._throttle()

        body = {
            "partnerTag": self.partner_tag,
            "itemIds": list(asins),
            "itemIdType": "ASIN",
            "marketplace": self.marketplace,
            "resources": list(resources),
        }
        req = urllib.request.Request(
            API_BASE + GET_ITEMS_PATH,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "x-marketplace": self.marketplace,
                "Authorization": "Bearer " + self.token(),
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                # Only count it against the budget once the server accepted it.
                if self.ledger is not None:
                    self.ledger.spend(1)
                self._apply_rate_headers(resp.headers)
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")
            lowered = detail.lower()
            if exc.code == 403:
                raise CreatorsApiError(
                    "403 Forbidden. If the message mentions PA-API deprecation you are "
                    "hitting the retired Product Advertising API endpoint.\n%s" % detail
                )
            if exc.code == 429:
                # A 429 still cost us nothing we can reuse, so do not record it.
                if any(hint in lowered for hint in QUOTA_EXHAUSTED_HINTS):
                    raise QuotaExhausted(
                        "HTTP 429 - daily API budget exhausted.\n%s\n"
                        "%s\nStop and resume tomorrow; retrying will not help."
                        % (detail.strip()[:400],
                           ("Script ledger: %s" % self.ledger.describe())
                           if self.ledger is not None else ""))
                # A short-window throttle: slow down, it is worth retrying.
                self.min_interval = min(self.min_interval * 2, 60.0)
                raise CreatorsApiError(
                    "429 throttled; pacing slowed to %.2fs between calls.\n%s"
                    % (self.min_interval, detail.strip()[:400]))
            raise CreatorsApiError("HTTP %s\n%s" % (exc.code, detail))
        except urllib.error.URLError as exc:
            raise CreatorsApiError("Network error: %s" % exc)

    def _log_quota(self, headers):
        """Deprecated: header handling now lives in _apply_rate_headers."""
        return


def _pick(size_node):
    """Return the url from an ImageSize node, tolerating shape differences."""
    if not size_node:
        return None
    if isinstance(size_node, str):
        return size_node
    if isinstance(size_node, dict):
        return size_node.get("url")
    return None


def upscale_cdn_url(url, size):
    """Rewrite an image URL to request a larger render from the same CDN path.

    No extra API quota is consumed: this is the identical object rendered
    at a different size.
    """
    if not url or size not in CDN_SIZES:
        return url
    return CDN_SIZE_TOKEN.sub("." + CDN_SIZES[size] + ".", url)


def _extension_for(url, content_type=None):
    """Pick a file extension, preferring the URL and falling back to MIME type."""
    match = re.search(r"\.(jpe?g|png|gif|webp)(?:$|\?)", url or "", re.IGNORECASE)
    if match:
        ext = match.group(1).lower()
        return "jpg" if ext == "jpeg" else ext
    if content_type:
        guessed = mimetypes.guess_extension(content_type.split(";", 1)[0].strip())
        if guessed:
            return guessed.lstrip(".")
    return "jpg"


def download_image(url, destination, overwrite=False, retries=3):
    """Download one image to `destination`. Returns (ok, message).

    Skips silently when the file already exists, which is what makes
    re-running the script a cheap way to resume after a quota stop.
    """
    if not url:
        return False, "no url"
    if os.path.exists(destination) and not overwrite:
        return True, "skipped"

    os.makedirs(os.path.dirname(destination), exist_ok=True)

    for attempt in range(1, retries + 1):
        try:
            request = urllib.request.Request(
                url, headers={"User-Agent": "Mozilla/5.0 (compatible; RetailOpsImageFetch/1.0)"})
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = response.read()
                content_type = response.headers.get("Content-Type")

            if not payload:
                raise OSError("empty response body")
            if len(payload) < 128:
                raise OSError("suspiciously small response (%d bytes)" % len(payload))

            final_path = "%s.%s" % (
                os.path.splitext(destination)[0],
                _extension_for(url, content_type))
            # Write to a .part file then move, so an interrupted run never
            # leaves a truncated image that a later run would treat as done.
            partial = final_path + ".part"
            with open(partial, "wb") as handle:
                handle.write(payload)
            os.replace(partial, final_path)
            return True, "%d bytes" % len(payload)

        except Exception as exc:  # noqa: BLE001 - report, never abort the whole run
            if attempt == retries:
                return False, str(exc)
            time.sleep(2 ** attempt)


def sanitize_asin(value):
    """Make an ASIN safe to use as a directory name."""
    cleaned = re.sub(r"[^A-Za-z0-9_-]", "_", (value or "").strip())
    return cleaned or "unknown_asin"


def download_rows(rows, images_dir, max_size=None, overwrite=False, workers=IMAGE_WORKERS):
    """Download every image in `rows`, grouped into one folder per ASIN."""
    total_files = 0
    failures = []

    # Build a flat work list so downloads can run concurrently.
    jobs = []
    for row in rows:
        asin_folder = os.path.join(images_dir, sanitize_asin(row.get("asin")))
        primary = row.get("primary_image")
        if primary:
            if max_size:
                primary = upscale_cdn_url(primary, max_size)
            jobs.append((asin_folder, "primary", primary))
        variants = [v for v in (row.get("variant_images") or "").split(" | ") if v]
        for index, variant in enumerate(variants, start=1):
            if max_size:
                variant = upscale_cdn_url(variant, max_size)
            jobs.append((asin_folder, "variant_%02d" % index, variant))

    if not jobs:
        print("No image urls to download.", file=sys.stderr)
        return 0, failures

    print("Downloading %d image(s) into %s ..." % (len(jobs), images_dir), file=sys.stderr)

    throttle_lock = __import__("threading").Lock()
    last_hit = [0.0]

    def run(job):
        asin_folder, stem, url = job
        with throttle_lock:
            wait = last_hit[0] + IMAGE_MIN_INTERVAL - time.time()
            if wait > 0:
                time.sleep(wait)
            last_hit[0] = time.time()
        extension = _extension_for(url)
        destination = os.path.join(asin_folder, "%s.%s" % (stem, extension))
        ok, message = download_image(url, destination, overwrite=overwrite)
        return ok, destination, message

    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        for ok, destination, message in pool.map(run, jobs):
            done += 1
            if ok:
                total_files += 1
            else:
                failures.append((destination, message))
            if done % 25 == 0 or done == len(jobs):
                print("  %d/%d files (%d failed)"
                      % (done, len(jobs), len(failures)), file=sys.stderr)

    return total_files, failures


def extract_images(item):
    """Flatten one item into primary_url + ordered variant urls."""
    images = item.get("images") or {}
    primary = images.get("primary") or {}

    # Prefer the largest available so you can downscale yourself.
    primary_url = None
    for size in ("hiRes", "large", "medium", "small"):
        primary_url = _pick(primary.get(size))
        if primary_url:
            break

    variants = []
    for variant in images.get("variants") or []:
        for size in ("hiRes", "large", "medium", "small"):
            url = _pick(variant.get(size))
            if url:
                variants.append(url)
                break

    return primary_url, variants


def fetch_all(client, asins, resources, retries=3, max_requests=None):
    """Fetch images for every ASIN, batching and retrying.

    Stops cleanly (without losing work) when the daily API budget runs out.
    Returns (rows, completed).
    """
    rows = []
    batches = [asins[i:i + BATCH_SIZE] for i in range(0, len(asins), BATCH_SIZE)]
    print("Fetching %d ASIN(s) in %d batch(es) at %d ASIN/request..."
          % (len(asins), len(batches), BATCH_SIZE), file=sys.stderr)
    if client.ledger is not None:
        print("Daily budget: %s" % client.ledger.describe(), file=sys.stderr)

    stopped_early = False
    spent = 0

    for index, batch in enumerate(batches, start=1):
        if max_requests is not None and spent >= max_requests:
            print("\nStopped: reached --max-requests %d." % max_requests, file=sys.stderr)
            stopped_early = True
            break

        print("  batch %d/%d: %s" % (index, len(batches), ", ".join(batch)), file=sys.stderr)

        data = None
        for attempt in range(1, retries + 1):
            try:
                data = client.get_items(batch, resources)
                spent += 1
                break
            except QuotaExhausted as exc:
                # No point retrying a spent day. Keep everything fetched so far.
                print("\n%s" % exc, file=sys.stderr)
                stopped_early = True
                break
            except CreatorsApiError as exc:
                first_line = str(exc).splitlines()[0]
                if attempt == retries:
                    print("  ! batch failed after %d attempts: %s" % (retries, exc),
                          file=sys.stderr)
                    break
                backoff = 2 ** attempt
                print("  . attempt %d failed (%s); retrying in %ss"
                      % (attempt, first_line, backoff), file=sys.stderr)
                time.sleep(backoff)
                spent += 0  # failed attempts are not billed, but do re-pace

        if stopped_early:
            # Mark the ASINs we never got to, so the CSV is complete and honest.
            for pending in batches[index - 1:]:
                for asin in pending:
                    rows.append({"asin": asin, "primary_image": "", "variant_count": 0,
                                 "variant_images": "", "status": "skipped_quota"})
            break

        if not data:
            for asin in batch:
                rows.append({"asin": asin, "primary_image": "", "variant_count": 0,
                             "variant_images": "", "status": "error"})
            continue

        items = (data.get("itemsResult") or {}).get("items") or []
        by_asin = {item.get("asin"): item for item in items}

        for asin in batch:
            item = by_asin.get(asin)
            if not item:
                # Normal: the catalog cannot serve this ASIN. Not an error.
                rows.append({"asin": asin, "primary_image": "", "variant_count": 0,
                             "variant_images": "", "status": "not_found"})
                continue
            primary_url, variants = extract_images(item)
            rows.append({
                "asin": asin,
                "primary_image": primary_url or "",
                "variant_count": len(variants),
                "variant_images": " | ".join(variants),
                "status": "ok" if primary_url else "no_images",
            })

    return rows, stopped_early


def main():
    parser = argparse.ArgumentParser(
        description="Fetch product image links for ASINs from the Amazon Creators API.")
    parser.add_argument("asins", nargs="*", help="ASINs to look up")
    parser.add_argument("--file", help="file with one ASIN per line")
    parser.add_argument("--out", help="write results to this CSV (default: stdout)")
    parser.add_argument("--all-sizes", action="store_true",
                        help="request every image size instead of primary+variants only")
    parser.add_argument("--no-variants", action="store_true",
                        help="skip variant images, primary only (less quota)")
    parser.add_argument("--download", action="store_true",
                        help="also save the images to disk, one folder per ASIN")
    parser.add_argument("--images-dir", default="images_by_asin",
                        help="root folder for downloads (default: images_by_asin)")
    parser.add_argument("--max-size", choices=sorted(CDN_SIZES), default=None,
                        help="re-request each image at this size from the same CDN path "
                             "(costs no extra API quota)")
    parser.add_argument("--overwrite", action="store_true",
                        help="re-download files that already exist")
    parser.add_argument("--workers", type=int, default=IMAGE_WORKERS,
                        help="parallel image downloads (default: %d)" % IMAGE_WORKERS)
    parser.add_argument("--tpd-limit", type=int,
                        default=int(os.environ.get("CREATORS_RATE_TPD", DEFAULT_TPD_LIMIT)),
                        help="account's real daily request limit (default: %d)"
                             % DEFAULT_TPD_LIMIT)
    parser.add_argument("--tpd-buffer", type=int,
                        default=int(os.environ.get("CREATORS_RATE_TPD_BUFFER", DEFAULT_TPD_BUFFER)),
                        help="requests held back as safety margin (default: %d)"
                             % DEFAULT_TPD_BUFFER)
    parser.add_argument("--quota-file", default=DEFAULT_QUOTA_FILE,
                        help="where the daily ledger is kept (default: %s)" % DEFAULT_QUOTA_FILE)
    parser.add_argument("--max-requests", type=int, default=None,
                        help="stop after this many API calls in this run")
    parser.add_argument("--reset-quota", action="store_true",
                        help="clear the ledger and start counting from zero")
    args = parser.parse_args()

    asins = list(args.asins)
    if args.file:
        # utf-8-sig strips a BOM if the file was written by Excel/Notepad/PowerShell,
        # otherwise the first ASIN becomes '\\ufeffB0...' and fails ASIN validation.
        with open(args.file, "r", encoding="utf-8-sig") as handle:
            for line in handle:
                line = line.split("#", 1)[0].strip().lstrip("\ufeff")
                if line:
                    asins.append(line)

    # De-duplicate while preserving order.
    seen = set()
    asins = [a for a in asins if not (a in seen or seen.add(a))]

    if not asins:
        parser.error("no ASINs given (pass them as arguments or use --file)")

    env_path = load_dotenv()
    if env_path:
        print("Loaded settings from %s" % env_path, file=sys.stderr)

    client_id = resolve("CREATORS_API_CLIENT_ID", "LIVE_SYNC_CLIENT_ID")
    client_secret = resolve("CREATORS_API_CLIENT_SECRET", "LIVE_SYNC_CLIENT_SECRET")
    partner_tag = resolve("CREATORS_API_PARTNER_TAG", "LIVE_SYNC_PARTNER_TAG")
    if not (client_id and client_secret and partner_tag):
        parser.error(
            "missing credentials. Set CREATORS_API_CLIENT_ID, CREATORS_API_CLIENT_SECRET "
            "and CREATORS_API_PARTNER_TAG (or LIVE_SYNC_CLIENT_ID / LIVE_SYNC_CLIENT_SECRET "
            "/ LIVE_SYNC_PARTNER_TAG), or run from inside the repo so the .env is found."
        )

    ledger = QuotaLedger(args.quota_file, tpd_limit=args.tpd_limit, buffer=args.tpd_buffer)
    if args.reset_quota:
        try:
            os.remove(args.quota_file)
        except OSError:
            pass
        ledger = QuotaLedger(args.quota_file, tpd_limit=args.tpd_limit, buffer=args.tpd_buffer)
        print("Quota ledger reset.", file=sys.stderr)

    client = CreatorsClient(
        client_id=client_id,
        client_secret=client_secret,
        partner_tag=partner_tag,
        version=resolve("CREATORS_API_VERSION", "LIVE_SYNC_CLIENT_VERSION", "3.1"),
        marketplace=resolve("CREATORS_API_MARKETPLACE", "LIVE_SYNC_MARKETPLACE", "www.amazon.in"),
        ledger=ledger,
    )

    resources = []
    if args.all_sizes:
        resources = list(ALL_IMAGE_RESOURCES)
    else:
        resources = ["images.primary.large", "images.primary.medium"]
        if not args.no_variants:
            resources += ["images.variants.large", "images.variants.medium"]

    rows, stopped_early = fetch_all(client, asins, resources, max_requests=args.max_requests)

    if args.out:
        with open(args.out, "w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(
                handle, fieldnames=["asin", "primary_image", "variant_count", "variant_images", "status"])
            writer.writeheader()
            writer.writerows(rows)
        ok = sum(1 for r in rows if r["status"] == "ok")
        print("\nWrote %d row(s) to %s (%d with images)" % (len(rows), args.out, ok), file=sys.stderr)
    else:
        writer = csv.DictWriter(
            sys.stdout, fieldnames=["asin", "primary_image", "variant_count", "variant_images", "status"])
        writer.writeheader()
        writer.writerows(rows)

    print("Daily budget after run: %s" % ledger.describe(), file=sys.stderr)
    if stopped_early:
        print(
            "\nRun stopped early on quota. Everything fetched so far is saved.\n"
            "Resume later with the same command: the ledger remembers today's spend "
            "and already-downloaded files are skipped.",
            file=sys.stderr)

    if args.download:
        saved, failures = download_rows(
            rows,
            images_dir=args.images_dir,
            max_size=args.max_size,
            overwrite=args.overwrite,
            workers=args.workers,
        )
        folders = len({sanitize_asin(r.get("asin")) for r in rows if r.get("asin")})
        print("\nDownloaded %d image(s) across %d ASIN folder(s) in %s"
              % (saved, folders, args.images_dir), file=sys.stderr)
        if failures:
            print("%d download(s) failed; first 10:" % len(failures), file=sys.stderr)
            for path, message in failures[:10]:
                print("  %s -> %s" % (path, message), file=sys.stderr)

    # Signal a partial run to any wrapper: 2 means "stopped on quota, resume
    # later", 0 means everything was attempted, 1 is reserved for real errors.
    if stopped_early:
        return 2
    if any(r.get("status") == "error" for r in rows):
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except QuotaExhausted as error:
        print("Quota exhausted: %s" % error, file=sys.stderr)
        sys.exit(2)
    except CreatorsApiError as error:
        print("Error: %s" % error, file=sys.stderr)
        sys.exit(1)
