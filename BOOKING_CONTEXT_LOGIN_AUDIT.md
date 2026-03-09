# BOOKING_CONTEXT_LOGIN_AUDIT.md
**生成时间：** 2026-03-09  
**审查基础：** 源码直接分析（无假设）  
**语言：** 简体中文

---

## 1. 问题总结

**现象：** 用户从营销网站 Widget 进入 Web Portal，或在 App 中完成报价后尝试登录，预订/报价内容可能丢失或被覆盖。

**严重度：** 🔴 P0（App 主流程）/ 🟡 P1（Web Portal 部分场景）

| 场景 | 平台 | 严重度 | 说明 |
|------|------|--------|------|
| App 主流程 Book Now → 404 | App | 🔴 P0 | 端点不存在，上下文永远无法传到后端 |
| App 报价完成 → 需登录 → 上下文丢失 | App | 🔴 P0 | useState 本地状态，无持久化 |
| Web: URL params 截断 | Web | 🟡 P1 | `quote_id` 在跳转链上依赖 URL，某些场景可能丢失 |
| Web: 登录后 URL params 是否保留 | Web | 🟡 P1 | AuthGate 内联，理论上保留，但有边缘情况 |
| Web: sessionStorage 跨域失效 | Web | 🟡 P1 | 嵌入 Widget 的 sessionStorage 跨域后为空 |

---

## 2. Widget → Portal 传递分析

### 路径 A：官网 Widget → 客户 Web Portal

```
BookingWidget.tsx
  → POST /public/pricing/quote → 返回 quote_id
  → window.location.href = "https://aschauffeured.chauffeurssolution.com/book?quote_id={id}&car_type_id={id}&slug=aschauffeured"
  
客户门户 /book (BookPageClient.tsx)
  → 读取 URL params: searchParams.get('quote_id'), searchParams.get('car_type_id')
  → GET /customer-portal/quote-sessions/{quote_id} (加载报价快照)
  → 渲染 BookingForm
```

**数据存储：**
- `quote_id`: URL params（主要）
- `car_type_id`: URL params
- `slug`: URL params（用于 stripeConfig）
- 后端 quote_session: 数据库存储，有过期时间（30分钟）

**上下文丢失风险：**
- ✅ 正常流程：URL params 正确传递，quote_session 从后端读取，**不依赖 sessionStorage**
- ⚠️ URL 截断：某些短信平台/邮件客户端截断长 URL → `quote_id` 丢失
- ⚠️ URL 被 URL decode 错误：特殊字符 → 解析失败

### 路径 B：嵌入 Widget → 客户 Web Portal（修复前）

```
Widget.tsx（修复前）
  → sessionStorage.setItem('asc_quote_payload', JSON.stringify(payload))  ← 无效，跨域后为空
  → window.location.href = "https://book.{slug}.aschauffeured.com.au/book?{params}"  ← 域名可能 404
```

**修复后（本次已改）：**
- 移除 sessionStorage 写入
- 改为 `${slug}.chauffeurssolution.com`（与官网 Widget 对齐）
- 完全依赖 URL params

### 路径 C：App 内联报价（无 Widget 跳转）

```
App book/index.tsx
  → 用户填表 → GET 报价 → 展示结果
  → 所有状态存储在 useState（组件内存）
  → 无 sessionStorage / SecureStore / AsyncStorage 持久化
```

**数据存储：**
- 全部在 `index.tsx` 的 useState
- 无任何持久化

**上下文丢失风险：**
- 🔴 Tab 切换（App 底部导航）→ book 屏幕卸载/重载 → 所有 useState 清零
- 🔴 登录弹出（若 App 检测到未登录需要登录）→ 导航离开 → 状态丢失
- 🔴 App 进入后台时间过长 → 内存回收 → 状态清零

---

## 3. 匿名预订上下文分析

### Web Portal（apps/customer）

