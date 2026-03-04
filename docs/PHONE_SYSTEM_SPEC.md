# Phone System Specification

> **LOCKED STANDARD** — All AI and developers must follow this before touching any phone field.

---

## 1. Storage Format

| Column | Type | Example | Notes |
|--------|------|---------|-------|
| `phone_country_code` | `text` | `+61` | Always starts with `+`, no spaces |
| `phone_number` | `text` | `412345678` | Digits only, no leading 0, no spaces |

**Do NOT store:**
- `+61412345678` (combined E.164 in single column)
- `0412345678` (local format with leading 0)
- `61412345678` (without `+`)

---

## 2. Database Schema

### `public.customers`
```sql
phone_country_code  text   -- "+61"
phone_number        text   -- "412345678"
```

### `public.users` (drivers)
```sql
phone_country_code  text
phone_number        text
```

### `public.bookings`
```sql
customer_phone_country_code   text
customer_phone_number         text
passenger_phone_country_code  text
passenger_phone_number        text
```

### `public.passengers`
```sql
phone_country_code  text
phone_number        text
```

**Legacy columns DROPPED (migration 20260304000002):**
- `bookings.customer_phone`
- `bookings.passenger_phone`
- `users.phone`

---

## 3. E.164 Generation (Backend)

Use the shared helper at `src/common/phone.util.ts`:

```ts
import { toE164, displayPhone } from '../common/phone.util';

// For SMS / Twilio
const e164 = toE164(booking.customer_phone_country_code, booking.customer_phone_number);
// → "+61412345678" or null if either is missing

// For display
const display = displayPhone(customer.phone_country_code, customer.phone_number);
// → "+61 412345678"
```

**All `smsProvider.send()` calls must:**
1. Call `toE164()` first
2. Guard with `if (phone)` before sending (phone may be null)

---

## 4. Frontend Component

Use `PhoneSplitField` from `components/ui/PhoneSplitField.tsx` everywhere:

```tsx
import { PhoneSplitField, formatPhone } from '@/components/ui/PhoneSplitField';

// Input
<PhoneSplitField
  countryCode={form.phone_country_code}
  number={form.phone_number}
  onCountryCodeChange={(v) => setForm(p => ({ ...p, phone_country_code: v }))}
  onNumberChange={(v) => setForm(p => ({ ...p, phone_number: v }))}
  label="Phone"
/>

// Display
{formatPhone(customer.phone_country_code, customer.phone_number)}
// → "+61 412345678" or "—"
```

**Pages using PhoneSplitField:**
- `/customers` ✅
- `/drivers` ✅
- `/bookings/new` ✅
- `/bookings/[id]` (display only via `formatPhone`) ✅

---

## 5. Validation Rules

```
phone_country_code: /^\+\d{1,4}$/   e.g. +61, +1, +852
phone_number:       /^\d{6,15}$/     digits only, 6-15 chars
```

The `PhoneSplitField` component automatically strips non-digits from the number input.

---

## 6. Default Country Code

Default: `+61` (Australia)

Supported codes (in UI dropdown):
`+61` `+1` `+44` `+64` `+65` `+852` `+971` `+86` `+81` `+82` `+91` `+33` `+49`

---

## 7. API Payload Standard

When sending phone to the backend, always send split:

```json
{
  "phone_country_code": "+61",
  "phone_number": "412345678"
}
```

The backend helper `toE164()` combines them before sending to Twilio.

---

## 8. What NOT to Do

❌ `phone: "+61412345678"` — single field  
❌ `phone: "0412345678"` — local format  
❌ Concatenating in DB: `phone_country_code || phone_number`  
❌ Using `users.phone` — column has been dropped  
❌ Using `bookings.customer_phone` — column has been dropped  
