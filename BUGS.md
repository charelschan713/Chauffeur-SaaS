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

## BUG-008 — APNs 推送通知未验证
- **严重性**：P1（推送通知不可用）
- **状态**：🟡 待验证（Ready for Verification）
- **根因**：APNs Key DY4WS2ACK7 下载失败；用户重新创建 Key 44UZ9HPMN6 并通过 WhatsApp 发送 p8 文件
- **已完成**：
  - Railway env vars 已设置：APNS_KEY_ID=44UZ9HPMN6, APNS_TEAM_ID=QQ482WQ97D, APNS_BUNDLE_ID=com.aschauffeured.driver, APNS_PRIVATE_KEY=✅
  - Railway 后端已重启（2026-03-09 07:41:08 UTC），启动无报错
  - `/driver-app/apns-token` 路由已注册
- **待验证**：
  - DB 中所有司机 apns_token = NULL（尚未从真机注册 token）
  - APNs push 是懒加载（push 时才读 env var），启动日志无法确认 p8 解析成功
  - 需要：真机登录 ASDriver → 后端收到 apns_token → Admin 分配 job → 确认推送到达
- **验证步骤**：
  1. 真机安装 TestFlight Build 31，登录 ASDriver
  2. 后端日志确认 `POST /driver-app/apns-token` 收到请求
  3. Admin 创建预订 → 分配司机 → 确认推送到达真机
  4. 通过后改状态为 ✅ Verified Fixed

---

## BUG-009 — RETURN Trip 两程未独立计算
- **严重性**：P2（定价逻辑）
- **状态**：🟡 进行中
- **描述**：Return trip 应对 outbound (A→B→C) 和 return (C→B→A) 分别计算距离+价格，当前可能未完全独立
- **影响文件**：`src/pricing/pricing.resolver.ts`, `src/public/public-pricing.service.ts`

---

## BUG-011 — 支付金额无后端验证
- **严重性**：P1（安全）
- **状态**：✅ 已修复（2026-03-09，commit f36cb9b）
- **根因**：`createBooking`/`guestCheckout` 使用 `dto.totalPriceMinor`；`payViaToken` 使用 `b.total_price_minor`（原始 DTO 值）
- **修复**：
  - quoteId 存在时，价格强制从 server-side quote session 取，忽略客户端传值
  - payViaToken 从 `pricing_snapshot.grand_total_minor` 取信任金额
  - guestBaseFare 改用 `pre_discount_fare_minor`

---

## BUG-012 — Stripe Webhook 幂等性与租户隔离
- **严重性**：P1（安全）
- **状态**：✅ 已修复（2026-03-09，commit f36cb9b）
- **根因**：payment UPDATE 无 tenant_id 范围，无状态前置条件
- **修复**：所有 UPDATE 加 `AND tenant_id = $n` + 状态前置条件，防止跨租户污染和重放攻击

---

## BUG-013 — markBookingPaid 无幂等保护
- **严重性**：P2
- **状态**：✅ 已修复（2026-03-09，commit f36cb9b）
- **根因**：UPDATE 无状态前置条件，可重复触发通知
- **修复**：WHERE payment_status NOT IN ('PAID','REFUNDED','PARTIALLY_REFUNDED')；无更新则跳过通知