**Web 匿名流程：**
```
/book 页面 → AuthGate 步骤 = 'auth'
  → 显示三个选项：登录 / 注册 / 访客
  → 访客路径：GuestActivateOtp (phone OTP) → 创建 guest token
  → 访客 token 存储：？（需确认）
  → 报价上下文：保留在 /book 页面内存（React state）
  → 页面不刷新，上下文在同一个 React 组件树内持续
```

**Web 匿名上下文存活：**
- ✅ 同一页面内登录 / 访客流程：上下文**安全** — `AuthGate` 是内联 UI，不触发页面跳转
- ❌ 刷新页面：`quote_id` 需要重新从 URL 读取，已选车型 (`car_type_id`) 来自 URL params，**存活**
- ❌ 如果用户打开新 tab 登录后回来：可能上下文丢失（依赖同一 React 组件实例）

**Web localStorage/sessionStorage 使用：**
```typescript
// apps/customer/lib/auth-store.ts（推测，未读到完整文件）
// token 存储位置：需确认 localStorage vs memory
```
⚠️ 未读到 `apps/customer/lib/auth-store.ts` 完整内容，此处标记为不确定。

### App

**App 匿名上下文：**
- App 首页 (`app/index.tsx`) 检查 SecureStore `token`，无 token → redirect 到 `login`
- 登录后 → `router.replace('/(app)/home')` — **硬跳转到 Home，不是跳回 Book 页面**
- Book 页面状态（报价、选中车型）**已丢失**

```typescript
// app/login.tsx:handleLogin
await registerPushToken().catch(() => {});
router.replace('/(app)/home');   // ← 丢失上下文！不跳回 book 页面
```

---

## 4. 登录转换分析

### Web Portal 登录转换

**场景 1：`/book` 页面内联登录（正常路径）**
```
/book 页面加载 → AuthGate step = 'auth'
  → 用户点击 "Login" → step = 'login' (内联 InlineLoginForm)
  → 登录成功 → step = 'details' (填写预订详情)
  → 整个流程在同一页面组件内，quote 上下文(quoteId, selectedCarType) NEVER 丢失
```
✅ 这个路径**安全**，上下文不丢失。

**场景 2：用户先访问 `/login` 再返回**
```
用户直接访问 /login → 登录成功 → 跳转到 /dashboard
→ 用户再手动访问 /book → 无 quote_id → 空页面 ← 上下文丢失
```
⚠️ 但这不是主要流程（从 widget 来的用户不会经过独立 /login 页）

**场景 3：Token 过期**
- Web auth 使用 JWT，页面刷新时重新读 token
- `BookPageClient.tsx` 在 useEffect 里读 auth state，token 失效会触发 re-auth 内联流程
- ⚠️ 若 auth refresh 导致 state 重置，quote 上下文可能丢失（需确认 auth-store 实现）

### App 登录转换

**App 登录路径：**
```
app/index.tsx → isLoggedIn() → false
  → router.replace('/login')   ← 离开 App 路由组
  
login.tsx → 登录成功 → router.replace('/(app)/home')   ← 丢失上下文

// 若用户在 book 屏幕 API 返回 401：
api.ts interceptor:
  await SecureStore.deleteItemAsync('token');   // token 删除
  await SecureStore.deleteItemAsync('user');    // user 删除
  return Promise.reject(err);                  // 只抛错误，不导航到 login
```

**问题：**
- 401 拦截器只删除 token，不导航 → 用户卡在 Book 页面，重试依然 401
- 登录成功后跳到 Home，不跳回 Book → 用户需重新填写整个表单
- Book 页面的 useState 在路由切换后会被销毁（Expo Router 的 tab 切换行为）

---

## 5. 登录后重新注水分析

### Web Portal

**有无显式 rehydrate 步骤？** ⚠️ **部分有，部分无**

```typescript
// BookPageClient.tsx 的 AuthGate 是内联的
// 登录成功后 step 从 'login' 变为 'details'
// quoteId 和 selectedCar 仍在 React state 中 → SAFE（同组件内）
```

