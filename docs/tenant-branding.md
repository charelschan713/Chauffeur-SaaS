# Tenant Branding & Widget/Dashboard Standardization

## Goal
- Single SaaS logic for Quote + Customer Portal
- Tenant-specific branding injected at runtime
- Admin controls features + pricing; frontends only render

## Source of Truth
- Backend `/public/tenant-info` returns `branding` (or `theme_json.branding`) + `widget_settings`

## Branding Schema (front-end)
```json
{
  "branding": {
    "logo_url": "https://...",
    "primary_color": "#C8A96B",
    "secondary_color": "#E5C78C",
    "background_color": "#0B0F14",
    "card_color": "#111827",
    "text_color": "#F9FAFB",
    "muted_text_color": "#9CA3AF",
    "border_color": "rgba(255,255,255,0.10)",
    "font_family": "Playfair Display, Inter, system-ui",
    "button_radius": 12,
    "card_radius": 16,
    "input_radius": 12
  },
  "widget_settings": {
    "returnTrip": true,
    "flightNumber": true,
    "babySeats": true,
    "waypoints": true,
    "passengers": true,
    "luggage": true,
    "promoCode": true
  }
}
```

## Frontend Injection
- `TenantProvider` applies CSS variables at runtime
- Quote Widget applies the same theme via `applyTenantTheme` in `Widget.tsx`

## Admin Controls
- Branding: logo, colors, font, radii
- Features: return trip, flight, baby seats, waypoints, passengers, luggage, promo
- Pricing: discount/surge/service types remain backend-only

## Standardization Workflow
1) New tenant provides website source or brand guide
2) Extract palette, typography, and style tokens
3) Populate branding + widget_settings in admin
4) Verify quote widget and customer portal render consistently
