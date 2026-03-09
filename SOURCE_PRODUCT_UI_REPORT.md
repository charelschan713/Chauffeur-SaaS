# SOURCE_PRODUCT_UI_REPORT.md
**生成时间：** 2026-03-09  
**分析方式：** 基于源码直接审查（非假设）  
**语言：** 简体中文

---

## 1. 系统总览

### 实际系统结构

本系统是一个多租户豪华司机/礼宾车 SaaS 平台，由以下独立工程构成：

| 工程 | 路径 | 技术栈 | 部署 |
|------|------|--------|------|
| **NestJS 后端** | `/Chauffeur-SaaS/src/` | NestJS + TypeORM + Postgres | Railway |
| **客户门户** | `/Chauffeur-SaaS/apps/customer/` | Next.js 15 | Vercel |
| **管理后台** | `/Chauffeur-SaaS/apps/admin/` | Next.js 15 | Vercel |
| **司机门户** | `/Chauffeur-SaaS/apps/driver/` | Next.js 15 | 未知（可能 Vercel） |
| **报价嵌入 Widget** | `/Chauffeur-SaaS/apps/quote-widget/` | React + Vite | 静态 JS 嵌入 |
| **官网** | `/aschauffeur-elite-docs/` | React + Vite | 独立 Vercel 项目 |
| **iOS 原生司机 App** | `/asdriver-native/` | Swift/Xcode | TestFlight |

### 连接关系

```
官网 (aschauffeur.com.au)
  └── BookingWidget.tsx
      ├── GET /public/tenant-info
      ├── GET /public/service-types
      ├── POST /public/maps/route
      ├── POST /public/pricing/quote
      └── redirect → 客户门户 /book?quote_id=xxx

嵌入 Widget (quote-widget/)
  ├── 同上 API 调用
  └── redirect → https://book.{slug}.aschauffeured.com.au/book?params

客户门户 (apps/customer/)
  ├── /quote → 独立报价页面
  ├── /book → 接收 quote_id，完成预订 + 支付
  ├── /pay/[token] → 独立支付页面
  └── /bookings → 预订管理
  调用后端: /customer-portal/* /customer-auth/*

管理后台 (apps/admin/)
  ├── /(tenant)/* → 租户运营管理
  ├── /(platform)/* → 平台管理（仅3页）
  └── /admin/* → 第二套平台管理（重复，详见第8节）
  调用后端: /bookings/* /drivers/* /dispatch/* /platform/*

司机门户 (apps/driver/)
  ├── /jobs → 任务列表
  └── /invoices → 错误调用 /customer-portal/invoices ⚠️
  调用后端: /driver-app/*

iOS 司机 App
  └── 调用后端: /driver-app/* + APNs 推送通知

后端 (src/)
  ├── src/modules/ → 未注册的"备用模块"目录（不在 app.module.ts 中）⚠️
  └── src/ 下各模块 → 实际运行的业务逻辑
```

---

## 2. 端口与角色分析

### 2-A. 官网（aschauffeur-elite-docs）

**目的：** 品牌展示 + 流量入口  
**目标用户：** 访客、潜在客户  
**源码路径：** `/aschauffeur-elite-docs/src/`

**已实现功能：**
- Hero、服务介绍、车队标准、FAQ、合作伙伴、推荐语
- Cookie 同意、语言选择器、WhatsApp 浮钮
- 内嵌 `BookingWidget.tsx`（848行）— 完整的报价+车型选择流程

**缺失功能：**
- 无用户账户功能（正确，应由门户承担）
- Widget 的 `localToUtc()` 时区转换实现简单（直接 `new Date(str)`，未处理本地时区偏移）⚠️

**与系统连接：**  
Widget 将用户跳转至 `https://aschauffeured.chauffeurssolution.com/book?quote_id=xxx`  
这是**正确的单向跳转**，官网本身不持有交易状态。

---

### 2-B. 报价嵌入 Widget（apps/quote-widget）

**目的：** 可嵌入第三方网站的轻量报价组件  
**目标用户：** 合作商网站访客  
**源码路径：** `apps/quote-widget/src/`（3个文件，共360行）

**已实现功能：**
- 租户信息加载（品牌色、logo）
- 服务类型选择
- 路线计算（Google Maps via 后端）
- 多车型报价展示
- 跳转至客户门户 `/book?{params}`

**缺失功能：**
- 无返程支持
- 无中间站支持
- 无时区正确处理
- 跳转目标地址硬编码：`https://book.${slug}.aschauffeured.com.au` — **该 DNS 可能不存在**

**关键问题：**  
Widget redirect 使用 `sessionStorage.setItem('asc_quote_payload', JSON.stringify(payload))` 同时也发 URL 参数。但 sessionStorage 是**源隔离的**，跨域跳转后 sessionStorage 数据丢失，实际只能依靠 URL 参数。

---

### 2-C. 客户门户（apps/customer）

**目的：** 客户完整预订、支付、管理平台  
**目标用户：** 注册客户 + 访客  
**源码路径：** `apps/customer/app/`

**已实现功能：**
- 登录/注册/忘记密码/邮箱验证
- 独立报价页面（`/quote`，739行完整实现）
- 预订创建页（`/book`，1587行）
- 支付页（`/pay/[token]`，437行）
- 预订列表、预订详情
- 乘客管理（`/passengers`，427行）
- 支付方式管理（`/payment-methods`）
- 会员折扣展示（`LoyaltyBanner`）
- 3DS 卡验证流程

