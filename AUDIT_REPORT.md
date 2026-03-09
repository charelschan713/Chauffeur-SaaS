# AUDIT REPORT — Chauffeur Solutions SaaS
_生成时间：2026-03-09 | 语言：简体中文（代码/字段名用英文）_

---

## 1. EXECUTIVE SUMMARY（执行摘要）

### 项目目标
构建一个多租户豪华专车 SaaS 平台（Chauffeur Solutions），提供：
- 客户在线预订（B2C）
- 司机调度与任务管理（iOS App）
- 后台管理门户（Admin Portal）
- 官网预订 Widget 嵌入

### 当前整体状态
- 核心预订流程：**基本可用**，近期经历了大量定价 bug 修复
- 定价引擎：**不稳定** — 2026-03-09 当天修复了 7 个定价显示/计算 bug
- iOS Driver App：**TestFlight Build 31** 已上传，推送通知待 APNs 配置
- 官网 Widget：**刚修复** CSP 阻断问题，稳定性未经充分测试

### 最大阻塞项
1. APNs p8 密钥文件未下载（推送通知无法工作）
2. Email OTP 登录未实现
3. RETURN trip 两程独立计算逻辑未完全验证
4. App Store 提交流程未完成

### 部署状态
| 服务 | 平台 | URL |
|------|------|-----|
| Backend (NestJS) | Railway | https://chauffeur-saas-production.up.railway.app |
| Admin Portal | Vercel | https://chauffeur-saa-s.vercel.app |
| Customer Portal | Vercel | https://aschauffeured.chauffeurssolution.com |
| Official Website | Vercel | https://aschauffeur.com.au |

### Top 5 已知风险
1. **定价 snapshot 字段不一致** — `pre_discount_fare_minor` / `base_calculated_minor` / `pre_discount_total_minor` 三个字段在不同地方混用，语义不清
2. **guest checkout 使用 `base_calculated_minor` 作为 guestBaseFare** — RETURN trip 时此字段为 undefined，可能导致计价错误（当前代码第 879 行）
3. **discount-preview 与 pricing.resolver 折扣逻辑不同步** — 两套独立折扣计算，存在分叉风险
4. **Stripe 支付捕获无幂等保护** — webhook 未见明确幂等键检查
5. **多租户隔离依赖应用层** — tenant_id 过滤由代码手动添加，RLS 未全面覆盖 API 层

---

## 2. ARCHITECTURE SUMMARY（架构概览）

### Frontend Stack
- **Customer Portal**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn/UI, Stripe.js
- **Admin Portal**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Official Website**: Vite + React, TypeScript, Tailwind CSS, Shadcn/UI

### Backend Stack
- **Framework**: NestJS (TypeScript)
- **ORM**: TypeORM (DataSource 原生查询为主，无 Repository 模式)
- **Worker**: OutboxWorkerService (轮询 outbox_events 表，每 3 秒一次)
- **部署**: Railway（git push 触发 Railpack 构建）

### Database
- **Supabase (Postgres)**，`erdsjplilnmrcltlecra.supabase.co`
- Row Level Security 已启用（但 API 层仍手动添加 tenant_id 过滤）
- Migration 通过 psycopg2 Python 脚本手动执行

### Auth
- **Driver Auth**: JWT (NestJS JWT Guard) + Email OTP（⚠️ 未完全实现，原 SMS OTP 已移除）
- **Customer Auth**: JWT + Supabase Auth（email/phone）
- **Admin Auth**: 未在此次审计中详细检查

### Payments
- **Stripe Connect**（per-tenant Stripe 密钥，fallback 到平台级 env var）
- 支付模式：Setup Intent → 预授权 → 行程后 Capture
- Webhook: `/webhooks/stripe` 处理 `payment_intent.amount_capturable_updated`, `charge.captured`, `charge.refunded`

### Realtime / Workers
- **OutboxWorkerService**: 每 3 秒轮询 `outbox_events` 表，处理通知/事件发布
- 无 Redis / BullMQ / 消息队列

