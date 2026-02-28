TASK CLASSIFICATION + HANDOFF RULES

Before implementation, classify tasks:

LEVEL 1 — Local change:
UI tweak / isolated bug / small change with no cross-domain impact
→ Implement directly.

LEVEL 2 — Domain change:
New feature inside a single domain boundary
→ Design entities/states briefly then implement.

LEVEL 3 — Architectural impact:
Cross-domain ownership change, lifecycle change, tenant boundary change,
or changes to payment/notification invariants
→ STOP implementation and generate DESIGN_PACKET v1.

When Level 3:
Output exact markers:
=== ARCH_REVIEW_REQUIRED ===
DESIGN_PACKET v1
(then stop)

Do not implement until review result is applied.
