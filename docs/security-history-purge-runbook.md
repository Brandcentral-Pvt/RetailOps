# Git History Purge Runbook (BFG Repo-Cleaner)

## Purpose
`backend/config/proxies.json` (25 credentialed proxy tuples) and
`backend/superagent-10.3.0.tgz` remain recoverable in git history. Files are
untracked since PR #26/#28, but history still exposes them until this runbook
is executed.

## ⚠️ Preconditions (all mandatory)
1. **Rotate first.** Rotate all 25 proxy credentials with the provider. After
   rotation, history exposure is inert even before the purge.
2. **Team freeze window.** Every developer must push outstanding work and stop.
   All clones except the migration machine become invalid afterwards.
3. **Deploy pause.** CD deploys `origin/main`; nothing merges during the rewrite.

## Steps (run on Linux/macOS or WSL — BFG is a Java jar)
```bash
# 1) Fresh mirror clone (NOT a normal clone)
git clone --mirror https://github.com/Brandcentral-Pvt/RetailOps.git retail-ops-mirror
cd retail-ops-mirror

# 2) Purge by path (safer than blob-text mode for known files)
java -jar bfg.jar --delete-files proxies.json RetailOps.git   # adjust jar name/path
java -jar bfg.jar --delete-files superagent-10.3.0.tgz RetailOps.git

# 3) Expire reflog + gc (required for objects to actually vanish)
cd RetailOps.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 4) Push rewritten history
git push --force

# 5) Team recovery (each developer)
git clone https://github.com/Brandcentral-Pvt/RetailOps.git   # fresh clone only
```

## Post-flight checklist
- [ ] `git log --all --full-history -- backend/config/proxies.json` returns nothing
- [ ] GitHub: contact support to clear cached/forked views if repo ever forked
- [ ] CI green on next push; tag `vX.Y.Z+purged` optional for audit trail
- [ ] Announce new clone requirement to all developers + CI caches

## Why not done autonomously
Force-push rewrites every commit SHA; any un-fetched clone diverges permanently.
Requires the freeze window above — a coordination decision, not a code change.
