# CUSTOMER_WEB_APP_CONTRACT_DIFF.md
**生成时间：** 2026-03-09  
**审查基础：** 源码直接分析（无假设）  
**语言：** 简体中文

---

## 产品系统边界说明（依据最新产品规则）

| 系统 | 角色 | 权威性 |
|------|------|--------|
| **官网 Widget** (BookingWidget.tsx) | 主入口 / 完整报价体验 | 纯入口层，正确设计 |
| **嵌入 Widget** (apps/quote-widget) | 轻量入口 / 合作商嵌入 | 有意限制，不追求功能对齐 |
| **客户 Web Portal** (apps/customer) | 权威交易前端 | 预订/支付真相 |
| **Customer App** (customer-app/) | 1:1 Web Port 目标 | 应对齐 Web Portal |

**核心产品规则：** 所有客户端必须统一：业务规则 / API合约 / 状态字典 / 定价逻辑 / 客户旅程 / 状态标签。差异只允许在：布局 / 交互密度 / 字段可见数量 / 移动vs桌面 / 营销重点。

---

## 1. 总结结论

**对齐状态：** ⚠️ **严重漂移** — App 与 Web Portal 在 3 个核心领域存在根本性差异：

| 漂移类别 | 严重度 | 说明 |
|---------|--------|------|
| 主预订创建端点不存在 | 🔴 P0 CRITICAL | App `handleBookNow` 调用 `/create-from-quote` — 后端无此端点，必然 404 |
| 3DS 支付流程缺失 | 🔴 P0 | App 无 3DS 处理，卡验证可能静默失败 |
| 状态字典大小写不对齐 | 🔴 P0 | `DRIVER_STATUS` 使用 UPPERCASE，后端返回 lowercase |
| 支付架构不同 | 🟡 P1 | Web: `confirmCardSetup` + `/pay/[token]`；App: `createPaymentMethod` + inline pay |
| `cars.tsx` 字段名全错 | 🟡 P1 | 使用 `car_type_id`/`base_fare_minor` 等不存在的字段 |
| 访客支付端点不同 | 🟡 P1 | App: `/guest/checkout`；Web: 不同路径（需确认统一） |
| 报价字段命名 | ✅ 对齐 | App 和 Web 的 quote POST 都使用 snake_case |
| 报价展示逻辑 | ✅ 对齐 | `pre_discount_total_minor`、折扣展示基本一致 |

---

## 2. 报价输入字段对比

### Web（BookingWidget.tsx + QuoteClient.tsx）vs App（book/index.tsx）

| 字段 | Web 有？ | App 有？ | 影响定价？ | 影响 Payload？ | 严重度（缺失时）|
|------|---------|---------|----------|--------------|--------------|
| `city_id` | ✅ | ✅ | ✅ | ✅ | P0 |
| `service_type_id` | ✅ | ✅ | ✅ | ✅ | P0 |
| `trip_mode` (ONE_WAY/RETURN) | ✅ | ✅ | ✅ | ✅ | P0 |
| `pickup_address` | ✅ | ✅ | - | ✅ | P0 |
| `dropoff_address` | ✅ | ✅ | - | ✅ | P1 |
| `pickup_at_utc` | ✅ | ✅ | ✅ (surcharge) | ✅ | P0 |
| `timezone` | ✅ (city timezone) | ✅ (selectedCity?.timezone ?? 'Australia/Sydney') | - | ✅ | P1 |
| `passenger_count` | ✅ | ✅ | - | ✅ | P1 |
| `luggage_count` | ✅ | ✅ | - | ✅ | P2 |
| `distance_km` | ✅ | ✅ | ✅ | ✅ | P0 |
| `duration_minutes` | ✅ | ✅ | ✅ | ✅ | P0 |
| `waypoints_count` | ✅ | ✅ | ✅ (if enabled) | ✅ | P1 |
| `waypoints[]` | ✅ | ✅ | ✅ (addresses) | ✅ | P1 |
| `infant_seats` | ✅ | ✅ | ✅ | ✅ | P1 |
| `toddler_seats` | ✅ | ✅ | ✅ | ✅ | P1 |
| `booster_seats` | ✅ | ✅ | ✅ | ✅ | P1 |
| `duration_hours` (hourly charter) | ✅ | ✅ | ✅ | ✅ | P0 |
| `return_distance_km` | ✅ | ✅ | ✅ | ✅ | P1 |
| `return_duration_minutes` | ✅ | ✅ | ✅ | ✅ | P1 |
| `return_date` / `return_time` | ✅ | ✅ | - | ✅ | P1 |
| 12小时预订最短提前 | ✅ (弹窗引导) | ✅ (showUrgent modal) | - | - | P2 |