**缺失/有问题功能：**
- `/dashboard/page.tsx` 仅10行（只是 Suspense 包装，实际内容在 `DashboardClient.tsx`）
- `/booking-confirmed/[reference]/page.tsx` 是静态展示页，**无实际数据获取**（ref 从 URL 读取，不从后端验证）
- `/invoices/page.tsx` 存在但调用 `/customer-portal/invoices`（后端是否有此端点需确认）
- `/onboard/page.tsx` — 邀请注册页（OnboardClient.tsx 未读到）
- 状态映射不完整：`BookingDetailClient.tsx` 有 `DRIVER_EN_ROUTE`/`IN_PROGRESS`/`DRIVER_ARRIVED` 等状态，但后端 `operational_status` 枚举实际是 `assigned/accepted/on_the_way/arrived/job_done/fulfilled`，**前后端状态名不对齐** ⚠️

---

### 2-D. 管理后台（apps/admin）

**目的：** 租户运营管理 + 平台超管  
**目标用户：** 租户管理员、平台管理员  
**源码路径：** `apps/admin/app/`

**已实现功能（tenant 层）：**
- 仪表板
- 预订管理（列表+详情+新建）
- 调度（dispatch — 分配司机）
- 客户管理
- 司机管理（列表+详情+文件上传）
- 定价（车型/服务类型/附加费/停车场）
- 折扣管理
- 发票管理（CUSTOMER/PARTNER 两类）
- 设置（品牌/城市/通知/模板/集成）

**已实现功能（platform 层）：**
- 平台概览（3个指标卡）
- 租户列表

**问题：**
- `apps/admin/app/(platform)/*` 和 `apps/admin/app/admin/*` 是**双轨平台管理**，内容高度重叠（见第8节）
- `ComingSoon` 包裹的功能：`Mark Completed`、`View Invoice`（已注释 "no endpoint yet"）
- `PaymentModal` 内 `handleChargeNow` 调用 `/bookings/:id/charge`（已在 P0-A 中修复）
- 发票关联预订的入口从"View Invoice"按钮触发，但该按钮被 `ComingSoon` 禁用

---

### 2-E. 司机门户（apps/driver）

**目的：** Web 端司机任务管理  
**目标用户：** 司机  
**源码路径：** `apps/driver/app/`

**已实现功能：**
- 登录/忘记密码/重置密码/邮箱验证
- 仪表板（当前活跃任务概览）
- 任务列表（upcoming/active/completed 三个 tab）
- 任务详情 + 状态流转（6步，从 assigned → job_done）
- 个人资料页
- 发票页（有 UI 但 API 调用错误）

**严重问题：**
- `apps/driver/app/invoices/page.tsx` 调用 `/customer-portal/invoices`，**这是客户门户的端点**，不是司机发票 ⚠️ BROKEN
- `apps/driver/app/layout.tsx` 的 `metadata.title` 写的是 "Customer Portal"，非司机门户 ⚠️
- 无"拒绝任务"功能（仅有接受流程）
- 无上传文档功能（driver profile 页在 admin 里）
- 无导航联系功能（无地图跳转、无电话拨号）

---

### 2-F. 平台超管

**目的：** 管理所有租户、配置平台规则  
**目标用户：** 平台运营人员  
**源码路径：** `apps/admin/app/(platform)/` + `apps/admin/app/admin/`

**已实现功能：**
- 3个指标卡（活跃租户数、今日预订、今日完成）
- 租户列表

**严重缺失：**
- 无租户创建/配置界面
- 无司机/公司审核功能
- 无平台级别规则设置
- 无审计日志
- 双轨路由（`/(platform)/` vs `/admin/`）重复且不一致（见第8节）

---

## 3. UI 页面地图

### 客户门户（apps/customer）

| 路由 | 用途 | 状态 | 重要组件 |
|------|------|------|---------|
| `/` | 根页，redirect `/login` | ✅ 完整 | — |
| `/login` | 登录 | ✅ 完整 | InlineLoginForm |
| `/register` | 注册 | ✅ 完整 | — |
| `/forgot-password` | 忘记密码 | ✅ 完整 | — |
| `/reset-password` | 重置密码 | ✅ 完整 | — |
| `/verify-email` | 邮箱验证 | ✅ 完整 | — |
| `/onboard` | 邀请注册 | ⚠️ 部分 | OnboardClient |
| `/dashboard` | 仪表板 | ⚠️ 部分（DashboardClient 需确认） | DashboardClient |
| `/quote` | 报价页 | ✅ 完整（739行，完整实现） | QuoteClient |
| `/book` | 预订+支付 | ✅ 复杂（1587行）| BookPageClient, CardSetupForm, AuthGate |
| `/booking-confirmed/[reference]` | 预订成功 | ⚠️ 静态展示，无数据验证 | — |
| `/bookings` | 预订列表 | ✅ 完整 | — |
| `/bookings/[id]` | 预订详情 | ⚠️ 状态名与后端不对齐 | BookingDetailClient |
| `/pay/[token]` | 独立支付页 | ✅ 完整 | SavedCardForm, NewCardForm |
| `/payment-methods` | 支付方式管理 | ✅ 完整 | — |
| `/passengers` | 乘客管理 | ✅ 完整（427行） | — |
| `/invoices` | 发票 | ⚠️ UI存在，API待确认 | — |
| `/profile` | 个人资料 | ⚠️ 需确认 | — |
| `/no-tenant` | 无租户 | ✅ 占位页 | — |