**但是**，没有显式的"登录后恢复 quote draft"机制：
- `quoteId` 来自 URL params，页面加载时读取一次并存入 state
- 登录过程不会清除这个 state（内联登录，同组件树）
- **但如果页面刷新（如 OAuth callback 等场景）则 state 丢失，只能从 URL 恢复**

**URL params 是唯一的跨刷新 source of truth。**

### App

**无任何 rehydrate 步骤。**

```typescript
// 登录后：router.replace('/(app)/home')
// book/index.tsx 的所有 useState 已销毁
// 没有 AsyncStorage/SecureStore 存储的 quote draft
// 没有重新跳到 book 页面的逻辑
```

---

## 6. 真相来源分析

| 数据 | Web Portal 真相来源 | App 真相来源 | 一致性 |
|------|------------------|------------|--------|
| **租户标识** | URL param `slug` + `X-Tenant-Slug` header | `EXPO_PUBLIC_TENANT_SLUG` env var | ✅ 一致（都是静态配置） |
| **quote_id** | URL params → React state → 后端 quote_session | App `useState quoteId` | ⚠️ Web: 跨刷新安全（URL）；App: 无持久化 |
| **选中车型/服务** | URL params `car_type_id` → React state | App `useState selectedCarId` | ⚠️ 同上 |
| **行程详情** | React state + 后端 quote_session | App `useState` | ⚠️ 同上 |
| **预订草稿** | 无（无显式草稿机制） | 无 | ❌ 两端都没有持久化草稿 |
| **Auth token** | localStorage（推测，需确认） | SecureStore | - |
| **客户身份** | JWT → `GET /customer-portal/profile` | SecureStore `user` | ✅ 基本对齐 |

---

## 7. 根因候选

### 根因 1：App `handleBookNow` 调用不存在的端点（P0）
```javascript
// customer-app/app/(app)/book/index.tsx
await api.post('/customer-portal/bookings/create-from-quote', { ... });
// ← 404，这是上下文丢失的直接原因之一：用户误以为预订成功，实际失败
```

### 根因 2：App 登录后跳转到 Home（P0）
```javascript
// customer-app/app/login.tsx
router.replace('/(app)/home');   // 丢失 book 页面上下文
// 修复：应跳回 book 页面，或在登录前将 quote draft 持久化
```

### 根因 3：App 无 quote draft 持久化机制（P0）
- App `book/index.tsx` 所有状态是 `useState`（组件内存）
- Tab 切换 / 登录导航 / 后台回收 都会清零
- 无 `AsyncStorage`、`SecureStore`、`MMKV` 存储 quote draft

### 根因 4：Web Portal quote_id 单点依赖 URL params（P1）
- 页面加载后，`quoteId` 从 URL 读入 React state
- 如果后续有导致页面重载的操作（hard refresh、某些 OAuth 回调），state 清零，只能从 URL 恢复
- URL params 是唯一持久化机制，没有 localStorage 兜底

### 根因 5：401 拦截器不导航（P1）
```typescript
// customer-app/src/lib/api.ts
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('token');  // 删 token
      await SecureStore.deleteItemAsync('user');   // 删 user
      // ← 没有 router.replace('/login')！
    }
    return Promise.reject(err);
  },
);
```
Token 失效后用户卡在页面，无法自动恢复。

### 根因 6：无"登录意图"机制（P1）
Web 和 App 都没有以下标准模式：
```
用户操作 → 需要登录 → 保存"登录意图"（quote state / 返回路径）→ 登录成功 → 恢复意图
```
两端都是简单跳登录页，完成后跳到固定首页，不恢复上下文。

---

## 8. 可复现路径（基于源码分析）

### 路径 1：App 报价后点击 Book Now（100% 失败）
```
1. 打开 App → Book tab
2. 填写 pickup/dropoff/date/time/passengers
3. 点击 "Get Instant Quote" → 正常返回报价
4. 选择车型 → 点击 "Book Now"
5. handleBookNow() → POST /customer-portal/bookings/create-from-quote
6. 后端返回 404（端点不存在）
7. Alert.alert('Booking failed', ...)
8. 上下文未丢失，用户仍在 book 页面
   但预订永远无法完成（端点不存在）
```