**结论：** 报价输入字段 **完全对齐** ✅。所有字段均使用 snake_case，API 合约在报价层一致。

---

## 3. 预订 Payload 对比

### 主路径：POST /customer-portal/bookings

| 字段 | Web Portal 发送 | App checkout.tsx 发送 | 差异说明 |
|------|----------------|----------------------|---------|
| `quoteId` | ✅ (camelCase) | ✅ (camelCase) | ✅ 一致 |
| `vehicleClassId` | ✅ | ✅ | ✅ 一致 |
| `totalPriceMinor` | ✅ | ✅ | ✅ 一致（⚠️ 注：BUG-011 价格篡改未修，服务端未重算） |
| `currency` | ✅ | ✅ | ✅ 一致 |
| `paymentMethodId` | ❌ Web 用 `setupIntentId` | ✅ App 用 `paymentMethodId` | ⚠️ **架构不同** |
| `setupIntentId` | ✅ Web 用 setupIntent | ❌ App 不用 setupIntent | ⚠️ **架构不同** |
| `passengerCount` | ✅ | ✅ | ✅ 一致 |
| `passengerFirstName` | ✅ | ✅ | ✅ 一致 |
| `passengerLastName` | ✅ | ✅ | ✅ 一致 |
| `passengerEmail` | ✅ | ❌（未发送 email 字段）| ⚠️ App 缺失 |
| `passengerPhone` | ✅ | ❌（未发送 phone）| ⚠️ App 缺失 |
| `notes` | ✅ (`notes` 字段) | ✅ | ✅ 一致 |
| `isReturnTrip` | ✅ | ❌ 未传 | ⚠️ 缺失 |
| `returnPickupAt` | ✅ | ❌ 未传 | ⚠️ 缺失 |
| `waypoints[]` | ✅ | ❌ checkout.tsx 未传 waypoints | ⚠️ 缺失 |
| `infantSeats` | ✅ | ❌ checkout.tsx 未传婴儿座椅 | ⚠️ 缺失 |
| `tenantSlug` | 通过 header | 通过 header | ✅ 一致 |

### App index.tsx 的 handleBookNow（主报价页"Book Now"）

```javascript
// App book/index.tsx:handleBookNow
await api.post('/customer-portal/bookings/create-from-quote', {
  quote_id: quoteId,         // snake_case
  service_class_id: selectedCarId,  // snake_case
});
```

**❌ CRITICAL BUG：**
- 端点 `/customer-portal/bookings/create-from-quote` 在后端**不存在**（经源码确认）
- 后端只有 `POST /customer-portal/bookings`
- 调用此端点必然返回 **404**
- App 用户在主报价页面点击 "Book Now" 永远失败

### App cars.tsx 的 sessionId 字段名错误

```javascript
// App book/cars.tsx
const sessionId = quoteData.session_id ?? quoteData.quote_session_id ?? '';
// ❌ API 实际返回 quote_id，不是 session_id 或 quote_session_id
```

---

## 4. 支付流程对比

| 流程 | Web Portal | App |
|------|-----------|-----|
| **Stripe 初始化** | `GET /stripe-config-by-slug` 动态获取 PK | `EXPO_PUBLIC_STRIPE_PK` 环境变量 |
| **新卡 Stripe 操作** | `stripe.confirmCardSetup()` → setupIntentId | `createPaymentMethod()` → paymentMethodId |
| **保存卡支持** | ✅ PaymentMethod 列表 + 选择 | ✅ App checkout.tsx 支持 |
| **3DS 处理** | ✅ `stripe.handleNextAction()` + `POST confirm-3ds` | ❌ **完全没有 3DS 处理** |
| **requires_action 处理** | ✅ 检测 `status === 'requires_action'` | ❌ 无检测，静默失败 |
| **支付路径** | 创建 booking → 返回 `paymentToken` → `/pay/[token]` 独立支付 | 创建 booking + 支付一步完成（无独立支付页） |
| **访客支付端点** | `POST /customer-portal/bookings` (带 setupIntentId) | `POST /customer-portal/guest/checkout` |
| **成功后跳转** | `/booking-confirmed/[reference]`（或内联 SuccessScreen） | `/(app)/bookings/success` |
| **成功页验证** | ⚠️ 部分（已在本次改为 API 验证） | ❌ 静态展示 `ref` 参数，无后端验证 |
| **支付失败处理** | Alert + 可重试 | Alert + 可重试 |

