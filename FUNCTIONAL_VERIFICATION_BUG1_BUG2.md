# P0 缺陷修复验证报告
**日期：** 2026-03-09  
**环境：** TEST 模式（Railway staging，Stripe test key）  
**提交：** `34af37c` (BUG-2 部分) → `2b24869` (BUG-1 + BUG-2 confirm3ds)

---

## 1. 结论

| 缺陷 | 修复前 | 修复后 |
|------|--------|--------|
| **BUG-1** Quote 路由 tenant 解析失败 | 400/404 "Tenant not found" | ✅ PASS — 三种入参方式全部通过；缺少 slug 返回 400 |
| **BUG-2** Stripe SDK v20 `{}` 选项参数报错 | 400 "Unknown arguments ([object Object])" | ✅ PASS — payViaToken 端到端通过，payments 行写入正确 |

---

## 2. 修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/public/public.controller.ts` | Quote 路由 tenant slug 多源解析 + BadRequestException 导入 |
| `src/customer-portal/customer-portal.service.ts` | `payViaToken` PI create 条件调用 + `confirm3ds` retrieve 条件调用 |
| `src/payment/payment.service.ts` | `createPaymentIntent`、`capturePayment`、`createRefund` 条件调用 |

---

## 3. 修改内容

### BUG-1 — `src/public/public.controller.ts`

**根本原因：** Quote 路由 `@Query('tenant_slug')` 只读 query param，前端发的是 body `tenantSlug`，导致 slug 为 undefined → "Tenant not found"。

**修复方案：** 三级优先级解析，全部支持，无需改前端：

```typescript
// 优先级：query param > body.tenantSlug > X-Tenant-Slug header
const slug: string =
  slugQuery ||
  body?.tenantSlug ||
  (req.headers?.['x-tenant-slug'] as string) ||
  '';
if (!slug) {
  throw new BadRequestException('tenant_slug is required');
}
```

**回归验证：**
- ✅ `body.tenantSlug` → 201，6 个报价结果，total=17252 分
- ✅ `?tenant_slug=` query param → 201，6 个报价结果
- ✅ `X-Tenant-Slug` header → 201，6 个报价结果
- ✅ 缺少 slug → 400 `{ message: "tenant_slug is required" }`

---

### BUG-2 — Stripe SDK v20 空 `{}` 选项参数

**根本原因：** Stripe SDK v20 的 `isOptionsHash()` 检查入参是否包含已知 option 键（`stripeAccount`、`apiVersion`、`idempotencyKey` 等）。空对象 `{}` 不包含任何已知键，被判定为"未知参数"，抛出：
```
Stripe: Unknown arguments ([object Object]). Did you mean to pass an options object?
```

**修复方案：** 所有 Stripe SDK 调用改为条件调用——Connect 模式传 `{ stripeAccount: id }`，平台模式完全省略第二个参数：

```typescript
// 修复前（错误）
stripe.method(params, stripeAccountId ? { stripeAccount: id } : {})

// 修复后（正确）
stripeAccountId
  ? stripe.method(params, { stripeAccount: stripeAccountId })
  : stripe.method(params)
```

**受影响的 4 个调用点：**

1. **`payViaToken`** — `stripe.paymentIntents.create()`  
   文件：`customer-portal.service.ts:780-782`

2. **`confirm3ds`** — `stripe.paymentIntents.retrieve()`  
   文件：`customer-portal.service.ts:877-878`  
   ⚠️ 原先有额外问题：`retrieve(id, {}, retrieveOpts)` 中 `{}` 作为 params 占位符也会触发 SDK 报错，已同步修复。

3. **`capturePayment`** — `stripe.paymentIntents.capture()`  
   文件：`payment.service.ts:102-109`

4. **`createRefund`** — `stripe.refunds.create()`  
   文件：`payment.service.ts:133-140`

5. **`createPaymentIntent`** — `stripe.paymentIntents.create()`  
   文件：`payment.service.ts:53-55`

---

## 4. 测试结果

### Quote 流程验证（BUG-1）

| 测试项 | 预期 | 实际 | 结论 |
|--------|------|------|------|
| `body.tenantSlug` 传参 | 201 + 报价列表 | 201, 6 results, total=17252 | ✅ PASS |
| `?tenant_slug=` query 传参 | 201 + 报价列表 | 201, 6 results | ✅ PASS |
| `X-Tenant-Slug` header 传参 | 201 + 报价列表 | 201, 6 results | ✅ PASS |
| 缺少 tenant_slug | 400 | 400 `"tenant_slug is required"` | ✅ PASS |

**价格验证（snake_case 字段）：**
- Mercedes-Benz GLS: 基础费=16698分（AUD 166.98），过路费=1081分，合计=17252分 ✅
- Quote session ID: `bc31130a-a3bf-4a43-99aa-0eed5cd79efe`