### External Integrations
- Google Maps API（距离计算、路线、Toll 估算）
- Stripe Connect（支付）
- Twilio（SMS，逐步停用）
- Resend / SendGrid（Email OTP，配置中）
- Expo Push / APNs（司机推送，APNs 待配置）
- Apple Developer（App Store）

---

## 3. REPO STRUCTURE（关键目录）

```
Chauffeur-SaaS/
├── src/
│   ├── pricing/              # 核心定价引擎
│   │   ├── pricing.resolver.ts     # 主定价逻辑（ITEMIZED 模式）
│   │   ├── pricing.types.ts        # PricingContext / PricingSnapshot 类型
│   │   └── resolvers/              # zone / item / multiplier / adjustment
│   ├── customer/
│   │   └── discount.resolver.ts    # 折扣计算（Tier + Custom）
│   ├── customer-portal/
│   │   ├── customer-portal.controller.ts  # 客户 API（预订/支付/折扣预览）
│   │   └── customer-portal.service.ts     # 业务逻辑（含 guestCheckout）
│   ├── public/
│   │   ├── public-pricing.service.ts      # 公开报价 API（无需登录）
│   │   └── public-tenant.service.ts       # 租户解析
│   ├── payment/
│   │   ├── payment.service.ts             # Stripe 支付操作
│   │   └── stripe-webhook.controller.ts   # Webhook 处理
│   ├── booking/
│   │   ├── booking.service.ts             # 预订 CRUD
│   │   └── outbox-worker.service.ts       # 事件发布 Worker
│   ├── driver/
│   │   └── driver-app.service.ts          # 司机 App API + APNs/Expo 推送
│   ├── notification/                      # 通知服务（email/SMS/push）
│   ├── dispatch/                          # 调度与司机分配
│   ├── auth/                              # 平台级 Auth
│   └── common/guards/                     # JWT Guard, Tenant Role Guard
├── apps/
│   ├── customer/                          # Customer Portal (Next.js)
│   │   └── app/
│   │       ├── book/BookPageClient.tsx    # 预订页（定价显示/支付）
│   │       └── quote/QuoteClient.tsx      # 报价页
│   ├── admin/                             # Admin Portal (Next.js)
│   │   └── app/(tenant)/bookings/[id]/   # 预订详情（定价明细）
│   └── quote-widget/                      # (存在但未详查)
├── MEMORY.md / PROJECT_STATE.md / DECISIONS.md / BUGS.md / NEXT_STEPS.md
└── AUDIT_REPORT.md (本文件)
```

---

## 4. CRITICAL BUSINESS FLOWS（关键业务流程）

### 4.1 Auth / Login

**入口**: `src/auth/` + `src/customer-auth/`

**主要文件**:
- `src/common/guards/jwt.guard.ts`
- `src/customer-portal/customer-portal.controller.ts` (`send-email-otp`, `verify-email-otp`)

**当前状态**: ⚠️ 半完成
- Customer: Email/Phone OTP 可用（Supabase Auth）
- Driver: SMS OTP 已移除，Email OTP 端点存在但实现状态不明
- Guest checkout: 无需 auth，通过 email 创建/匹配客户

**已知问题**:
- Driver Email OTP 发送方未明确配置（依赖 RESEND_API_KEY / SENDGRID_API_KEY env vars）
- 多租户 JWT 中 tenant_id 绑定方式需审查

---

### 4.2 Quote Flow（报价流程）

**入口**: `POST /public/pricing/quote` → `src/public/public-pricing.service.ts`

**主要文件**:
- `src/public/public-pricing.service.ts`
- `src/pricing/pricing.resolver.ts`
- `src/customer/discount.resolver.ts`
- `apps/customer/app/quote/QuoteClient.tsx`

**流程**:
1. 前端调用 `/public/pricing/quote` 传入 trip 参数
2. `PublicPricingService` 解析租户，加载所有 car types
3. 每个 car type 调用 `PricingResolver.resolve(ctx)` 生成 snapshot
4. Snapshot 存入 `quote_sessions` 表（30 分钟有效）
5. 前端展示价格卡片，用户选择车型

**当前状态**: ✅ 基本可用

