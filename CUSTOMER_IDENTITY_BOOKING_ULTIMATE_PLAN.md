# CUSTOMER_IDENTITY_BOOKING_ULTIMATE_PLAN.md

> 版本：v1.0 | 状态：设计草案 | 日期：2026-03-09  
> 性质：架构设计文档，**本文件不包含代码改动指令**  
> 语言：简体中文（代码/字段/路径保留英文）

---

## 1. 最终目标总结

### 期望的客户体验

用户无论从哪个入口接触品牌，都应感受到**连贯的单一身份体验**：

| 用户行为 | 期望结果 |
|---------|---------|
| 在官网获取报价，中途跳转登录 | 登录后自动回到报价，不丢失草稿 |
| 点击官网账户图标 | 看到与 portal 实时一致的登录态 |
| 在 portal 完成登录，再回官网 | 官网账户图标立即反映已登录 |
| App 登录后继续 web 未完成的预订 | 状态查询一致（backend 是唯一数据源）|
| 在任意界面点击「My Bookings」 | 直达同一份预订列表，无重复登录 |
| 登出 | 所有界面同步清除，跳回未登录态 |

### 核心设计原则

1. **Backend = 唯一数据源**：quote session、booking、payment 全部以 Railway NestJS 为准
2. **Portal = 唯一账户交易层**：登录、支付、预订管理只在 portal 发生
3. **官网 = 营销 + 入口层**：官网只做引导，不托管账户状态
4. **App = 独立渠道**：App 有自己的 JWT token，与 portal web 共享 backend API
5. **跨域身份 = JWT token，不依赖 cookie**：避免 SameSite 限制

---

## 2. 统一身份体系设计

### 现状分析

| 层 | 当前 auth 机制 | 存储位置 | 问题 |
|----|--------------|---------|------|
| 官网 (`aschauffeured.com.au`) | Supabase Auth（独立项目 `spocngezqdxgezwkdrby`）| Supabase session cookie | 与 portal 完全隔离 |
| Portal (`aschauffeured.chauffeurssolution.com`) | NestJS JWT (`/customer-auth/login`) | `localStorage.customer_token` | 只在 portal 域可读 |
| App (native) | NestJS JWT | `SecureStore` | 独立，正确 |

**核心问题**：官网 Supabase Auth 和 portal NestJS JWT 是两套完全独立的系统，无共享机制。

### 最终目标架构

```
官网域                          Portal 域
aschauffeured.com.au           aschauffeured.chauffeurssolution.com
      │                                    │
      │  1. Get quote (API call)           │
      │──────────────────────────────────► │ Railway NestJS
      │                                    │   /public/pricing/quote
      │  2. 跳转 portal                    │
      │  /login?redirect=X                 │
      │─────────────────────────────────── ►│ portal login
      │                                    │   写入 localStorage.customer_token
      │  3. portal 登录成功                │
      │     → redirect 回 /book?quote_id=  │
      │                                    │
      │  4. 官网如何感知登录态？            │
      │     → postMessage / 共享 subdomain │
      │       cookie（见 Phase A 方案）    │
```

### 身份统一方案（最终目标）

**方案：Portal 登录后写入共享子域 Cookie**

```
当前 portal 存储：localStorage（只在 portal 域）
目标：同时写入 httpOnly=false SameSite=None Secure cookie
       domain=.chauffeurssolution.com（或 .aschauffeured.com.au）
       name=asc_customer_logged_in  value=1（非 token，仅登录状态信号）
```

**官网检测逻辑（最终）：**

```typescript
// 官网 Header.tsx
const isLoggedIn = document.cookie.includes('asc_customer_logged_in=1');
```

**重要约束：**
- **不跨域传递 JWT token**：官网不应能读取 portal JWT（安全边界）
- **仅传递登录状态信号**：`asc_customer_logged_in=1` 只告知"已登录"，不暴露 token 内容
- **真实身份验证**：所有需要鉴权的操作都发生在 portal 域

### 短期过渡方案（Phase A 可用）

在共享 cookie 实现之前，官网使用以下降级检测：

```typescript
// 官网 Header.tsx — 过渡方案
// portal 登录后在 URL hash 里写入登录信号，官网读取
const checkLoggedIn = () => {
  return localStorage.getItem('asc_portal_session') === '1'
      || document.cookie.includes('asc_customer_logged_in=1');
};
```

Portal 登录成功后，通过 `redirect` 跳回时可在 URL 中附加 `?logged_in=1`，官网读取后写入 `localStorage.asc_portal_session = '1'`。

---

