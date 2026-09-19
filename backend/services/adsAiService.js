/**
 * Ads Analyst — on-demand LLM narrative.
 *
 * Called only when a user presses "Generate AI review" (never on page load:
 * that was an explicit product decision — rules render instantly, the LLM is
 * opt-in because it costs money and latency).
 *
 * The model receives a *numeric digest* built by `buildAiDigest`, never raw
 * rows, and must answer in a strict JSON envelope so the UI can render it
 * deterministically. If the provider fails, times out, or returns unusable
 * JSON, the caller falls back to the rules-only view — the analyser never
 * shows an error page just because an LLM was slow.
 */

const { buildAiDigest } = require('./adsInsights');

const DEFAULT_TIMEOUT_MS = Number(process.env.ADS_AI_TIMEOUT_MS) || 45000;

const SYSTEM_PROMPT = `You are a senior Amazon advertising analyst embedded in a retail operations platform (India, INR).
You receive a JSON digest of aggregated advertising data for one period, already compared to the previous period of equal length.

Hard rules:
- Use ONLY the numbers in the digest. Never invent ASINs, brand names, campaign names, benchmarks or currency values.
- Every finding must quote at least one figure from the digest, using ₹ Crore/Lakh formatting (e.g. ₹12.4 L, ₹1.8 Cr) or percentages with 1-2 decimals.
- If a metric is null/absent, say it is unavailable rather than assuming a value.
- Be specific and operational: say what to change (bids, budget, negative targeting, listing, price) and what result to expect.
- No filler, no restating the prompt, no marketing tone. Short sentences.
- Confidence must reflect data quality: missing days, no previous period, no targets => lower confidence.

Return STRICT JSON with exactly this shape:
{
  "headline": "one sentence, <= 120 chars, the single most important read",
  "summary": "2-4 sentences connecting the numbers into a story",
  "findings": [ { "title": "<=60 chars", "detail": "1-2 sentences with figures", "impact": "high|medium|low", "evidence": "the metric(s) quoted" } ],
  "risks": [ { "title": "<=60 chars", "detail": "1 sentence", "severity": "high|medium|low" } ],
  "actions": [ { "action": "imperative, <=80 chars", "rationale": "why, with a figure", "effort": "low|medium|high", "expectedImpact": "what should move" } ],
  "confidence": { "level": "high|medium|low", "reason": "<=120 chars" }
}
Provide 3-6 findings, 2-4 risks, 3-5 actions. Output JSON only.`;

/** Strip markdown fences and pull the first balanced JSON object. */
function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const cleaned = raw.replace(/```json\s*|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }

  const start = cleaned.indexOf('{');
  if (start < 0) return null;
  let depth = 0; let inStr = false; let esc = false;
  for (let i = start; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

const asArray = (value, max = 8) => (Array.isArray(value) ? value.slice(0, max) : []);

/** Normalise whatever the model returned into the shape the UI renders. */
function normaliseNarrative(parsed, meta = {}) {
  if (!parsed || typeof parsed !== 'object') return null;
  const str = (v, max) => (v === null || v === undefined ? '' : String(v).trim().slice(0, max));
  const level = (v, allowed) => (allowed.includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : 'medium');

  const findings = asArray(parsed.findings, 6).map((f) => ({
    title: str(f?.title, 90),
    detail: str(f?.detail, 500),
    impact: level(f?.impact, ['high', 'medium', 'low']),
    evidence: str(f?.evidence, 160),
  })).filter((f) => f.title && f.detail);

  const risks = asArray(parsed.risks, 5).map((r) => ({
    title: str(r?.title, 90),
    detail: str(r?.detail, 400),
    severity: level(r?.severity, ['high', 'medium', 'low']),
  })).filter((r) => r.title && r.detail);

  const actions = asArray(parsed.actions, 6).map((a) => ({
    action: str(a?.action, 160),
    rationale: str(a?.rationale, 400),
    effort: level(a?.effort, ['low', 'medium', 'high']),
    expectedImpact: str(a?.expectedImpact, 160),
  })).filter((a) => a.action);

  const headline = str(parsed.headline, 200);
  const summary = str(parsed.summary, 1200);
  if (!headline && !summary && findings.length === 0) return null;

  return {
    headline,
    summary,
    findings,
    risks,
    actions,
    confidence: {
      level: level(parsed?.confidence?.level, ['high', 'medium', 'low']),
      reason: str(parsed?.confidence?.reason, 200),
    },
    meta,
  };
}

/**
 * Ask the LLM for a narrative over the digest.
 *
 * @param {object} params
 * @param {object} params.overview   payload from adsAnalytics.fetchOverview()
 * @param {Array}  params.insights   deterministic insights (rule findings, quoted as grounding)
 * @param {string} [params.question] optional analyst question to steer the review
 * @param {object} [params.providers] { primary, fallback } chat(messages, options) impls
 * @returns {Promise<{narrative: object|null, provider: string, ms: number, digestKeys: string[]}>}
 */
async function generateNarrative({ overview, insights = [], question = null, providers = null } = {}) {
  const digest = buildAiDigest(overview, insights);
  const userPayload = {
    task: question
      ? `Answer this question using the digest, then still fill every JSON field: ${String(question).slice(0, 400)}`
      : 'Write the advertising performance review for this window.',
    digest,
  };

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(userPayload) },
  ];

  const chain = providers
    ? [['injected', providers.primary ?? providers]].filter(([, fn]) => typeof fn === 'function')
    : [
        ['nvidia', (m, o) => require('./nvidiaAiService').chat(m, o)],
        ['perplexity', (m, o) => require('./AIService').chat(m, o)],
      ];

  let lastError = null;
  for (const [label, chat] of chain) {
    const started = Date.now();
    try {
      const timeout = new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`AI provider '${label}' timed out after ${DEFAULT_TIMEOUT_MS}ms`)), DEFAULT_TIMEOUT_MS);
        if (typeof timer.unref === 'function') timer.unref();
      });
      const text = await Promise.race([
        chat(messages, { json: true, temperature: 0.2, max_tokens: 1600 }),
        timeout,
      ]);
      const parsed = extractJson(text);
      const narrative = normaliseNarrative(parsed, { provider: label, generatedAt: new Date().toISOString() });
      if (narrative) {
        return { narrative, provider: label, ms: Date.now() - started, digestKeys: Object.keys(digest), raw: text };
      }
      lastError = new Error(`AI provider '${label}' returned unusable JSON`);
    } catch (error) {
      lastError = error;
      console.warn(`[adsAiService] ${label} failed:`, error.message);
    }
  }

  return { narrative: null, provider: null, ms: 0, error: lastError ? lastError.message : 'No AI provider available', digest };
}

module.exports = { generateNarrative, normaliseNarrative, extractJson, SYSTEM_PROMPT, DEFAULT_TIMEOUT_MS };