### 路径 2：App 未登录 → 报价 → 尝试预订（上下文丢失）
```
1. 打开 App（未登录状态是否可访问 book tab？需确认）
   — app/(app)/_layout.tsx 没有明确的 auth gate
   — 401 后 token 删除，但不导航
   — 用户可能处于"未登录但 UI 正常"的状态
2. 在 book 页面填写表单 → 报价成功（GET quote 不需要 auth）
3. 点击 Book Now → API 返回 404（端点问题）或 401（未登录）
4. 如果 401：拦截器删 token，不跳转 → 用户手动去登录
5. Login 成功 → router.replace('/(app)/home')
6. 返回 Book tab → 所有 useState 清零 → 表单空白
7. 用户必须重新填写所有内容
```

### 路径 3：Web Widget → Portal（主路径，基本安全）
```
1. 官网 → BookingWidget 报价 → 选车 → 点 Book Now
2. window.location.href = ".../book?quote_id=xxx&car_type_id=xxx&slug=xxx"
3. BookPageClient.tsx 读取 URL params → 设置 React state
4. GET /customer-portal/quote-sessions/{quote_id} → 加载完整报价数据
5. AuthGate 检测未登录 → 显示内联登录/访客选项
6. 内联登录（不跳离页面）→ 登录成功 → step='details'
7. quoteId + selectedCar 仍在 React state ← 安全
8. 完成预订 → 成功
```
✅ 这个路径**基本安全**，只要用户不刷新页面。

### 路径 4：Web Portal 刷新后（上下文部分恢复）
```
1. 从 Widget 来到 /book?quote_id=xxx&car_type_id=xxx
2. 页面加载 → 读取 URL params → 设置 state → 加载 quote_session
3. 用户刷新页面（F5 / 手动刷新）
4. URL params 存在 → 重新读取 quote_id ← 恢复
5. car_type_id 也在 URL → 恢复
6. 但如果 quote_session 已过期（30分钟）→ 后端返回 404/410 → 报价丢失
7. 用户需要返回网站重新报价
```

---

## 9. 建议最小安全修复

### 优先级 1：修复 App Book Now 端点（P0）

**最小 diff（最快修复）：**
```javascript
// customer-app/app/(app)/book/index.tsx:handleBookNow
// 当前：
await api.post('/customer-portal/bookings/create-from-quote', {
  quote_id: quoteId, service_class_id: selectedCarId,
});
// 修复：跳转到 checkout 屏幕，传递 quoteId + selectedCar + formData
router.push({
  pathname: '/(app)/book/checkout',
  params: {
    result: JSON.stringify(quoteResults.find(r => r.service_class_id === selectedCarId)),
    sessionId: quoteId,  // checkout.tsx 读 sessionId 参数
    form: JSON.stringify({ pickup, dropoff, date, time, passengers }),
  },
});
// 修复 checkout.tsx 发送到 /customer-portal/bookings（已有实现）
```

### 优先级 2：App 登录后跳回 Book（P0）

**最小 diff：**
```javascript
// customer-app/app/login.tsx
// 登录前保存意图：
await SecureStore.setItemAsync('post_login_route', '/(app)/book');

// 登录成功后：
const returnRoute = await SecureStore.getItemAsync('post_login_route') ?? '/(app)/home';
await SecureStore.deleteItemAsync('post_login_route');
router.replace(returnRoute);
```

**但 quote state 仍然丢失**（跳回 book 页面时是新实例）。真正的修复需要：

### 优先级 3：App Quote Draft 持久化（P0 完整修复）