## 3. Account icon 最终方案

### 官网账户图标最终行为

#### 未登录态

```
点击 UserCircle 图标
  └── 弹出下拉菜单：
      ┌─────────────────────────────────────────┐
      │  Log in                                 │
      │    → portal /login                      │
      │                                         │
      │  My bookings                            │
      │    → portal /login?redirect=/bookings   │
      │                                         │
      │  Continue booking                       │
      │    → portal /login?redirect=/book       │
      │      (if quote draft exists in URL:     │
      │       ?redirect=/book?quote_id=xxx)     │
      └─────────────────────────────────────────┘
```

#### 已登录态

```
图标显示：UserCircle + 绿色小圆点 badge

点击图标：
  ┌─────────────────────────────────────────┐
  │  (顶部) Charles ▾  ← 显示名字（可选）  │
  │─────────────────────────────────────────│
  │  My account                             │
  │    → portal /dashboard                  │
  │                                         │
  │  My bookings                            │
  │    → portal /bookings                   │
  │                                         │
  │  Continue booking                       │
  │    → portal /book（或恢复草稿）         │
  │─────────────────────────────────────────│
  │  Log out                                │
  │    → 清除所有状态，回官网首页           │
  └─────────────────────────────────────────┘
```

#### 图标状态视觉区分

| 状态 | 图标外观 |
|------|---------|
| 未登录 | `UserCircle` 灰色，无 badge |
| 已登录 | `UserCircle` 金色（`text-primary`），右上角绿色 2px dot |
| hover | 高亮，无变化 |

---

## 4. Continue booking 最终方案

### 「未完成预订」的定义

按优先级排列，以下任意一种情况视为「有未完成预订」：

| 级别 | 条件 | 数据存储位置 |
|------|------|------------|
| P1 | `quote_sessions` 表存在未过期、未转换（`converted_at IS NULL`）的 quote，且属于当前 customer | Railway DB |
| P2 | `bookings` 表存在 `operational_status = PENDING_CUSTOMER_CONFIRMATION` 的预订 | Railway DB |
| P3 | 官网 URL / sessionStorage 中有 `quote_id` 参数（跨域可传递）| 浏览器本地 |

### Continue booking 路由逻辑（最终）

```
用户点击 "Continue booking"
  │
  ├── 未登录？
  │     └── → portal /login?redirect=/book/resume
  │
  └── 已登录？
        │
        ├── GET /customer-portal/bookings/resume
        │   （新 API，返回最近未完成 quote 或 PENDING 预订）
        │
        ├── 有未完成 quote？
        │     └── → portal /book?quote_id=xxx&car_type_id=yyy
        │
        ├── 有 PENDING_CUSTOMER_CONFIRMATION 预订？
        │     └── → portal /bookings/[id]（confirm 页面）
        │
        └── 无草稿？
              └── → portal /book（重新报价）
```

### 官网 quote 草稿传递

官网 widget 完成报价后，在跳转 portal 时：

```
portal /book?quote_id={id}&car_type_id={id}&from=widget
```

Portal 的 `/book` 页面已支持从 URL 读取 `quote_id`（`sessionStorage.book_quote_id`），此路径已通。

### 需要新建的 API

```
GET /customer-portal/bookings/resume
Headers: Authorization: Bearer {token}

Response:
{
  type: 'quote' | 'pending_booking' | 'none',
  quote_id?: string,
  car_type_id?: string,
  booking_id?: string,
  booking_reference?: string,
}
```

---

## 5. My bookings / My account 最终方案

### 路由规范

| 入口 | 登录态 | 目标 URL |
|------|--------|---------|
| 官网 → My bookings | 未登录 | `portal/login?redirect=/bookings` |
| 官网 → My bookings | 已登录 | `portal/bookings` |
| 官网 → My account | 已登录 | `portal/dashboard` |
| App → My bookings | 已登录 | App 原生 `/(app)/bookings` |
| App → My bookings | 未登录 | App 登录页 |
| Portal 底部导航 | 已登录 | `/bookings`（当前路由） |

### 跨端行为

- **数据源一致**：三个端（官网跳转、portal web、App）查询同一个 `GET /customer-portal/bookings` 端点
- **状态字典一致**：所有端使用相同的 `OP_STATUS_CONFIG`（参见 `booking-status.ts`）
- **不允许**：官网内嵌 portal iframe 或直接渲染预订列表

---

## 6. Logout 最终方案

### 真正的跨端登出

