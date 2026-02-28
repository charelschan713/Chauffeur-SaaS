# ADR-010: Repository Strategy

Date: 2026-02-28
Status: ACCEPTED
Decider: Charles (Founder)

## Decision
Maintain existing Chauffeur-SaaS repository. No repo migration during Phase 5.

## Reason
- AI agent continuity preserved
- Railway + CI/CD linkage maintained
- OpenClaw context stable
- Stability > Cleanliness

## Consequences
- All new code added to existing repo
- Legacy code stays (do not delete)
- .openclaw/ becomes AI control layer