**核心差异：**
- Web 使用 `confirmCardSetup`（保存卡意图）→ 实际扣款在后端异步 capture
- App 使用 `createPaymentMethod`（仅创建支付方式）→ 在同一个 booking API 调用里扣款
- 这两种路径在后端的处理逻辑**完全不同**，且 App 的路径缺乏 3DS 支持

---

## 5. 状态字典对比

### operational_status（来自 bookings 表）

| 状态值 | Web（修复后）| App bookings/[id].tsx | App bookings/index.tsx |
|-------|------------|---------------------|----------------------|
| `PENDING_CUSTOMER_CONFIRMATION` | ✅ 'Pending Confirmation' | ✅ '#f59e0b' | ✅ 'Confirming' |
| `AWAITING_CONFIRMATION` | ✅ 'Awaiting Confirmation' | ❌ 缺失 | ✅ 'Confirming' |
| `CONFIRMED` | ✅ 'Confirmed' | ✅ '#22c55e' | ✅ 'Confirmed' |
| `COMPLETED` | ✅ 'Completed' | ✅ '#6366f1' | ✅ 'Completed' |
| `FULFILLED` | ✅ 'Fulfilled' | ❌ 缺失 | ❌ 缺失 |
| `CANCELLED` | ✅ 'Cancelled' | ✅ '#ef4444' | ✅ 'Cancelled' |
| `PAYMENT_FAILED` | ✅ 'Payment Failed' | ❌ 缺失 | ✅ 'Pay Failed' |
| `IN_PROGRESS` (无效值) | ❌ 已移除 | ⚠️ 保留（后端不使用） | ⚠️ 保留（后端不使用） |
| `ASSIGNED` (无效值) | ❌ 已移除 | ❌ 缺失 | ⚠️ 保留（后端不使用） |

### driver_execution_status（来自 assignments 表）

| 状态值（后端真实 lowercase） | Web（修复后）| App bookings/[id].tsx DRIVER_STATUS |
|--------------------------|------------|-----------------------------------|
| `assigned` | ✅ 'Driver Assigned' | ❌ 使用 UPPERCASE key `ACCEPTED` |
| `accepted` | ✅ 'Driver Accepted' | ❌ `ACCEPTED`（大写）→ 仅标签错，但 key 不匹配 |
| `on_the_way` | ✅ 'Driver En Route' | ❌ `ON_THE_WAY`（大写）→ 永远不匹配 |
| `arrived` | ✅ 'Driver Arrived' | ❌ `ARRIVED`（大写）→ 永远不匹配 |
| `passenger_on_board` | ✅ 'Passenger On Board' | ❌ `PASSENGER_ON_BOARD`（大写）→ 永远不匹配 |
| `job_done` | ✅ 'Job Done' | ❌ `JOB_DONE`（大写）→ 永远不匹配 |

**App 驾驶员状态字典全部使用 UPPERCASE，后端返回全部 lowercase：所有 driver 状态 badge 永远不显示。**

---

## 6. 缺失字段矩阵