```
用户点击 Log out（任意入口）
  │
  ├── 清除 portal localStorage:
  │     - customer_token
  │     - customer_id
  │     - tenant_slug
  │
  ├── 清除官网信号:
  │     - localStorage.asc_portal_session
  │     - cookie: asc_customer_logged_in（如已实现）
  │
  ├── 清除官网 Supabase session（如有）:
  │     - supabase.auth.signOut()
  │
  └── 跳转: 官网首页 /（不跳 portal，避免二次跳转）
```

### Portal 内登出

```
/dashboard 或任意 portal 页面「Sign Out」按钮
  → useAuthStore.clearAuth()
  → 清除 localStorage
  → 写入 cookie 过期信号（最终目标）
  → router.push('/login')
```

### App 登出

```
App Profile 页面「Log out」
  → SecureStore.deleteItemAsync('token')
  → SecureStore.deleteItemAsync('user')
  → router.replace('/login')
```

---

## 7. Widget / Portal / App 边界

### 职责边界表

| 功能 | 官网 Widget | Portal Web | App |
|------|-----------|-----------|-----|
| 报价计算 | ✅（调用 public API）| ✅ | ✅ |
| 地址输入 / 选择 | ✅（完整）| ✅ | ✅ |
| 车型选择 | ✅ | ✅ | ✅ |
| 价格展示 | ✅（预览）| ✅（完整明细）| ✅ |
| 用户登录 | ❌（跳转 portal）| ✅ | ✅（原生）|
| 支付 | ❌ | ✅ | ✅ |
| 预订创建 | ❌ | ✅ | ✅ |
| 预订管理 | ❌（链接跳转）| ✅ | ✅ |
| 账户管理 | ❌ | ✅ | ✅（部分）|
| 推送通知 | ❌ | ❌ | ✅ |
| 离线草稿 | ❌ | sessionStorage | SecureStore |

### 不允许跨越边界的操作

- 官网不得存储 JWT token
- 官网不得直接调用需要鉴权的 API
- Portal 不得将 token 以 URL 参数形式传递给官网
- Widget 不得嵌入 portal 的支付表单（Stripe iframe）

---

## 8. 数据与状态源设计

### 各状态源真相表

| 数据项 | 最终源 | 读取方 | 写入方 |
|--------|-------|--------|--------|
| auth session | NestJS JWT（Railway DB：`customer_auth`）| Portal, App | Portal `/customer-auth/login`, App login |
| 登录信号（官网感知）| Cookie `asc_customer_logged_in=1`（最终目标）| 官网 Header | Portal 登录成功后写入 |
| customer profile | `public.customers`（Railway DB）| Portal, App | Portal register / admin |
| quote draft | `public.quote_sessions`（Railway DB，25min TTL）| Portal, App, Widget | Public pricing API |
| booking draft（待确认）| `public.bookings` `operational_status=PENDING_CUSTOMER_CONFIRMATION` | Portal, App | Portal `/customer-portal/bookings` |
| selected vehicle | URL param `car_type_id`（ephemeral）| Portal | Widget → URL redirect |
| payment state | `public.payments`（Railway DB）| Portal, App, Admin | Stripe webhook |
| status dictionary | `booking-status.ts`（前端常量 + backend enum）| Portal, App | 代码同步维护 |
| App quote draft | `SecureStore quote_draft`（25min TTL）| App | App book screen |

---

## 9. Migration plan

### Phase A — 最小路径：统一官网登录态检测（2–3天）

**目标**：官网 Header 正确反映 portal 登录态

**步骤**：
1. Portal 登录成功后写入 `localStorage.asc_portal_session = '1'`（或通过 redirect URL 参数传递）
2. 官网读取该 key 作为登录状态信号（跨域只读 localStorage 不可行，需要别的方式）
3. **可行方案**：Portal 登录后 redirect 回官网时 URL 附加 `?_logged=1`，官网读取并写入自己的 localStorage
4. 官网 Header 同时检测 `localStorage.asc_portal_session` 和 URL 参数

**交付物**：
- `LoginClient.tsx` 已支持 `?redirect=` ✅（已完成 commit `e111bf6`）
- 官网 `Header.tsx` 账户菜单 ✅（已完成 commit `8112cfc`）
- 需补充：portal 登录成功后在 redirect 中附加 `?_logged=1`

### Phase B — Continue booking 恢复（3–5天）

**目标**：点击「Continue booking」能恢复未完成草稿

**步骤**：
1. 新建 `GET /customer-portal/bookings/resume` API
2. Portal `/book/resume` 路由：调用 API，根据结果跳转
3. 官网 "Continue booking" → `/login?redirect=/book/resume`
4. App "Continue booking" → 读取 SecureStore 草稿，或调用 resume API

