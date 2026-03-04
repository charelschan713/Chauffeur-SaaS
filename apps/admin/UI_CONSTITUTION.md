# UI Constitution — Chauffeur SaaS Admin Portal

> This file is the single source of truth for all UI/UX decisions.
> Any AI or developer modifying UI **must** read and follow this before making changes.

---

## 1. Design System

- **Framework:** Next.js 14 (App Router) + Tailwind CSS + TypeScript
- **Style reference:** Linear / Vercel dashboard aesthetic — dark, dense, functional
- **No external UI libraries** (no shadcn, no MUI, no Chakra) unless already present
- **All components live in:** `apps/admin/components/ui/`

---

## 2. Component Rules

### ✅ Always reuse existing components:

| Component | Path | Usage |
|-----------|------|-------|
| `PageHeader` | `components/admin/PageHeader.tsx` | Every tenant page top |
| `Card` | `components/ui/Card.tsx` | Content containers |
| `Badge` | `components/ui/Badge.tsx` | Status indicators |
| `Button` | `components/ui/Button.tsx` | All actions |
| `ErrorAlert` | `components/ui/ErrorAlert.tsx` | Error states (supports `onRetry`) |
| `LoadingSpinner` | `components/ui/LoadingSpinner.tsx` | Loading states |
| `ConfirmModal` | `components/ui/ConfirmModal.tsx` | Destructive action confirmation |

### ❌ Never:
- Import from `@radix-ui`, `shadcn`, or other UI libraries not already in the project
- Create one-off inline styles for layout — use Tailwind utilities
- Duplicate component logic — extend existing components instead
- Add new design tokens without documenting here

---

## 3. Layout Rules

### Page structure (tenant routes):
```tsx
<div className="space-y-6">
  <PageHeader title="..." description="..." actions={<Button>...</Button>} />
  <Card>...</Card>
</div>
```

### Grid layouts:
- KPI row: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
- Two-col detail: `grid grid-cols-1 lg:grid-cols-3 gap-6`
- Full-width table: `w-full overflow-x-auto`

---

## 4. Color / Status Conventions

### Badge variants:
| Status | Variant |
|--------|---------|
| Active / Ready / Completed | `success` |
| Pending / In Progress | `warning` |
| Cancelled / Error / Declined | `destructive` |
| Draft / Neutral | `neutral` |
| Info | `info` |

### Booking operational_status:
| Value | Badge |
|-------|-------|
| `CONFIRMED` | `success` |
| `PENDING` | `warning` |
| `IN_PROGRESS` | `info` |
| `COMPLETED` | `success` |
| `CANCELLED` | `destructive` |

### Payment status:
| Value | Badge |
|-------|-------|
| `PAID` | `success` |
| `PENDING` | `warning` |
| `FAILED` | `destructive` |
| `REFUNDED` | `neutral` |

### Assignment status:
Valid values: `PENDING` `ACCEPTED` `DECLINED` `CANCELLED` `COMPLETED` `OFFERED` `EXPIRED` `JOB_STARTED` `JOB_COMPLETED`

---

## 5. Table Standards

```tsx
<div className="overflow-x-auto">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
        <th className="pb-2 pr-4 font-medium">Column</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-neutral-100">
      <tr className="hover:bg-neutral-50">
        <td className="py-3 pr-4">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

- Always wrap tables in `overflow-x-auto`
- Use `text-sm` for body rows
- Empty state: show a centered message, not an empty table

---

## 6. Form Standards

- Use `label` + `input` pairs with consistent spacing
- Input classes: `w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`
- Error state: red border + `ErrorAlert` below form
- Submit button: right-aligned, `Button variant="primary"`

---

## 7. Modal Standards

- Use `ConfirmModal` for destructive actions (delete, cancel)
- Custom modals: fixed overlay `bg-black/50`, centered panel `max-w-lg w-full`
- Always include a close/cancel path
- Never open modals on page load

---

## 8. Navigation

- **AdminTopbar:** persistent top bar with tenant context
- **Sidebar:** left nav for main sections
- **Active route:** highlighted in sidebar
- **Breadcrumb:** PageHeader `description` field used for context — do not add separate breadcrumb component unless requested

---

## 9. Build Rules

- All UI changes **must pass** `npm run build` before commit
- No TypeScript errors — `strict` mode is on
- No unused imports
- Test build locally: `cd apps/admin && npm run build`

---

## 10. Current Route Structure (tenant)

```
app/(tenant)/
  dashboard/
  bookings/
    page.tsx          — list with filters
    new/page.tsx      — booking wizard
    [id]/page.tsx     — booking detail + assignment
  customers/
  drivers/
  vehicles/
  dispatch/
  pricing/
    car-types/
    service-types/
```

---

## UI Roadmap (P2/P3 remaining)

- [ ] Booking Detail ↔ Dispatch integration
- [ ] Accessibility fixes (focus traps, aria labels)
- [ ] Table mobile layout optimization
- [ ] Breadcrumb UX improvements