**已知问题**:
- `waypoint_charge_enabled` 默认值在代码里是 `true`（第 61 行），但 DB 默认是 `false`，存在不一致
- RETURN trip 两程距离需前端计算后传入（非后端独立计算路线）
- `base_calculated_minor` 在 RETURN trip 为 `undefined`，导致多处 fallback 链复杂

---

### 4.3 Booking Flow（预订流程）

**入口**: `POST /customer-portal/bookings`（登录用户）/ `POST /customer-portal/guest/checkout`（访客）

**主要文件**:
- `src/customer-portal/customer-portal.service.ts`
- `apps/customer/app/book/BookPageClient.tsx`

**流程**:
1. 用户在 BookPageClient 填写乘客信息、选择支付方式
2. 前端 POST 预订，后端 INSERT 到 `bookings` 表
3. 触发 OutboxWorker 发送确认邮件/通知
4. Admin 分配司机，触发 APNs/Expo 推送给司机

**当前状态**: ✅ 基本可用

**已知问题**:
- `guestBaseFare` 使用 `base_calculated_minor`（RETURN trip 时为 undefined），实际用 `totalMinor - toll`，可能不准确
- 预订 INSERT 的 `total_price_minor` 来自前端传入值，无后端二次验证（价格可被篡改风险）
- `waypoints` 字段依赖前端传入，无后端校验

---

### 4.4 Payment Flow（支付流程）

**入口**: `POST /customer-portal/payments/setup-intent` → Stripe Setup Intent

**主要文件**:
- `src/customer-portal/customer-portal.service.ts`
- `src/payment/payment.service.ts`
- `src/payment/stripe-webhook.controller.ts`

**流程**:
1. 前端获取 Setup Intent (on_session / off_session)
2. Stripe.js 收集卡信息，3DS 验证
3. 预订创建时绑定 payment method
4. 行程完成后后端 Capture
5. Webhook 更新支付状态

**当前状态**: ⚠️ 可用但有风险

**已知问题**:
- **价格未经后端验证**：`total_price_minor` 直接来自前端，Stripe Capture 金额应从后端重新计算
- **Webhook 幂等性**：未见明确的 `stripe_event_id` 去重检查（已存入 DB 但处理逻辑未见 SELECT-before-process）
- 多租户 Stripe 密钥解析：先查 `tenant_settings` 再 fallback 平台 env var，两套密钥混用有风险

---

### 4.5 Invoice Flow

**入口**: `GET /customer-portal/invoices`

**当前状态**: 🔴 未详细审查
- 端点存在但实现逻辑未在此次审计中检查

---

### 4.6 Role / Permission Flow

**入口**: `src/common/guards/tenant-role.guard.ts`

**当前状态**: ⚠️ 基础实现
- JWT Guard 验证 token
- Tenant Role Guard 验证角色
- 多租户隔离依赖代码层手动 `tenant_id` 过滤，RLS 是否全面覆盖未知

---

## 5. RECENT CHANGES（近期修改，2026-03-09）

| commit | 文件 | 修改内容 | 可能影响 |
|--------|------|----------|----------|
| `22edc99` | MEMORY/PROJECT_STATE/DECISIONS/BUGS/NEXT_STEPS.md | 新增项目记忆文件 | 无代码影响 |
| `0f8455c` | `apps/admin/app/(tenant)/bookings/[id]/page.tsx` | Admin breakdown 显示修复：移除重复 Stops/Baby Seats 行，顺序改为 fare→discount→toll→total | Admin 定价显示 |
| `f26c6a3` | `apps/customer/app/quote/QuoteClient.tsx` | 划线价改用 `pre_discount_fare_minor` | Quote 页定价显示 |
| `6bac514` | `apps/customer/app/book/BookPageClient.tsx` | 未登录时也显示 discount 行（从 snapshot `discount_amount_minor` fallback） | Customer 预订页 |
| `0a0f60c` | `apps/admin/app/(tenant)/bookings/[id]/page.tsx` | baseFare 改用 `pre_discount_fare_minor` | Admin 定价显示 |
| `307d257` | `src/customer-portal/customer-portal.controller.ts` | discount-preview trueBase 改用 `pre_discount_fare_minor` | 登录后折扣重算 |
| `61b47c6` | (revert) 3 个文件 | 撤销"对全额打折"的错误改动 | 撤销影响 |
| `c1af6bb` | `apps/customer/app/book/BookPageClient.tsx` | 划线价 = `pre_discount_fare_minor` + toll | Customer 预订页 |
| `d1a3998` | `aschauffeur-elite-docs/vercel.json` | CSP connect-src 加入 `*.railway.app` | 官网 Widget 解封 |