### Phase C — App 对齐（1–2天）

**目标**：App 与 portal web 状态字典、API 约定完全一致

**步骤**：
1. 修复 `checkout.tsx` null guard（已记录，等待运行时验证）
2. 验证 App 使用 `DRIVER_EXEC_STATUS` 小写 key 正确（已完成）
3. 验证 App `handleBookNow` 跳转 checkout 流程（已完成代码，待运行时）

### Phase D — 清理旧行为（1天）

**目标**：删除所有临时 patch、过渡性代码

**步骤**：
1. 删除 `apps/customer/app/booking-confirmed/[reference]/page.tsx`（已标注为死路由）
2. `git mv src/modules src/_archive_modules`（已计划）
3. 删除 `customer-app/app/(app)/book/cars.tsx`（已标注 ARCHIVED）
4. 删除 portal 遗留 `/admin/*` 未保护路由

---

## 10. Risks and tradeoffs

### 跨域身份共享

| 风险 | 级别 | 说明 |
|------|------|------|
| localStorage 跨域不可读 | 🔴 高 | `aschauffeured.com.au` 无法读取 `chauffeurssolution.com` 的 localStorage |
| SameSite cookie 限制 | 🟡 中 | 跨域 cookie 需要 `SameSite=None; Secure`，Safari ITP 会 7天过期 |
| JWT token 暴露风险 | 🔴 高 | 绝对不能将 JWT token 放入 URL 参数或 postMessage |
| Portal 域与官网域不同 | 🟡 中 | 无法使用 `.aschauffeured.com.au` 共享 cookie（portal 在 `.chauffeurssolution.com`）|

**推荐解法**：
- 短期：portal 登录 redirect 附加 `?_logged=1` 信号参数，官网本地记录（非 token）
- 长期：将 portal 迁移到 `portal.aschauffeured.com.au` 子域，与官网共享 `.aschauffeured.com.au` cookie

### Redirect 安全

| 风险 | 级别 | 当前防护 |
|------|------|--------|
| 开放重定向（Open Redirect）| 🔴 高 | `LoginClient.tsx` 已加 `r.startsWith('/')` 检查 |
| CSRF via redirect | 🟡 中 | redirect 参数只接受相对路径，不接受跨域 URL |
| XSS via URL param | 🟡 中 | Next.js `router.push` 不执行脚本 |

### 会话一致性

| 场景 | 风险 |
|------|------|
| Portal token 过期，官网仍显示已登录 | 官网信号 cookie/localStorage 有 TTL 不一致问题 |
| 用户在 portal 登出，官网不感知 | 官网 isLoggedIn 信号不会实时同步 |

**推荐解法**：
- 官网「账户菜单」所有操作（My bookings、Continue booking）均跳转 portal，portal 自己做 auth guard
- 即使官网信号显示「已登录」但 portal token 实际已过期，portal 会 401 redirect 到 login，用户体验可接受

---

## 11. Recommended implementation order

### 推荐实施顺序

```
Week 1
  [1] Phase A Step 3：
      Portal LoginClient 登录成功后，redirect URL 附加 ?_logged=1
      官网 Header 读取该参数并写入 localStorage
      → 官网能基本感知登录态

  [2] App 运行时 E2E 验证：
      模拟器内完整走一遍 Quote → Book → Success 流程
      验证 Phase 1 代码修复实际可用

Week 2
  [3] Phase B：
      新建 GET /customer-portal/bookings/resume API
      Portal /book/resume 路由
      官网 Continue booking → /login?redirect=/book/resume

  [4] 状态一致性验证：
      Portal web vs App：相同 booking 状态显示一致
      Admin 状态变更 → portal 实时反映

Week 3–4
  [5] Phase C + D：
      App checkout 运行时验证
      清理旧代码
      文档更新

Long term
  [6] Portal 迁移到 portal.aschauffeured.com.au
      实现真正的跨子域 cookie 共享
      → 官网可直接检测登录态，无需 URL 信号传递
```

### 不应该现在做的事

- ❌ 不要现在重构 Portal 认证为 Supabase Auth（scope 太大）
- ❌ 不要现在将官网 widget 改为需要登录才能报价
- ❌ 不要现在做 App 与 portal web 的 token 共享（原生 vs web 不同运行环境）

---

## 12. ChatGPT 交接块