**架构方案：**
```javascript
// 1. 在 handleGetQuote 成功后，将 quoteId 和 form data 持久化：
await SecureStore.setItemAsync('quote_draft', JSON.stringify({
  quoteId, selectedCarId, formData, expiresAt: Date.now() + 25 * 60 * 1000
}));

// 2. book/index.tsx 加载时，读取 draft 并恢复 state：
useEffect(() => {
  SecureStore.getItemAsync('quote_draft').then(raw => {
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (draft.expiresAt > Date.now()) {
      // restore state
    } else {
      SecureStore.deleteItemAsync('quote_draft');
    }
  });
}, []);

// 3. 预订成功后清除 draft：
SecureStore.deleteItemAsync('quote_draft');
```

### 优先级 4：Web Portal quote_id localStorage 兜底（P1）

```javascript
// apps/customer/app/book/BookPageClient.tsx
// 加载时同时写 localStorage：
useEffect(() => {
  if (quoteId) localStorage.setItem('asc_quote_id', quoteId);
}, [quoteId]);

// 读取时，URL → localStorage fallback：
const quoteId = searchParams.get('quote_id') ?? localStorage.getItem('asc_quote_id');
```

### 优先级 5：App 401 拦截器补充导航（P1）

```javascript
// customer-app/src/lib/api.ts
import { router } from 'expo-router';

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user');
      // 保存当前路径后跳转
      router.replace('/login');
    }
    return Promise.reject(err);
  },
);
```

---

## 10. ChatGPT 交接块

```
=== CHATGPT_BOOKING_CONTEXT_LOGIN_HANDOFF ===

核心问题：
1. App Book Now 调用 /create-from-quote（404）→ 主流程完全不可用
2. App 无 quote draft 持久化 → 登录/切 tab 后上下文丢失
3. App 登录成功跳 home（不跳 book）→ 用户需重填表单
4. App 401 拦截器删 token 但不导航 → 用户卡在页面

Web Portal 上下文安全性：
✅ Widget → Portal：URL params（quote_id）是主传递机制，基本安全
✅ 内联登录（AuthGate）：同页面组件树，state 不丢失
⚠️ 页面刷新：quote_id 从 URL 恢复，car_type_id 也在 URL，但 30 分钟后 quote_session 过期
⚠️ 无 localStorage 兜底

最可能出问题的文件：
1. customer-app/app/(app)/book/index.tsx:handleBookNow (line ~295)
   → 调用不存在端点，需改为跳转 checkout 屏幕
2. customer-app/app/login.tsx:handleLogin (line ~96)
   → router.replace('/(app)/home') 应改为恢复 post_login_route
3. customer-app/src/lib/api.ts:interceptors (line 18-23)
   → 401 需补充 router.replace('/login')
4. customer-app/app/(app)/book/index.tsx (state management)
   → 无任何 SecureStore/AsyncStorage 持久化
5. apps/customer/app/book/BookPageClient.tsx (quoteId 读取)
   → 仅从 URL params 读，无 localStorage 兜底

建议最小修复优先级：
Phase 1 (立即):
  A) index.tsx handleBookNow → 改为跳转 checkout（传递 params）
  B) login.tsx → 登录后恢复路由意图
  C) api.ts 401 → 补充 router.replace('/login')

Phase 2 (本周):
  D) quote draft 持久化（SecureStore，25分钟 TTL）
  E) Web Portal quote_id localStorage 兜底

Phase 3 (结构治理):
  F) 统一 QuoteDraftContext（Web: React Context + localStorage；App: SecureStore + Context）
  G) 登录意图机制标准化

未确认项（需进一步读源码）：
? apps/customer/lib/auth-store.ts — auth token 是存 localStorage 还是 sessionStorage？
? BookPageClient.tsx — 登录后是否有任何 quoteId 重读逻辑？
? app/(app)/_layout.tsx — 是否有全局 auth gate？（当前读到的版本没有）
? quote_session 过期时间 — 后端是否严格 30 分钟？
=== END HANDOFF ===
```

---

*报告由 OpenClaw 基于源码直接分析生成 | 2026-03-09*
