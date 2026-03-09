# BUGS.md — Active Bug Inventory

---

## BUG-001 — 官网 Widget 无法加载
- **严重性**：P1（生产阻断）
- **状态**：✅ 已修复（2026-03-09）
- **根因**：vercel.json CSP connect-src 未包含 railway.app，浏览器拦截 API 请求
- **修复**：commit `d1a3998` — 加入 `https://*.railway.app`
- **影响文件**：`aschauffeur-elite-docs/vercel.json`

---

## BUG-002 — discount-preview 对 RETURN trip 返回错误折扣基数
- **严重性**：P1（定价错误）
- **状态**：✅ 已修复（2026-03-09）
- **根因**：RETURN trip 的 `base_calculated_minor = undefined`，fallback 到 `estimated_total_minor`（已折后价）再折一次
- **修复**：commit `307d257` — 改用 `pre_discount_fare_minor` 作为 trueBase
- **影响文件**：`src/customer-portal/customer-portal.controller.ts`

---

## BUG-003 — 划线价不含 Waypoint 费用
- **严重性**：P2（定价显示错误）
- **状态**：✅ 已修复（2026-03-09）
- **根因**：官网 widget 用 `pre_discount_total_minor` 字段（不存在），Quote 页同问题
- **修复**：commits `f26c6a3`, `8a20ff5` — 改用 `pre_discount_fare_minor`
- **影响文件**：`BookingWidget.tsx`, `QuoteClient.tsx`

---

## BUG-004 — Price Breakdown 未显示 Discount 行（未登录时）
- **严重性**：P2（用户体验）
- **状态**：✅ 已修复（2026-03-09）
- **根因**：discount 行只在 `loyaltyDiscount != null`（已登录）时显示
- **修复**：commit `6bac514` — fallback 到 snapshot `discount_amount_minor`
- **影响文件**：`apps/customer/app/book/BookPageClient.tsx`

---

## BUG-005 — Admin Breakdown 显示 Stops/Baby Seats 重复（double counting）
- **严重性**：P2（定价显示错误）
- **状态**：✅ 已修复（2026-03-09）
- **根因**：Admin 既用 `pre_discount_fare_minor`（已含 waypoints+seats），又单独显示 Stops/Baby Seats 行
- **修复**：commit `0f8455c` — 移除独立行，顺序改为 fare → discount → toll → total
- **影响文件**：`apps/admin/app/(tenant)/bookings/[id]/page.tsx`

---

## BUG-006 — 官网价格无小数点（显示 $145 而非 $145.00）
- **严重性**：P3（显示）
- **状态**：✅ 已修复（2026-03-09）
- **根因**：`fmtMoney` 的 `minimumFractionDigits: 0`
- **修复**：commit `8a20ff5` — 改为 2
- **影响文件**：`BookingWidget.tsx`

---

## BUG-007 — 手机端 Passengers "+" 按钮被截断
- **严重性**：P2（功能不可用）
- **状态**：✅ 已修复（2026-03-09）
- **根因**：suffix "passengers" 文字太长，overflow-hidden 截掉了 + 按钮
- **修复**：commit `30bcefd` — 改为 "pax"
- **影响文件**：`BookingWidget.tsx`

---

## BUG-008 — APNs p8 文件未下载
- **严重性**：P1（推送通知不可用）
- **状态**：✅ 已修复（2026-03-09）
- **根因**：用户通过 WhatsApp 发送 p8 文件，Key ID = 44UZ9HPMN6
- **修复**：Railway env vars 已设置：APNS_KEY_ID=44UZ9HPMN6, APNS_TEAM_ID=QQ482WQ97D, APNS_BUNDLE_ID=com.aschauffeured.driver, APNS_PRIVATE_KEY=✅

---

## BUG-009 — RETURN Trip 两程未独立计算
- **严重性**：P2（定价逻辑）
- **状态**：🟡 进行中
- **描述**：Return trip 应对 outbound (A→B→C) 和 return (C→B→A) 分别计算距离+价格，当前可能未完全独立
- **影响文件**：`src/pricing/pricing.resolver.ts`, `src/public/public-pricing.service.ts`