**风险提示**：2026-03-09 单日 9 次 commit 涉及定价逻辑，改动频繁，需要整体回归测试。

---

## 6. ACTIVE BUG INVENTORY（当前 Bug 清单）

### BUG-008 — APNs p8 文件未下载（P1 阻塞）
- **复现**：iOS Driver App 收不到推送通知
- **根因**：Key DY4WS2ACK7 创建后 OpenClaw 浏览器无法保存文件，下载按钮已灰
- **影响**：`src/driver/driver-app.service.ts` `sendApnsPush()` — APNS_KEY_ID/APNS_PRIVATE_KEY 未设置
- **状态**：🔴 阻塞，需用系统浏览器重新操作

### BUG-009 — RETURN Trip 两程未完全独立计算（P2）
- **复现**：RETURN trip 报价，两程路线距离/toll 是否分别请求 Google Maps 路线未确认
- **根因**：`return_distance_km` / `return_duration_minutes` 依赖前端传入，非后端独立计算
- **影响**：`src/pricing/pricing.resolver.ts`, `src/public/public-pricing.service.ts`
- **状态**：🟡 待验证

### BUG-010 — guestBaseFare 使用废弃字段（P2 潜在）
- **复现**：RETURN trip guest checkout 时，pricing snapshot 无 `base_calculated_minor`
- **根因**：`customer-portal.service.ts` 第 879 行：`guestBaseFare = guestPricingSnapshot?.base_calculated_minor ?? (totalMinor - toll)`
- **影响**：Guest 预订保存的 baseFare 字段可能不准确（影响 invoice/admin 显示）
- **状态**：🟡 未修复

### BUG-011 — 支付金额无后端验证（P1 安全）
- **复现**：前端修改 `total_price_minor` 后 POST，后端直接 INSERT 而不重新计算
- **根因**：`customer-portal.service.ts` 预订 INSERT 使用 `dto.totalPriceMinor`
- **影响**：客户可能以错误价格创建预订
- **状态**：🔴 未修复（需从 quoteSession 重新取价格）

### BUG-012 — Stripe Webhook 幂等性不明确（P2）
- **复现**：网络重试导致 webhook 重复触发
- **根因**：`stripe-webhook.controller.ts` 有 `stripe_event_id` 入库，但处理前未见 SELECT 去重
- **影响**：可能导致重复 Capture 或重复状态变更
- **状态**：🟡 待审查

### BUG-013 — waypoint_charge_enabled 默认值不一致（P3）
- **复现**：新 service type 在 DB 默认 `false`，但 `public-pricing.service.ts` 代码默认 `true`
- **根因**：第 61 行 `waypointChargeEnabled = st?.waypoint_charge_enabled ?? true`
- **影响**：如果 DB 查询返回 null（service_type_id 不存在），会错误地收取 waypoint 费
- **状态**：🟡 低风险但需修复

---

## 7. ROOT CAUSE CLUSTERS（根因聚类）

### 集群 A — 定价 Snapshot 字段语义混乱
**频率**：7 次 bug（今日全部）
**模式**：`pre_discount_fare_minor` / `base_calculated_minor` / `pre_discount_total_minor` / `grand_total_minor` 四个字段在前后端不同位置混用，含义不一致
**根因**：定价字段在迭代中不断增加，没有统一的字段规范文档
**建议**：制定单一 pricing snapshot 字典，所有消费方强制使用同一字段

### 集群 B — 前后端数据不一致
**频率**：3-4 处
**模式**：前端传入的值（价格、waypoints、passengers）后端不做二次验证，直接持久化
**根因**：信任前端传来的已计算值，未做服务端重算
**建议**：支付相关金额必须从 quoteSession 取，不信任 DTO 传入价格

