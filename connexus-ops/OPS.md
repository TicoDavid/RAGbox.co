# ConnexUS Ops Ledger

> Single source of truth. All orders, status, decisions.

## Current Deploy

| Key | Value |
|-----|-------|
| Deploy | 54 |
| Commit | 9d49df1 |
| Revision | ragbox-app-00752-mvk |
| Health | 200 |
| Certified | ✅ 5/5 PASS (Dr. Insane) |
| Regression | ✅ 2,609 pass / 0 fail / TSC 0 errors (Sarah) |

## Pending Deploy

| Key | Value |
|-----|-------|
| Deploy | 55 (queued) |
| Commit | 3850fc2 |
| Content | Settings architecture restructure (Jordan) |
| Status | Needs Adam deploy + Dr. Insane cert + Sarah regression |

## Active Orders

### ORD-054A · Adam · Deploy 54 ✅ DONE
Deploy commit 9d49df1, delete stale branch. Ops commit 42dbf6e.

### ORD-054B · Dr. Insane · Certify Deploy 54 ✅ DONE
5/5 PASS. Rain columns are blue (#60a5fa) not green — matches Midnight Cobalt brand. Not a blocker. Cert report: deploy-54-drinsane-cert.md. Commit 4ad06ed.

### ORD-054C · Sarah · Regression Deploy 54 ✅ DONE
117 suites, 2,609 tests, 0 failures, TSC 0 errors.

### ORD-054D · Jordan · Settings Restructure ✅ DONE
Commit 3850fc2. Deleted 3 route pages, consolidated into MercurySettingsModal (6 tabs), created useMercuryEntitlement hook (dormant), MercuryUpgradeCard, NeuralShiftSection. TSC 0, tests 0 fail.

## Decisions Log

| Date | Decision | By |
|------|----------|----|
| 03-07 | Kill Mercury/Integrations/Personas route pages | David |
| 03-07 | Sovereign tier: no Mercury settings access | David |
| 03-07 | API Keys = platform setting (all tiers) | David |
| 03-07 | Beta stays open, gate at GA | David |
| 03-07 | Upgrade CTA = feature preview card | David |

## Completed Deploys

| # | Commit | Date | Key Changes |
|---|--------|------|-------------|
| 53 | c1f91f0 | 03-07 | Ferrari voice, Phase 2 memory, intent detection |
| 54 | 9d49df1 | 03-07 | Resize fix, voice protocol fix, Matrix Rain transparency |