```
CHATGPT_CUSTOMER_IDENTITY_ULTIMATE_HANDOFF

=== 项目背景 ===
项目：ASChauffeured 豪华专车预订平台（SaaS）
阶段：测试阶段，目标是一次性实现最终架构，避免反复补丁

=== 当前系统现状 ===

仓库：
  - 官网：aschauffeur-elite-docs（Vite + React + React Router）
           域名：aschauffeured.com.au
           Auth：Supabase（独立项目，非 portal 的用户系统）
  - Portal：Chauffeur-SaaS/apps/customer（Next.js 14 App Router）
            域名：aschauffeured.chauffeurssolution.com
            Auth：NestJS JWT，存储在 localStorage.customer_token
  - Backend：Chauffeur-SaaS/src（NestJS on Railway）
             URL：https://chauffeur-saas-production.up.railway.app
  - App：customer-app（Expo React Native）
         Auth：NestJS JWT，存储在 SecureStore

关键问题：
  - 官网 Supabase Auth 与 portal NestJS JWT 是两套独立系统
  - 官网无法直接读取 portal 的 localStorage（跨域）
  - portal JWT token 不能通过 URL 或 postMessage 传递（安全）
  - 官网账户图标已实现下拉菜单（commit 8112cfc），但 isLoggedIn 仍用 Supabase session

=== 已完成 ===
  - Portal LoginClient 支持 ?redirect=/path 参数（commit e111bf6）
  - 官网 Header 账户图标下拉菜单（commit 8112cfc）
    - 未登录：Log in / My bookings / Continue booking
    - 已登录：My account / My bookings / Continue booking / Log out
    - 绿色登录 badge
  - Portal 保存卡修复（commit 328483c）
  - Return leg UI 修复（commit b3e21a0）

=== Phase A 当前任务（下一步）===
目标：官网 Header 正确感知 portal 登录态

方案：
  portal 登录成功后 → redirect 附加 ?_logged=1
  官网读取 ?_logged=1 → localStorage.setItem('asc_portal_session', '1')
  官网 Header isLoggedIn 检查 localStorage.asc_portal_session === '1'

  登出时：
    portal clearAuth() 已清除 localStorage
    官网登出 → localStorage.removeItem('asc_portal_session')

  文件：
    修改 LoginClient.tsx（apps/customer/app/login/LoginClient.tsx）
    修改 Header.tsx（aschauffeur-elite-docs/src/components/layout/Header.tsx）

=== Phase B 任务 ===
目标：Continue booking 恢复未完成预订

新建 API：
  GET /customer-portal/bookings/resume
  返回：{ type: 'quote'|'pending_booking'|'none', quote_id?, car_type_id?, booking_id? }
  逻辑：
    1. 查 quote_sessions：converted_at IS NULL AND expires_at > now() AND customer_id = current
    2. 查 bookings：operational_status = 'PENDING_CUSTOMER_CONFIRMATION' AND customer_id = current
    3. 返回最近一条

新建 portal 路由：
  /book/resume → 调用 resume API → 跳转到 /book?quote_id=... 或 /bookings/[id]

=== 状态字典 ===
operational_status（UPPERCASE）:
  PENDING_CUSTOMER_CONFIRMATION, AWAITING_CONFIRMATION, CONFIRMED,
  COMPLETED, FULFILLED, CANCELLED, PAYMENT_FAILED

driver_execution_status（lowercase）:
  assigned, accepted, on_the_way, arrived, passenger_on_board, job_done

=== 关键约束 ===
  - 不跨域传递 JWT token
  - redirect 参数只接受以 / 开头的相对路径（已实现防护）
  - 官网不做支付、不创建预订、不存储 token
  - Portal 是唯一账户交易层
  - Backend / DB 是唯一数据源

=== 技术栈 ===
  Backend：NestJS，TypeScript，Postgres（Supabase managed），Railway
  Frontend portal：Next.js 14 App Router，Zustand auth store，axios
  官网：Vite + React，React Router v6，Supabase client（仅用于官网自己的 auth）
  App：Expo React Native，@tanstack/react-query，SecureStore

=== 当前 CORS 白名单 ===
  aschauffeured.com.au, www.aschauffeured.com.au
  *.chauffeurssolution.com
  *.vercel.app（preview）
  localhost:*

=== 主要已知 Bug（待修复，不在当前 scope）===
  BUG-009: RETURN trip 独立计价（frontend 已展示分腿，backend 计价未独立）
  BUG-010: guestBaseFare 使用错误字段
  BUG-011: total_price_minor 服务端未二次验证
  BUG-013: waypoint_charge_enabled 默认值错误（public-pricing.service.ts line 61）
```

---

*文档结束*