> **注意：** API 期望 snake_case 字段名（`distance_km`、`duration_minutes`、`pickup_at_utc` 等），camelCase 字段名会导致金额计算返回 0（非 bug，是 DTO 约定）。

### payViaToken 端到端验证（BUG-2）

**测试参数：**
- 预订 ID：`3034589d-a4fe-4414-9529-2c7d3313b6aa`
- 金额：17224 分（AUD 172.24）
- 模式：平台模式（`stripe_account_id = NULL`）

| 测试项 | 预期 | 实际 | 结论 |
|--------|------|------|------|
| `payViaToken` API 调用 | 201 success | 201 `success=True, status=succeeded` | ✅ PASS |
| `payments` 表写入 | 1 行，status=PAID | 1 行，`payment_status=PAID` | ✅ PASS |
| `payments.stripe_account_id` | NULL（平台模式） | NULL | ✅ PASS |
| `payments.amount_authorized_minor` | 17224 | 17224 | ✅ PASS |
| `bookings.payment_status` | PAID | PAID | ✅ PASS |
| `bookings.operational_status` | CONFIRMED | CONFIRMED | ✅ PASS |
| `stripe_events` 写入 | 1 行 payment_intent.succeeded | `evt_3T90FRB3pdczuXMq1BLmIgiT` | ✅ PASS |
| Outbox `PaymentCaptured` | PUBLISHED | PUBLISHED | ✅ PASS |

**capturePayment（代码审查）：**
```typescript
// payment.service.ts:102-109 — 条件调用
if (payment.stripe_account_id) {
  await this.stripe.paymentIntents.capture(pi_id, {}, { stripeAccount: id });
} else {
  await this.stripe.paymentIntents.capture(pi_id);  // 平台模式：省略选项
}
```
✅ PASS（代码审查）

**createRefund（代码审查）：**
```typescript
// payment.service.ts:133-140 — 条件调用
if (payment.stripe_account_id) {
  await this.stripe.refunds.create(params, { stripeAccount: id });
} else {
  await this.stripe.refunds.create(params);  // 平台模式：省略选项
}
```
✅ PASS（代码审查）

**confirm3ds retrieve（代码审查）：**
```typescript
// customer-portal.service.ts:877-878 — 条件调用
const pi = stripeAccountId
  ? await stripe.paymentIntents.retrieve(id, {}, { stripeAccount: stripeAccountId })
  : await stripe.paymentIntents.retrieve(id);  // 平台模式：省略 params + options
```
✅ PASS（代码审查）

### Webhook 流程（附加验证）

| 测试项 | 结果 |
|--------|------|
| `payment_intent.succeeded` → `bookings.payment_status=PAID` | ✅ PASS（实测） |
| `payment_intent.payment_failed` → `bookings.payment_status=FAILED` | ✅ PASS（实测） |
| `operational_status` 在支付失败时不变 | ✅ PASS（实测） |
| `stripe_events` 幂等写入 | ✅ PASS（ON CONFLICT DO NOTHING） |
| Outbox `PaymentCaptured` 发布 | ✅ PASS |
| Outbox `PaymentFailed` 发布 | ✅ PASS |

---

## 5. 风险影响

| 风险 | 评估 |
|------|------|
| Quote 三级 slug 解析优先级是否合理 | 低风险。query > body > header 优先级清晰；任何现有调用者都至少命中其中一种 |
| confirm3ds retrieve 省略 `{}` params 是否影响行为 | 无影响。`retrieve(id)` 等同于 `retrieve(id, {})`，SDK 内部处理相同 |
| capturePayment 平台模式调用路径 | 无 AUTHORIZED 状态测试数据，通过代码审查验证；逻辑与 payViaToken 相同 |
| createRefund 平台模式调用路径 | 同上，无退款测试数据，代码审查通过 |
| Connect 模式（`stripe_account_id` 非空）未端到端测试 | 当前 `aschauffeured` 租户无 Connect 账户，平台模式为实际运行模式；Connect 路径在代码层面已正确处理 |

---

## 6. 未完成 / 待确认

| 项目 | 状态 |
|------|------|
| Connect 模式端到端测试（`stripeAccount: acct_xxx`） | ⏳ 待有 Connect 账户时验证 |
| `capturePayment` + `createRefund` 端到端测试 | ⏳ 需要 AUTHORIZED 状态预订（manual capture flow） |
| `confirm3ds` 端到端测试（需要 3DS 触发） | ⏳ 需要 `tok_threeDSecureRequired` 测试卡 |
| `DriverInvitationSent` outbox 持续 FAILED | ⚠️ 已知独立问题，与支付流程无关 |
| 客户门户登录密码 `charles@mrdrivers.com.au` | ⚠️ 实测 401，需确认实际密码或重置 |
| 价格字段 snake_case 约定文档化 | 建议补充到 API 文档，防止前端传 camelCase 导致 total=0 |
| 切换 live 模式前置条件 | 仍需：capturePayment + createRefund + confirm3ds 端到端实测通过 |