| 字段名 | Web | App | 类别 | 必须？ | 定价影响 | 预订影响 | 优先级 |
|-------|-----|-----|------|--------|---------|---------|--------|
| `/create-from-quote` 端点 | ❌ 不存在 | 依赖它 | API 合约 | ✅ | - | ✅ 404 | 🔴 P0 |
| 3DS `requires_action` 处理 | ✅ | ❌ | 支付安全 | ✅ | - | 3DS 卡失败 | 🔴 P0 |
| `driver_execution_status` lowercase keys | ✅ | ❌ | 状态字典 | ✅ | - | UI 不显示 | 🔴 P0 |
| `FULFILLED` 状态 | ✅ | ❌ | 状态字典 | ✅ | - | 状态未知 | 🟡 P1 |
| `AWAITING_CONFIRMATION` | ✅ | ❌（bookings/[id]）| 状态字典 | ✅ | - | 状态未知 | 🟡 P1 |
| `PAYMENT_FAILED` | ✅ | ❌（bookings/[id]）| 状态字典 | ✅ | - | 状态未知 | 🟡 P1 |
| Checkout `isReturnTrip` | ✅ | ❌ | Payload | 可选 | - | 返程不记录 | 🟡 P1 |
| Checkout `waypoints[]` | ✅ | ❌ | Payload | 可选 | ✅ | 停靠点丢失 | 🟡 P1 |
| Checkout `infantSeats` | ✅ | ❌ | Payload | 可选 | ✅ | 婴儿座椅丢失 | 🟡 P1 |
| `passengerEmail` in checkout | ✅ | ❌ | Payload | ✅ | - | 通知发不出 | 🟡 P1 |
| `passengerPhone` in checkout | ✅ | ❌ | Payload | 可选 | - | 司机联系缺失 | 🟡 P1 |
| setupIntentId vs paymentMethodId | setup | payment | 支付架构 | ✅ | - | 不同扣款路径 | 🟡 P1 |
| `cars.tsx` `quote_id` 字段读取 | ✅ | `session_id`（错） | API 合约 | 若使用 | - | sessionId 为空 | 🟡 P1 |
| `success.tsx` 后端状态验证 | ✅（已修复）| ❌ 静态 | UX | - | - | 假阳性成功 | 🟢 P2 |
| `IN_PROGRESS`/`ASSIGNED` 清理 | ✅ 已清理 | ⚠️ 保留 | 状态字典 | - | - | 死条件 | 🟢 P2 |

---

## 7. 根因评估

**Q1: App 是否使用过时的预订合约？**
✅ 是。`checkout.tsx` 中的 payload 是早期版本设计，缺失 return trip、waypoints、baby seats 等字段。

**Q2: App 是否缺失功能组件？**
✅ 是。
- 无独立支付页面（等价于 web 的 `/pay/[token]`）
- 无 3DS 认证流程
- `cars.tsx` 是死屏幕（字段名全错，且不在主流程中被导航到）

**Q3: App 是否使用了不同的 DTO？**
✅ 是。
- Quote payload: snake_case ✅ 对齐
- Booking payload: camelCase ✅ 对齐（字段名），但缺少多个字段
- 主报价页 `handleBookNow`: 发送到不存在的端点（根本性错误）

**Q4: App 是否使用不同的枚举/状态映射？**
✅ 是，且全部错误。
- `DRIVER_STATUS` 使用 UPPERCASE，后端全部 lowercase
- 缺少 `FULFILLED`、`AWAITING_CONFIRMATION`、`PAYMENT_FAILED`

**Q5: `cars.tsx` 是否在流程中？**
❌ 否。`index.tsx` 的车型选择是内联的（quote 结果展示在同一页），`handleBookNow` 直接从 `index.tsx` 调用，不经过 `cars.tsx`。`cars.tsx` 是废弃屏幕。

---

## 8. 建议修复计划

### Phase 1：立即修复（P0，App 完全不可用部分）

1. **修复 `index.tsx` handleBookNow 端点**
   - 将 `/customer-portal/bookings/create-from-quote` 替换为正确流程
   - 选项 A：调用 `/customer-portal/bookings`（需要 paymentMethodId）→ 用户先填支付信息
   - 选项 B：创建 booking 后跳转到支付页（对齐 web 的 `/pay/[token]` 模式）
   - 建议选 B：保持 web 和 app 架构一致，付款逻辑单一

2. **修复 `DRIVER_STATUS` 大小写**
   - `ACCEPTED` → `accepted`
   - `ON_THE_WAY` → `on_the_way`
   - `ARRIVED` → `arrived`
   - `PASSENGER_ON_BOARD` → `passenger_on_board`
   - `JOB_DONE` → `job_done`
   - 同时 App `bookings/[id].tsx` 中检测 `driverStatus === 'ON_THE_WAY'` 也要改为 `on_the_way`