### 管理后台（apps/admin）

| 路由 | 用途 | 状态 |
|------|------|------|
| `/(auth)/login` | 登录 | ✅ |
| `/(tenant)/dashboard` | 仪表板 | ✅ |
| `/(tenant)/bookings` | 预订列表 | ✅ |
| `/(tenant)/bookings/new` | 新建预订（1056行）| ✅ 完整 |
| `/(tenant)/bookings/[id]` | 预订详情（825行）| ⚠️ 含 ComingSoon 禁用按钮 |
| `/(tenant)/dispatch` | 调度分配（370行）| ✅ 完整 |
| `/(tenant)/customers` | 客户管理 | ✅ |
| `/(tenant)/drivers` | 司机列表 | ✅ |
| `/(tenant)/drivers/[id]` | 司机详情（585行）| ✅ 完整 |
| `/(tenant)/pricing/car-types` | 车型定价（519行）| ✅ |
| `/(tenant)/pricing/service-types` | 服务类型（379行）| ✅ |
| `/(tenant)/pricing/surcharges` | 附加费（333行）| ✅ |
| `/(tenant)/pricing/parking` | 停车费（187行）| ✅ |
| `/(tenant)/discounts` | 折扣管理 | ✅ |
| `/(tenant)/invoices` | 发票管理（164行）| ⚠️ 无导出功能 |
| `/(tenant)/vehicles` | 车辆管理 | ✅ |
| `/(tenant)/passengers` | 乘客管理 | ✅ |
| `/(tenant)/profile` | 账户资料 | ✅ |
| `/(tenant)/settings/*` | 设置（6个子页）| ✅ 较完整 |
| `/(platform)/overview` | 平台概览（43行）| ⚠️ 仅3个指标 |
| `/(platform)/tenants` | 租户列表（90行）| ⚠️ 仅列表，无CRUD |
| `/admin/*` | **与 /(tenant)/* 重复的平台路由** | ⚠️ 见第8节 |

### 司机门户（apps/driver）

| 路由 | 用途 | 状态 |
|------|------|------|
| `/login` | 登录 | ✅ |
| `/forgot-password` | 忘记密码 | ✅ |
| `/reset-password` | 重置密码 | ✅ |
| `/verify-email` | 邮箱验证 | ✅ |
| `/dashboard` | 仪表板 | ✅ |
| `/jobs` | 任务列表 | ✅ |
| `/jobs/[id]` | 任务详情+状态流转（159行）| ⚠️ 无拒绝，无联系客户 |
| `/bookings` | 预订（与 jobs 有重叠？）| ⚠️ 需确认差异 |
| `/bookings/[id]` | 预订详情 | ⚠️ 需确认 |
| `/invoices` | 司机发票 | ❌ 调用错误端点 BROKEN |
| `/profile` | 个人资料 | ✅ |
| `/no-tenant` | 无租户 | ✅ 占位 |

---

## 4. Booking Widget 专项分析

### 官网 Widget（BookingWidget.tsx，848行）

**Widget 源码路径：** `aschauffeur-elite-docs/src/components/booking/BookingWidget.tsx`  
**嵌入机制：** 直接作为 React 组件嵌入 `InstantQuote.tsx` section 中，非 iframe/外部 script

**数据采集：**
- 出发地/目的地（地址文本）
- 上车时间
- 乘客数量
- 服务类型
- 返程开关
- 中间站列表（waypoints）
- 婴儿座椅（infant/toddler/booster）

**API 调用顺序：**
1. `GET /public/tenant-info?tenant_slug=aschauffeured` → 租户信息
2. `GET /public/service-types?tenant_slug=aschauffeured` → 服务类型
3. `POST /public/maps/route` → 距离/时间计算
4. `POST /public/pricing/quote` → 多车型报价（snake_case 字段）

**跳转机制：**
```javascript
const params = new URLSearchParams({ quote_id: quoteId, car_type_id: selectedCarTypeId, slug: TENANT_SLUG });
window.location.href = `${SAAS_BOOKING_URL}/book?${params}`;
// SAAS_BOOKING_URL = "https://aschauffeured.chauffeurssolution.com"
```

**传递参数：** `quote_id`（后端 quote_session UUID）+ `car_type_id` + `slug`

**责任边界判断：** ✅ **正确**。官网 Widget 只负责报价展示和跳转，不持有交易状态，不收集支付信息。是**纯入口层**。

**UI 完整度：** 高（有车型卡片、价格明细、折扣展示、倒计时）

**UX 风险：**
- `localToUtc()` 时区处理不正确（`new Date(localDatetime)` 使用浏览器本地时区，而非租户所在时区）
- 有效期倒计时后重新报价无提示

---

### 嵌入 Widget（apps/quote-widget，327行）

**源码路径：** `apps/quote-widget/src/Widget.tsx`  
**嵌入机制：** Vite 打包为独立 JS，`<script>` 标签嵌入第三方网站

**关键差异（对比官网 Widget）：**
- 无返程支持
- 无婴儿座椅
- 跳转目标：`https://book.${slug}.aschauffeured.com.au`（⚠️ 该域名格式是否实际存在？）
- `sessionStorage` 存储 quote payload（跨域后失效，有冗余）

**责任边界：** ✅ 纯入口层，正确

---

## 5. 客户门户专项分析（apps/customer）

### 完整流程追踪

**A. 报价流程（/quote）：**
1. 加载城市列表 → 服务类型 → 车型
2. 用户填写 → `POST /public/pricing/quote` → 展示多车型报价
3. 点击 Book Now → `router.push('/book?quote_id=xxx&car_type_id=xxx')`

**B. 预订创建流程（/book）：**
1. 读取 `quote_id`（URL params → sessionStorage → quoteIdRef）
2. 步骤：`loading → auth → login/guest → details → done`
3. `AuthGate`：已登录 / 登录 / 访客三选一
4. 访客 OTP 验证：`POST /customer-auth/guest-send-otp`
5. 完成 Stripe 卡设置（`confirmCardSetup`）
6. `POST /customer-portal/bookings`（含 quoteId + paymentMethodId 或 setupIntentId）
7. 服务端返回 `paymentToken` → 跳转 `/pay/{token}`

**C. 支付流程（/pay/[token]）：**
1. `GET /customer-portal/payments/token/:token` → 获取预订信息、已保存卡
2. 已保存卡：`POST /customer-portal/payments/token/:token/pay`
3. 新卡：`stripe.createPaymentMethod` → `POST .../pay`
4. `requires_action` → `stripe.handleNextAction({clientSecret})` → `POST .../confirm-3ds`
5. 成功 → SuccessScreen

**D. 3DS 流程：**
- `/book` 页面：使用 `confirmCardSetup`（保存卡 + 3DS）
- `/pay/[token]` 页面：使用 `createPaymentMethod` → `handleNextAction`
- 两套不同的 3DS 实现路径 ⚠️

**E. 订单管理流程：**
- `/bookings`：列表，仅显示状态和基本信息，点击跳转详情
- `/bookings/[id]`：有取消按钮（`POST /customer-portal/bookings/:id/cancel`）

**UI/UX 质量问题：**
1. **状态标签不对齐：** `BookingDetailClient.tsx` 定义了 `DRIVER_EN_ROUTE`/`IN_PROGRESS`/`DRIVER_ARRIVED`，但后端枚举实际是 `on_the_way`/`arrived`/`passenger_on_board`，客户看到的状态标签永远不会匹配 ⚠️
2. **booking-confirmed 页静态：** 没有从后端拉取预订详情，仅显示 URL 中的 reference，无法验证预订是否真正成功
3. **倒计时未对 quote 过期后重新报价做引导**
4. **访客 OTP 流程复杂：** 3个子状态 `prompt/otp/done`，UX 断裂感强

---

## 6. 管理后台专项分析（apps/admin）

### 预订管理
- **列表页：** 有状态过滤、搜索、分页，显示 operational_status + driver_execution_status + payment_status
- **新建预订：** 1056行，完整的报价+车型选择+客户关联流程
- **详情页：** 825行，含：
  - 分配司机（AssignDriverModal）
  - 分配合作伙伴（AssignPartnerModal）
  - 支付操作（PaymentModal）—— 含 Mark Paid / Send Payment Link / Charge Now
  - 取消预订
  - 额外费用报告查看
  - `ComingSoon` 禁用：Mark Completed、View Invoice

### 调度（dispatch）
- 显示待分配预订列表 + 可用司机列表
- 点击分配 → `POST /dispatch/assign`
- 返回预订详情页并显示成功 toast
- **缺失：** 实时地图/追踪、自动匹配、批量分配

### 定价管理
- 4个子页面（车型/服务类型/附加费/停车费）
- 服务类型页支持中间站收费开关（waypoint_charge_enabled）
- **缺失：** 节假日加价规则、时段加价 UI

### 发票管理
- CUSTOMER / PARTNER 两种类型
- 有状态管理（DRAFT/SENT/PAID/OVERDUE/VOID）
- **缺失：** PDF 导出、发送邮件、批量操作

### 司机管理
- 列表：显示在线状态、车辆、邀请状态
- 详情：个人信息编辑 + 证件到期日提醒（ExpiryBadge）+ 排班日历（周视图）
- **缺失：** 文件上传状态审核、地图实时位置

---

## 7. 司机 App / 门户专项分析

### iOS 原生 App（asdriver-native）
- 多租户支持（公司码登录）
- 任务列表 + 详情 + 状态流转（6步）
- 额外费用提交（SubmitExtraView）
- APNs 推送通知（ES256 JWT，已配置）
- 深度链接（dispatch push → 打开任务详情）
- 已上传 TestFlight Build 31

### Web 司机门户（apps/driver）

**登录流程：** 邮箱/密码 → `POST /driver-app/login`（推测）  
**任务流程：**
- 列表：`GET /driver-app/assignments?filter=upcoming/active/completed`
- 详情：显示状态流、6步按钮流（assigned → accepted → on_the_way → arrived → passenger_on_board → job_done）
- 状态更新：`PATCH /driver-app/assignments/:id/status`（推测）

**严重问题：**
1. **发票页调用 `/customer-portal/invoices`** — 这是客户门户端点，司机调用此端点可能会返回空或 401 ❌
2. **`layout.tsx` title 写"Customer Portal"** — 代码是从客户门户 fork 来的，未改 metadata
3. **无拒绝任务功能** — 仅有 Accept Job，没有 Decline
4. **无客户联系入口** — 任务详情无打电话按钮，无导航跳转
5. **`/bookings/*` 路由** — 与 `/jobs/*` 路由功能似乎重叠，但 `/bookings/[id]/page.tsx` 仅11行（是 shell），实际内容不明

---

## 8. 平台超管专项分析

### 双轨路由问题

管理后台存在**两套平台管理路由**：

| 路由 | 路径 | 内容 |
|------|------|------|
| `/(platform)/overview` | Next.js route group | 3个 metrics 卡，调用 `/platform/metrics` |
| `/(platform)/tenants` | Next.js route group | 租户列表，调用 `/platform/tenants` |
| `/admin/dashboard` | 扁平路由 | 相同 metrics 查询，额外有预订列表 |
| `/admin/tenants` | 扁平路由 | 相同租户列表 |
| `/admin/bookings` | 扁平路由 | 调用 `/platform/bookings` |
| `/admin/drivers` | 扁平路由 | 与 `/(tenant)/drivers` 重叠 |
| `/admin/pricing` | 扁平路由 | 与 `/(tenant)/pricing/*` 重叠 |
| `/admin/dispatch` | 扁平路由 | 与 `/(tenant)/dispatch` 重叠 |

**结论：** `/admin/*` 是早期占位或遗留路由，与 `/(tenant)/*` + `/(platform)/*` 高度重叠。两套路由同时存在，没有明确的权限区分，容易混淆。

### 实际实现 vs 产品意图

| 功能 | 实现状态 |
|------|---------|
| 查看所有租户 | ⚠️ 列表存在，无 CRUD |
| 创建/修改租户 | ❌ 未实现 |
| 租户配额/规则 | ❌ 未实现 |
| 司机/公司审核 | ❌ 未实现 |
| 平台级审计日志 | ❌ 未实现 |
| 平台收入报表 | ❌ 未实现 |
| 安全/API 密钥管理 | ❌ 未实现 |

---

## 9. 功能完成度矩阵

| 功能 | 模块 | 状态 | 证据 | 备注 |
|------|------|------|------|------|
| 多租户架构 | 后端 | ✅ COMPLETE | TenantContextMiddleware, tenant_id 全局过滤 | — |
| 客户注册/登录 | customer | ✅ COMPLETE | customer-auth 模块，JWT | — |
| 报价流程 | customer/widget | ✅ COMPLETE | /public/pricing/quote | snake_case 字段约定需文档化 |
| 预订创建（已登录） | customer | ✅ COMPLETE | POST /customer-portal/bookings | — |
| 预订创建（访客） | customer | ✅ COMPLETE | guest checkout + OTP | — |
| 支付（非3DS） | customer | ✅ COMPLETE | payViaToken E2E 已验证 | — |
| 支付（3DS） | customer | ✅ COMPLETE | confirm3ds E2E 已验证 | — |
| 手动 Capture | admin | ✅ COMPLETE | chargeNow P0-A 修复后 | — |
| 部分/全额退款 webhook | 后端 | ✅ COMPLETE | charge.refunded E2E 已验证 | — |
| 管理员调度分配 | admin | ✅ COMPLETE | dispatch 页面完整 | — |
| 司机状态流转（Web） | driver | ✅ COMPLETE | 6步流转 | — |
| 司机状态流转（iOS） | iOS | ✅ COMPLETE | TestFlight Build 31 | — |
| APNs 推送通知 | 后端+iOS | ✅ COMPLETE | Railway env vars 已配置 | DB token 注册待验证 |
| 定价引擎（P2P/计时/返程） | 后端 | ✅ COMPLETE | pricing.resolver.ts 381行 | — |
| 折扣/会员层级 | 后端+customer | ✅ COMPLETE | DiscountResolver + LoyaltyBanner | — |
| 中间站收费开关 | admin+后端 | ✅ COMPLETE | waypoint_charge_enabled DB列 | — |
| 过路费/停车费 | 后端 | ✅ COMPLETE | 不可折扣，在 grand_total 中独立 | — |
| 通知系统（邮件/SMS） | 后端 | ✅ COMPLETE | notification.service.ts 1411行 | — |
| 预订列表（客户） | customer | ✅ COMPLETE | /bookings 页面 | — |
| 预订取消（客户） | customer | ✅ COMPLETE | /cancel 端点 | — |
| 司机发票 Web | driver | ❌ BROKEN | 调用 /customer-portal/invoices | 端点错误 |
| 客户发票 | customer | ⚠️ PARTIAL | UI 存在，后端端点待确认 | — |
| 管理员发票 | admin | ⚠️ PARTIAL | UI 完整，无 PDF/批量 | — |
| Mark Completed | admin | ❌ PLACEHOLDER | ComingSoon 包裹，注释"no endpoint yet" | — |
| View Invoice（从预订） | admin | ❌ PLACEHOLDER | ComingSoon 包裹 | — |
| 平台租户 CRUD | platform | ❌ NOT FOUND | 仅列表 | — |
| 平台审计 | platform | ❌ NOT FOUND | — | — |
| 司机拒绝任务 | driver | ❌ NOT FOUND | — | — |
| 实时地图追踪 | 全部 | ❌ NOT FOUND | — | — |
| 司机联系客户入口 | driver | ❌ NOT FOUND | — | — |
| booking-confirmed 数据验证 | customer | ⚠️ PARTIAL | 静态页，无后端验证 | — |
| Connect 模式 Stripe | 后端 | ⚠️ PARTIAL | 代码审查通过，无 E2E | — |
| 客户状态标签与后端对齐 | customer | ❌ BROKEN | 前端枚举与后端不匹配 | — |

---

## 10. 关键业务流分析

### 流程 A：官网 → Widget → 客户门户

```
官网 hero 点击 "Get Quote"
  → BookingWidget.tsx 内联渲染
  → 用户填写表单
  → POST /public/pricing/quote (snake_case 字段)
  → 展示车型报价 + 折扣
  → 点击 Book Now
  → window.location.href = "https://aschauffeured.chauffeurssolution.com/book?quote_id=xxx&car_type_id=xxx&slug=aschauffeured"
  → 客户门户 /book 页面接收 quote_id
```

**风险：** quote_id 传递依赖 URL 参数，若 URL 被截断（某些短信平台）则丢失，需 sessionStorage 兜底（但已跨域，实际失效）。

### 流程 B：报价 → 预订

```
/book 接收 quote_id
  → GET /customer-portal/quote-sessions/:id (加载报价快照)
  → 用户选择授权（登录/注册/访客）
  → 获取 stripePublishableKey (GET /stripe-config-by-slug)
  → 渲染 CardSetupForm (Stripe Elements)
  → stripe.confirmCardSetup() → setupIntentId
  → POST /customer-portal/bookings {quoteId, vehicleClassId, setupIntentId, ...}
  → 后端：验证 quoteSession 未过期 → 计算 trustedPrice → 创建 booking → 返回 paymentToken
  → 前端：redirect /pay/{paymentToken}
```

**注意：** 后端在此步骤**不直接收取付款**，只创建预订并返回支付 token。

### 流程 C：预订 → 支付

```
/pay/[token]
  → GET /customer-portal/payments/token/:token (获取金额、已保存卡)
  → 用户选择卡片或输入新卡
  → POST /customer-portal/payments/token/:token/pay {paymentMethodId}
  → 后端：payViaToken() → stripe.paymentIntents.create() → PI
  → 若 status=succeeded: 直接成功
  → 若 status=requires_action: 返回 clientSecret
    → stripe.handleNextAction({clientSecret}) → 3DS 认证
    → POST .../confirm-3ds {paymentIntentId}
    → 后端：confirm3ds() → markBookingPaid()
```

### 流程 D：支付 → Webhook → 状态同步

```
Stripe PI 状态变化
  → POST /webhooks/stripe (平台 STRIPE_WEBHOOK_SECRET 验证)
  → payment_intent.succeeded → handleIntentSucceeded()
     → UPDATE payments SET status=PAID
     → UPDATE bookings SET payment_status=PAID, operational_status=CONFIRMED
     → outbox: PaymentCaptured PUBLISHED
  → charge.captured → handleCaptured()
     → UPDATE payments SET status=PAID, amount_captured_minor
     → UPDATE bookings SET payment_status=PAID
  → charge.refunded → handleRefunded()
     → 根据 amount_refunded: PARTIALLY_REFUNDED 或 REFUNDED
  → payment_intent.payment_failed → handleFailed()
     → UPDATE payments SET status=FAILED
     → UPDATE bookings SET payment_status=FAILED
     → operational_status 不变 ✅
```

### 流程 E：Admin → 调度

```
Admin 预订详情页
  → 点击 "Assign Driver" → AssignDriverModal
  → GET /dispatch/available-drivers (可用司机列表)
  → 选择司机
  → POST /dispatch/assign {bookingId, driverId}
  → booking.operational_status → CONFIRMED/DRIVER_ASSIGNED
  → 司机收到 APNs/Expo 推送通知
```

### 流程 F：司机 → 完成服务

```
iOS App (或 Web driver portal)
  → 接收推送通知 → 打开任务详情
  → 状态流：assigned → accepted → on_the_way → arrived → passenger_on_board → job_done
  → job_done → SubmitExtraView (额外费用上报)
  → 后端 onJobCompleted() → 触发自动状态流转
  → bookings.operational_status → fulfilled
```

### 流程 G：管理员手动 Capture

```
Admin 预订详情 → PaymentModal → "Charge Now"
  → POST /bookings/:id/charge
  → 后端 chargeNow():
     → 验证 payment_status=AUTHORIZED
     → paymentService.capturePayment()
     → stripe.paymentIntents.capture()
     → payments.payment_status = CAPTURE_PENDING
  → charge.captured webhook → PAID
```

### 流程 H：退款

```
目前只有 Stripe API 直接触发的 webhook 路径经过验证。
Admin UI 中无直接"退款"按钮（PaymentModal 没有 Refund 选项）。
/bookings/:id/settle 端点存在但功能待确认。
```

---

## 11. UI/UX 风险清单

| # | 风险 | 位置 | 严重度 |
|---|------|------|--------|
| 1 | **客户端状态名与后端枚举不对齐** | `BookingDetailClient.tsx` | 🔴 P0 |
| 2 | **司机发票页调用错误 API** | `driver/app/invoices/page.tsx` | 🔴 P0 |
| 3 | **booking-confirmed 页无数据验证** | `booking-confirmed/[reference]/page.tsx` | 🟡 P1 |
| 4 | **嵌入 Widget 跳转域名格式** (`book.${slug}.aschauffeured.com.au`) 可能404 | `quote-widget/src/Widget.tsx:145` | 🟡 P1 |
| 5 | **双轨平台管理路由混乱** | `admin/app/(platform)/*` vs `/admin/*` | 🟡 P1 |
| 6 | **时区处理不正确** (官网 Widget `localToUtc`) | `BookingWidget.tsx` | 🟡 P1 |
| 7 | **ComingSoon 禁用功能** 无任何说明或 ETA | admin booking detail | 🟡 P1 |
| 8 | **`src/modules/` 目录不在 app.module.ts 中** — 25个模块目录是否为遗留代码 | `src/modules/` | 🟡 P1 |
| 9 | **sessionStorage quote payload 跨域失效** | Widget.tsx:143-148 | 🟡 P1 |
| 10 | **司机门户 layout.tsx title 写"Customer Portal"** | `driver/app/layout.tsx` | 🟢 P2 |
| 11 | **Admin `/admin/*` 与 `/(tenant)/*` 路由重叠** | admin | 🟡 P1 |
| 12 | **PaymentModal 缺少 Refund 入口** — 退款只能通过 Stripe Dashboard | admin | 🟡 P1 |
| 13 | **无管理员创建租户 UI** | platform | 🟡 P1 |
| 14 | **quote API 字段命名 snake_case 约定未文档化** — camelCase 静默返回 total=0 | 后端 | 🟡 P1 |
| 15 | **访客 OTP 流程 UX 断裂** — 3个子状态无进度指示 | `/book` | 🟢 P2 |
| 16 | **`/book` 和 `/pay` 使用两套不同的 3DS 实现** | customer portal | 🟡 P1 |
| 17 | **iOS App Bundle ID 拼写** `com.aschauffeured.driver`（多了一个 e）| iOS | 🟢 P2 |
| 18 | **司机门户无拒绝任务功能** | driver | 🟢 P2 |
| 19 | **Admin 无 Refund 操作入口** | admin | 🟡 P1 |
| 20 | **Admin `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`** 在 Vercel 未设置（.env.local gitignored）| admin | 🟡 P1 |

---

## 12. 架构边界判断

| 边界 | 判断 | 说明 |
|------|------|------|
| **纯营销网站** | `aschauffeur-elite-docs/` | 正确 — 无交易状态，无敏感数据 |
| **纯 Widget（入口层）** | `aschauffeur-elite-docs/src/components/booking/BookingWidget.tsx` | 正确 — 只做报价和跳转 |
| **嵌入 Widget** | `apps/quote-widget/` | 正确 — 轻量入口 |
| **权威交易前端** | `apps/customer/` | ✅ 正确 — 预订创建和支付在此完成 |
| **管理员专属** | `apps/admin/app/(tenant)/*` | ✅ 正确 |
| **平台专属** | `apps/admin/app/(platform)/*` | ⚠️ 与 `/admin/*` 重叠，边界不清 |
| **司机专属** | `apps/driver/` + iOS App | ⚠️ 司机门户 Web 与 iOS App 功能重叠 |
| **Source of Truth 违反** | `booking-confirmed` 页面 | ❌ 前端自行展示 reference，不验证后端状态 |
| **Source of Truth 违反** | `apps/driver/invoices` | ❌ 调用了错误端点，数据来源错误 |
| **遗留死代码** | `src/modules/*`（25个目录）| 疑似未注册的遗留模块，需排查 |
| **payments 是 source of truth** | 后端 | ✅ 已正确实现，bookings 同步自 payments |

---

## 13. 最重要的 20 个问题

| # | 严重度 | 模块 | 问题描述 | 影响 |
|---|--------|------|---------|------|
| 1 | 🔴 P0 | 客户门户 | **状态枚举不对齐**：前端 `DRIVER_EN_ROUTE`/`IN_PROGRESS` vs 后端 `on_the_way`/`arrived`，客户永远看不到正确的"司机已出发"状态 | 用户体验严重受损 |
| 2 | 🔴 P0 | 司机门户 | **发票页调用错误 API** (`/customer-portal/invoices`)，司机无法查看自己的发票 | 功能完全不可用 |
| 3 | 🟡 P1 | 架构 | **`src/modules/` 25个目录**完全不在 `app.module.ts` 中 — 是遗留死代码还是未来模块？不清楚 | 混淆架构理解，维护风险 |
| 4 | 🟡 P1 | 管理后台 | **双轨平台路由**：`/(platform)/*` 和 `/admin/*` 内容高度重叠，无权限隔离 | 可能绕过权限 |
| 5 | 🟡 P1 | 管理后台 | **PaymentModal 无退款入口**：管理员无法从 UI 发起退款，只能通过 Stripe Dashboard | 运营效率低 |
| 6 | 🟡 P1 | 管理后台 | **ComingSoon 禁用功能**："Mark Completed"和"View Invoice"无任何 ETA | 运营流程断裂 |
| 7 | 🟡 P1 | 嵌入 Widget | **跳转域名**`book.${slug}.aschauffeured.com.au` 实际可能 404 | 外部用户无法完成预订 |
| 8 | 🟡 P1 | 客户门户 | **两套 3DS 实现路径**：`/book` 用 `confirmCardSetup`，`/pay` 用 `handleNextAction`，一致性差 | 维护困难，潜在 bug |
| 9 | 🟡 P1 | 客户门户 | **booking-confirmed 静态页**：无后端验证，reference 来自 URL，用户不知道预订是否真正成功 | 用户信任度问题 |
| 10 | 🟡 P1 | 后端 | **quote API snake_case 约定**：传 camelCase 静默返回 total=0，无报错 | 集成方风险 |
| 11 | 🟡 P1 | 后端 | **Webhook 仅支持平台 STRIPE_SECRET_KEY**：多租户场景下，Connect 账户的 webhook 无法单独验证 (BUG-012) | 多租户支付安全 |
| 12 | 🟡 P1 | 后端 | **BUG-013: `waypoint_charge_enabled` 代码默认 true**：DB 默认 false，代码 fallback 是 true，新租户行为不一致 | 错误收费风险 |
| 13 | 🟡 P1 | 客户门户 | **BUG-010: `guestBaseFare` 计算错误**：返程 `base_calculated_minor` 未定义时 fallback 错误 | 返程报价计算错误 |
| 14 | 🟡 P1 | 后端 | **BUG-011: 价格篡改防护缺失**：`total_price_minor` 从 DTO 读取，未服务端重算（已知设计，待修复） | 安全漏洞 |
| 15 | 🟡 P1 | 平台 | **无租户管理 UI**：无法从 Admin 创建/修改/删除租户，只能直接操作 DB | SaaS 运营不可行 |
| 16 | 🟢 P2 | 司机门户 | **无拒绝任务功能**，司机只能接受，无法拒绝 | 司机体验差 |
| 17 | 🟢 P2 | 司机门户 | **无联系客户入口**：任务详情没有拨号按钮 | 运营基础功能缺失 |
| 18 | 🟢 P2 | 管理后台 | **无实时地图/追踪**：调度页面无地图可视化 | 运营可见性低 |
| 19 | 🟢 P2 | 后端 | **APNs token 注册**：所有用户 `apns_token=NULL`，推送实际无法到达 | 推送通知不可用 |
| 20 | 🟢 P2 | 时区 | **`localToUtc()` 时区处理**：官网 Widget 使用浏览器时区而非租户时区 | 国际用户预订时间错误 |

---

## 14. CHATGPT_SOURCE_REVIEW_HANDOFF

```
=== CHATGPT SOURCE REVIEW HANDOFF ===

系统概述：
多租户豪华司机 SaaS 平台 (ASChauffeured / Chauffeur Solutions)
后端: NestJS + Postgres (Railway)
前端: 客户门户 + 管理后台 + 司机门户 (Next.js, Vercel)
移动端: iOS 原生 App (Swift, TestFlight)

已验证可用的核心流程：
✅ Quote (公开 API) → Booking (POST) → Payment (payViaToken/3DS) → Webhook 同步
✅ Admin dispatch → 司机推送通知
✅ Manual capture (chargeNow) → charge.captured webhook → PAID
✅ Partial refund → Full refund via webhook

架构边界：
- 官网/Widget: 纯入口层，正确设计
- 客户门户: 权威交易前端，包含支付逻辑
- 管理后台: 运营层，存在双轨路由问题
- 司机门户 Web: 功能不完整，发票 API 错误
- iOS App: 主要司机工作流，比 Web 完善
- src/modules/: 25个目录未注册，疑似遗留

最高优先级问题（建议 ChatGPT 重点审查）：
1. 前后端状态枚举不对齐（最直接的用户体验 bug）
   - 前端: DRIVER_EN_ROUTE / IN_PROGRESS / DRIVER_ARRIVED
   - 后端: on_the_way / arrived / passenger_on_board
   - 文件: apps/customer/app/bookings/[id]/BookingDetailClient.tsx

2. 司机发票 API 错误
   - 文件: apps/driver/app/invoices/page.tsx:12
   - 错误: /customer-portal/invoices → 应为 /driver-app/invoices 或 /invoices

3. quote API snake_case 约定（传 camelCase 静默返回 0）
   - 文件: src/public/public.controller.ts (quote endpoint)
   - 涉及: 所有调用 /public/pricing/quote 的前端

4. BUG-011 价格篡改（DTO 价格未服务端验证）
   - 文件: src/customer-portal/customer-portal.service.ts (createBooking)
   
5. 双轨管理路由权限隔离
   - 文件: apps/admin/app/(platform)/* vs apps/admin/app/admin/*

需要 ChatGPT 深入审查的文件：
- apps/customer/app/bookings/[id]/BookingDetailClient.tsx (状态枚举对齐)
- apps/driver/app/invoices/page.tsx (API 端点修复)
- src/customer-portal/customer-portal.service.ts (price authority + guest flow)
- apps/admin/app/(tenant)/bookings/[id]/page.tsx (ComingSoon + refund flow)
- src/modules/ (是否为死代码，可否清理)
- apps/admin/app/admin/* (是否可以删除或与 /(platform)/* 合并)

需要 ChatGPT 回答的问题：
Q1: src/modules/ 内的25个模块是否真的未使用？是否有 dynamic import 或别名引用？
Q2: /admin/* 路由是否有独立的权限守卫与 /(platform)/* 区分？
Q3: 前端 BookingDetailClient.tsx 的状态枚举是否应该反映后端 driver execution status，而非 operational status？
Q4: /pay/[token] 页面的 3DS 流程（handleNextAction）与 /book 页面（confirmCardSetup）的两套实现有何风险？
Q5: APNs token 注册流程（POST /driver-app/apns-token）在 iOS App 中何时调用？是否有 onMount 注册？
=== END HANDOFF ===
```

---

*报告由 OpenClaw 基于源码直接分析生成 | 2026-03-09*
