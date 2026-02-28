🏛 Chauffeur Solutions

OpenClaw Engineering Constitution v1.0

⸻

🔒 SECTION 0 — Authority

This document is the highest engineering authority.

OpenClaw MUST:

✅ follow all rules
✅ refuse conflicting instructions
✅ prioritize architecture consistency over speed

If user instruction conflicts:

Constitution > Task Prompt

⸻

1️⃣ PLATFORM IDENTITY

Platform name:

Chauffeur Solutions

System type:

Multi-Tenant SaaS Infrastructure
NOT single-company software
NOT custom project

Platform role:

Operating System for Chauffeur Companies

⸻

Core Principle

Every decision MUST support:

100 → 1000 → 10000 tenants

Never design for one company.

⸻

2️⃣ ARCHITECTURE LAW

System architecture is permanently locked:

Tenant Platform Domain (Control Plane)
        ↓
Booking Domain
Dispatch Domain
Driver Domain
Payment Domain
Notification Domain

⸻

HARD RULES

OpenClaw MUST NEVER:

❌ mix domains
❌ bypass aggregates
❌ access DB directly from UI logic
❌ duplicate business logic

⸻

Domain Ownership

Domain	Owns
Booking	contract truth
Dispatch	execution decision
Driver	execution state
Payment	financial truth
Notification	communication
Tenant Platform	capability

⸻

No domain may control another.

Only events communicate.

⸻

3️⃣ MULTI-TENANCY LAW

System is ALWAYS multi-tenant.

⸻

Tenant Isolation Rules

Every query MUST satisfy:

tenant_id scoped

Never:

WHERE tenant_id = request.body.tenant_id

Tenant comes ONLY from:

JWT active_tenant_id

⸻

RLS IS SOURCE OF SECURITY

OpenClaw MUST NOT implement:
	•	manual tenant filtering
	•	frontend tenant enforcement

Database RLS is authority.

⸻

4️⃣ BACKEND DESIGN LAW (NestJS)

⸻

Controller Rules

Controllers:

✅ validate
✅ authorize
✅ call service

Controllers NEVER:

❌ contain business logic
❌ access repositories directly

⸻

Service Rules

Services:

✅ enforce domain rules
✅ emit domain events

Services NEVER:

❌ send notifications directly
❌ call Stripe directly without Payment Domain

⸻

Event Driven Rule

Allowed:

BookingConfirmed
 → EventBus
 → Notification

Forbidden:

BookingService.sendSMS()

⸻

5️⃣ FRONTEND DESIGN LAW (Admin Portal)

Stack permanently locked:

Next.js 14 App Router
Tailwind CSS
TanStack React Query
React Hook Form
Zod
Axios Client

⸻

UI Philosophy

Admin Portal is:

Operational Console
NOT marketing UI

⸻

Visual Rules

Always:

✅ dense information
✅ predictable layout
✅ minimal animation
✅ status-first design

Avoid:

❌ decorative UI
❌ large hero sections
❌ marketing layouts

⸻

Page Structure Law

Every page follows:

PageHeader
Filters / Actions
Primary Data View
Secondary Panels

⸻

Example:

Header
Table/List
Detail Cards
Timeline
Actions

⸻

6️⃣ DATA FETCHING LAW

⸻

React Query is mandatory

Never use:

useEffect + axios

Always:

useQuery / useMutation

⸻

Query Key Structure

['bookings']
['booking', id]
['drivers']
['dispatch']

Stable keys only.

⸻

Mutation Rule

After mutation:

invalidateQueries()

Never manually sync UI state.

⸻

7️⃣ FORM LAW

All forms MUST use:

React Hook Form
+
Zod validation

⸻

Validation layers:

Zod → API DTO → Domain Rules

Never trust frontend validation.

⸻

8️⃣ DESIGN CONSISTENCY LAW

OpenClaw MUST reuse components.

Before creating component:

SEARCH existing components

If exists → reuse
If similar → extend

Never duplicate UI logic.

⸻

Mandatory reusable components:

PageHeader
Card
StatusBadge
ConfirmModal
Table
FormField
Skeleton
ErrorAlert

⸻

9️⃣ DISPATCH UX LAW

Dispatch Console priority:

Speed > Beauty

Operator must assign driver within:

< 3 seconds

Design accordingly.

⸻

🔟 FINANCIAL SAFETY LAW

Payment rules are sacred.

OpenClaw MUST NEVER:

❌ trust frontend payment result
❌ modify historical payment
❌ calculate money in UI

Money authority:

Payment Domain
Stripe Webhook

⸻

11️⃣ NOTIFICATION LAW

Domains NEVER send messages.

Only:

Event → Notification Domain

Templates use snapshots only.

⸻

12️⃣ AI BEHAVIOR LAW (CRITICAL)

OpenClaw MUST:

✅ extend architecture
✅ follow existing patterns
✅ ask when uncertain

OpenClaw MUST NOT:

❌ redesign system silently
❌ introduce new frameworks
❌ change data model assumptions

⸻

When unsure:

STOP
ASK
WAIT

⸻

13️⃣ IMPLEMENTATION PRIORITY

Always build in order:

Correctness
Consistency
Safety
Performance
Convenience
Beauty

⸻

14️⃣ CODE STYLE PRINCIPLE

Preferred outcome:

Boring
Predictable
Maintainable
Scalable

NOT clever.

⸻

15️⃣ FINAL RULE

OpenClaw is building:

Infrastructure
NOT features

Every commit must survive:

10 engineers
5 years
1000 tenants

⸻

✅ HOW TO USE

Put this file as:

.openclaw/system/engineering-constitution.md

Then register as bootstrap:

openclaw agent update main \
  --bootstrap .openclaw/system/engineering-constitution.md

⸻

⭐ Result

After this:

✅ OpenClaw stops random redesign
✅ UI style stabilizes
✅ Architecture drift disappears
✅ Claude review becomes fast
✅ GPT / Claude / OpenClaw share same mental model

⸻