### 集群 C — RETURN trip 特殊处理散落各处
**频率**：4 处
**模式**：RETURN trip 的特殊逻辑（`base_calculated_minor = undefined`、两程 waypoints 分开等）散落在 resolver、service、controller 多处，没有集中处理
**根因**：RETURN trip 需求是后期追加的，未做统一抽象
**建议**：提取 `ReturnTripContext` 统一处理两程逻辑

### 集群 D — 折扣计算双轨并行
**频率**：2 套实现
**模式**：`DiscountResolver.resolve()` 和 `customer-portal.controller.ts` 的 `discount-preview` 各自实现折扣计算，逻辑略有差异
**根因**：discount-preview 需要在登录后重算，但没有复用 DiscountResolver
**建议**：discount-preview 直接调用 DiscountResolver，消除重复逻辑

### 集群 E — 部署配置问题
**频率**：2 处
**模式**：CSP 配置遗漏（今日修复）、Railway env vars 手动管理（APNs 未配置）
**根因**：没有 IaC 或配置清单，env vars 完全手动
**建议**：建立 env var 清单文档，关键配置有验证启动检查

---

## 8. UNSTABLE FILES / MODULES（高风险文件）

| 文件 | 风险原因 | 风险等级 |
|------|----------|----------|
| `src/pricing/pricing.resolver.ts` | 核心定价逻辑，2 周内多次大改，RETURN trip 特殊处理复杂 | 🔴 高 |
| `src/customer-portal/customer-portal.service.ts` | guestCheckout 逻辑复杂，价格无服务端验证，guest/用户合并逻辑容易出错 | 🔴 高 |
| `src/customer-portal/customer-portal.controller.ts` | discount-preview 重复实现折扣计算 | 🟡 中 |
| `apps/customer/app/book/BookPageClient.tsx` | 大量 state（loyaltyDiscount/quoteId/savedCards），引用陈旧问题修复记录（useRef） | 🟡 中 |
| `src/payment/stripe-webhook.controller.ts` | 幂等性不明确，支付状态变更关键路径 | 🔴 高 |
| `src/customer/discount.resolver.ts` | 与 controller 的 discount-preview 逻辑分叉 | 🟡 中 |
| `src/public/public-pricing.service.ts` | `waypoint_charge_enabled` 默认值不一致 | 🟡 中 |
| `aschauffeur-elite-docs/src/components/booking/BookingWidget.tsx` | CSP 刚修复，widget 整体测试不足 | 🟡 中 |

---

## 9. BUILD / DEPLOY STATUS（构建部署状态）

### 本地构建
- NestJS Backend: ✅ `npx tsc --noEmit` 通过（截至 2026-03-09）
- Admin Portal: ✅ `npx tsc --noEmit` 通过
- Customer Portal: ✅ `npx tsc --noEmit` 通过

### Vercel（Frontend）
- Latest deploy: commit `0f8455c` → Vercel 自动触发
- 状态：✅ 应已部署（未实时确认）
- ⚠️ 今日 9 次 push，Vercel 经历多次 redeploy，缓存/边缘状态可能不一致

### Railway（Backend）
- Latest deploy: commit `22edc99`（memory files，无代码变更）
- 实际最新代码：commit `0f8455c`（admin breakdown 修复）
- 状态：✅ Railway 持续运行，日志正常

### Supabase
- 无 RLS 或 schema 问题报告
- 近期 migration：添加 `waypoints TEXT[]` 列、`waypoint_charge_enabled` 列

### 已知环境/配置问题
| 问题 | 严重性 |
|------|--------|
| APNS_KEY_ID / APNS_PRIVATE_KEY 未设置 | 🔴 P1 |
| RESEND_API_KEY 或 SENDGRID_API_KEY 状态未确认 | 🟡 P2 |
| Stripe 双密钥（tenant + platform）混用无明确优先级文档 | 🟡 P2 |

---

## 10. REVIEW QUESTIONS FOR CHATGPT（建议 ChatGPT 审查的问题）

