# DECISIONS.md — Major Design Decisions

---

## D001 — Toll/Parking 不打折
- **日期**：2026-03-09
- **决定**：Toll 和 Parking 费用永远不参与折扣计算，在折后 fare 基础上叠加
- **原因**：Toll/parking 是透传成本，不属于服务定价的一部分
- **公式**：`grand_total = (fare × (1 - discount_rate)) + toll + parking`
- **备选方案**：对全额打折（用户建议，已否决）
- **影响**：所有前端 breakdown 显示必须遵守此顺序

---

## D002 — pre_discount_fare_minor 作为定价显示基准
- **日期**：2026-03-09
- **决定**：`pre_discount_fare_minor` = fare 折前价（含 waypoints+seats，不含 toll）
- **原因**：`base_calculated_minor` 在 RETURN trip 时为 undefined，导致 fallback 错误
- **影响**：前端所有划线价、Admin breakdown、discount-preview API 均使用此字段

---

## D003 — Waypoints + Baby Seats 合并进 Base Fare 行
- **日期**：2026-03-09
- **决定**：UI 上不单独列出 Waypoint 和 Baby Seat 费用，合并在 Base Fare 行
- **原因**：简化用户界面，减少混乱
- **影响**：Admin breakdown 不再显示独立的 Stops / Baby Seats 行

---

## D004 — RETURN Trip 独立计算
- **日期**：2026-03-09（进行中）
- **决定**：Outbound (A→B→C) 和 return (C→B→A) 两程各自独立计算，不简单翻倍
- **原因**：两程路线/距离可能不同，toll 也可能不同
- **状态**：🟡 未完全实现

---

## D005 — Waypoint Charge 默认关闭
- **日期**：2026-03
- **决定**：`waypoint_charge_enabled` 在新 service type 默认为 FALSE
- **原因**：大多数服务不额外收 waypoint 费
- **影响**：Admin 可按 service type 开启

---

## D006 — Driver OTP 仅用邮件
- **日期**：2026-03
- **决定**：移除 SMS OTP，仅使用 Email OTP（平台级 env vars）
- **原因**：简化集成，统一平台邮件服务
- **影响**：`RESEND_API_KEY` 或 `SENDGRID_API_KEY` 必须配置

---

## D007 — APNs 原生推送作为 Expo Push 兜底
- **日期**：2026-03
- **决定**：后端先尝试 Expo Push，失败时走原生 APNs HTTP/2
- **原因**：iOS Driver App 需要原生 APNs token 支持
- **影响**：需要 APNS_KEY_ID / APNS_TEAM_ID / APNS_PRIVATE_KEY env vars

---

## D008 — Railway 部署仅 git push
- **日期**：2026-03
- **决定**：禁止使用 `railway up`，仅通过 `git push origin main` 触发 Railway 自动部署
- **原因**：`railway up` 在 Railpack monorepo 配置下失败
- **影响**：所有部署必须通过 GitHub push

---

## D009 — 官网 Widget CSP 加入 railway.app
- **日期**：2026-03-09
- **决定**：`vercel.json` connect-src 增加 `https://*.railway.app`
- **原因**：CSP 拦截了所有 Railway API 请求，导致 widget 无法加载
- **影响**：修复后官网 widget 恢复正常