3. **添加 3DS 处理（checkout.tsx）**
   - 检测 `booking_status === 'requires_action'` 或后端返回 `clientSecret`
   - 调用 `stripe.handleNextAction({ clientSecret })` 或跳转到独立支付页

### Phase 2：状态 / Schema 对齐（P1）

4. 补充 `FULFILLED`、`AWAITING_CONFIRMATION`、`PAYMENT_FAILED` 到状态字典
5. 移除 `IN_PROGRESS`（无效值）和 `ASSIGNED`（无效值）
6. Checkout payload 补充 `passengerEmail`、`passengerPhone`、`isReturnTrip`、`waypoints`、`infantSeats`/`toddlerSeats`/`boosterSeats`
7. 修复 `cars.tsx` 的字段名（或标记为废弃删除）

### Phase 3：共享合约提取（P2）

8. 抽取共享类型定义（`booking_status_enum`、`driver_execution_status_enum`）到独立 npm 包或 shared constants 文件
9. 两端从同一来源读取状态 label / color 映射
10. 统一支付架构：Web 和 App 都使用 `paymentMethodId` + `/pay/[token]` 模式，或都使用 setupIntent 模式

---

## 9. CHATGPT 交接块

```
=== CHATGPT_WEB_APP_DIFF_HANDOFF ===

TOP MISSING FIELDS (App vs Web):
1. /create-from-quote 端点不存在 → App Book Now 永远 404
2. DRIVER_STATUS 全部使用 UPPERCASE → 后端返回 lowercase，driver badge 全部不显示
3. 3DS 处理缺失 → 含3DS验证的卡支付必然失败
4. checkout.tsx 缺少 waypoints、infantSeats、isReturnTrip 字段
5. checkout.tsx 缺少 passengerEmail/passengerPhone

TOP BROKEN FLOWS:
1. App 主流程 Book Now → POST /create-from-quote → 404（完全不可用）
2. 任何需要 3DS 验证的卡 → App 无处理 → 静默失败
3. Driver en-route banner (driverStatus === 'ON_THE_WAY') → 永远不触发（大小写不对）
4. Return trip + waypoints 信息在 App checkout 中丢失

TOP SCHEMA MISMATCHES:
1. driver_execution_status: App=UPPERCASE / backend=lowercase
2. Booking endpoint: App=/create-from-quote / backend=不存在
3. cars.tsx sessionId: App reads `session_id` / API returns `quote_id`
4. Payment flow: App=createPaymentMethod / Web=confirmCardSetup+setupIntentId

TOP FILES TO INSPECT:
1. customer-app/app/(app)/book/index.tsx:handleBookNow — 修复端点+流程
2. customer-app/app/(app)/bookings/[id].tsx:DRIVER_STATUS — 修复大小写
3. customer-app/app/(app)/book/checkout.tsx — 补充字段+3DS处理
4. customer-app/app/(app)/book/cars.tsx — 废弃屏幕，建议删除
5. Chauffeur-SaaS/src/customer-portal/customer-portal.controller.ts — 确认 /bookings endpoint 接受 paymentMethodId
6. Chauffeur-SaaS/src/customer-portal/customer-portal.service.ts — 确认 guestCheckout 和 createBooking 的 DTO 支持 App 的 payload

CONFIRMED ALIGNED:
✅ Quote API payload (snake_case, all fields present)
✅ Auth flow (both use /customer-auth/* with same JWT)
✅ Bookings list API (/customer-portal/bookings)
✅ Cancel booking API (/customer-portal/bookings/:id/cancel)
✅ Push notification deep link (booking_id in notification data)
✅ Tenant slug via X-Tenant-Slug header

UNCERTAIN (未读到完整实现):
? /customer-portal/guest/checkout DTO 是否接受 App 发送的 payload 结构
? 后端 /bookings 是否同时接受 paymentMethodId 和 setupIntentId
? App invoice screen 调用什么端点（未读到 invoices.tsx）
=== END HANDOFF ===
```

---

*报告由 OpenClaw 基于源码直接分析生成 | 2026-03-09*