1. **价格安全性**：`customer-portal.service.ts` 的预订 INSERT 使用前端传入的 `total_price_minor`，是否存在价格篡改风险？应该如何从 quoteSession 重新验证价格？

2. **Stripe Webhook 幂等性**：`stripe-webhook.controller.ts` 中是否有正确的幂等处理？`stripe_event_id` 入库后，是否在处理前先 SELECT 确认未处理过？

3. **折扣双轨问题**：`DiscountResolver.resolve()` 和 `discount-preview` 两套折扣计算是否存在逻辑分叉？如何安全合并？

4. **RETURN trip 定价架构**：当前 RETURN trip 依赖前端传入 `return_distance_km` 和 `return_duration_minutes`，后端是否需要独立计算两程路线？这种设计是否有安全/准确性风险？

5. **pricing snapshot 字段混乱**：`pre_discount_fare_minor` / `base_calculated_minor` / `grand_total_minor` 的语义边界是否清晰？应该如何重构字段定义？

6. **多租户隔离**：API 层的 `tenant_id` 过滤是否足够？Supabase RLS 是否覆盖所有关键表？是否存在跨租户数据泄露风险？

7. **OutboxWorker 可靠性**：每 3 秒轮询的 OutboxWorker 是否足够可靠？在高并发下是否存在消息丢失或重复处理风险？

8. **Guest Checkout 用户合并**：guest checkout 通过 email 查找/创建客户，是否存在账号劫持或数据污染风险（恶意用户用他人 email 下单）？

9. **Stripe 多密钥策略**：tenant_settings 和 platform env var 的 Stripe 密钥如何隔离？多租户场景下是否可能跨租户误用密钥？

10. **APNs JWT 安全性**：`sendApnsPush()` 使用 ES256 JWT 签名，私钥从 env var 读取，JWT 有效期和 token 缓存策略是否合理？

---

## CHATGPT_REVIEW_HANDOFF

```
PROJECT: Chauffeur Solutions SaaS
STACK: NestJS + Next.js (App Router) + Supabase + Stripe Connect + Railway + Vercel
TENANT: aschauffeured (multi-tenant SaaS, all queries must include tenant_id)

TOP RISKS:
1. No server-side price validation — total_price_minor comes from frontend DTO
2. Stripe webhook idempotency unclear — event stored but processing not guarded
3. Pricing snapshot field chaos — 4+ overlapping fields with unclear semantics
4. RETURN trip pricing depends on frontend-supplied distances (no server recalculation)
5. Driver Email OTP not fully implemented — SMS removed, email pending

TOP BUGS (unresolved):
- BUG-008: APNs .p8 key not downloaded → push notifications broken
- BUG-009: RETURN trip two-leg independent calculation not verified
- BUG-010: guestBaseFare uses base_calculated_minor (undefined for RETURN trip)
- BUG-011: Payment amount not re-validated server-side (price tampering risk)
- BUG-012: Stripe webhook idempotency not confirmed
- BUG-013: waypoint_charge_enabled default inconsistent (code=true, DB=false)

TOP FILES TO INSPECT:
1. src/pricing/pricing.resolver.ts          — core pricing, recently modified heavily
2. src/customer-portal/customer-portal.service.ts — booking insert + guest checkout
3. src/payment/stripe-webhook.controller.ts — payment capture idempotency
4. src/customer/discount.resolver.ts        — discount calculation (dual implementation)
5. src/customer-portal/customer-portal.controller.ts — discount-preview (duplicate logic)

QUESTIONS TO REVIEW FIRST:
Q1: Is total_price_minor in booking INSERT re-validated from quoteSession?
Q2: Is Stripe webhook idempotent (SELECT stripe_event_id before processing)?
Q3: Is discount logic between DiscountResolver and discount-preview in sync?
Q4: Should RETURN trip distances be server-calculated instead of frontend-supplied?
Q5: Is tenant_id isolation enforced at DB level (RLS) or only at application layer?
```

---

_报告完成时间：2026-03-09 | Chauffeur-SaaS commit `22edc99`_
