# NEXT_STAGE_IMPLEMENTATION_STATUS.md

> 版本：v1.0 | 更新：2026-03-09  
> 本文件追踪 Phase A/B 之后所有后续开发阶段的实施状态。

---

## ✅ 已完成项

### Phase A — 官网感知 portal 登录态
| 项目 | 提交 | 备注 |
|------|------|------|
| Portal LoginClient 登录成功附加 `?_logged=1` | `63b1092` | email + OTP 两路 |
| 官网 Header 读取 `_logged=1` → `localStorage.asc_portal_session` | `1ab9a1b` | URL 自动清理 |
| 官网 Header 软登录态 TTL（7天自动过期）| `f8a867e` | `asc_portal_session_ts` |
| 账户菜单未登录 / 已登录态菜单项 | `1ab9a1b` | 已验证 T1–T4 |
| Continue booking → `/book/resume`（两种状态）| `1ab9a1b` | 已生效 |
| 登出清除 `asc_portal_session` + TTL key | `f8a867e` | 已验证 T4 |

### Phase B — Continue booking / Resume 流程
| 项目 | 提交 | 备注 |
|------|------|------|
| `GET /customer-portal/bookings/resume` API | `63b1092` | CustomerAuthGuard |
| `pending_booking` 查询（最近 PENDING_CUSTOMER_CONFIRMATION）| `63b1092` | 验证 T5 ✅ |
| Portal `/book/resume` 路由（resolver page）| `63b1092` | ResumeClient |
| 未登录访问 `/book/resume` → `/login?redirect=...` | `95bc34a` | publicPaths bug fix |
| BookPageClient 写入 `asc_last_quote_id` 草稿 | `63b1092` | 报价成功后写入 |
| booking 成功后清除 localStorage 草稿 | `63b1092` | 两个 key 同步清除 |
| api.ts 401 redirect 带 `?redirect=` 参数 | `368c08d` | 完整 auth loop |
| api.ts publicPaths 精确匹配 fix | `95bc34a` | `/book/resume` 正确触发 401 |

### Phase C — 客户体验完善
| 项目 | 提交 | 备注 |
|------|------|------|
| 软登录信号诚实性文档（不声称 portal auth）| `f8a867e` | 代码注释 + TTL |

### Phase D — Customer App 可用性
| 项目 | 提交 | 备注 |
|------|------|------|
| `handleBookNow` 跳转 checkout（非 create-from-quote）| 已存在于 `customer-app` | 已在之前会话修复 |
| `DRIVER_EXEC_STATUS` 小写 key 正确 | `customer-app/src/lib/booking-status.ts` | 统一 |
| `OP_STATUS_CONFIG` 含 FULFILLED / PAYMENT_FAILED | `customer-app/src/lib/booking-status.ts` | 完整 |
| App login.tsx post_login_route 恢复 | 已存在 | SecureStore 读取 |
| App api.ts 401 → setUnauthorizedHandler | 已存在 | `_layout.tsx` 注册 |
| App checkout.tsx savedCard null guard | `383f43e` | stripe_payment_method_id 过滤 |
| `EXPO_PUBLIC_STRIPE_PK` env 设置 | 已存在 `.env` | `pk_test_51Pu...` |

### Phase E — Widget 性能 + Mobile UX
| 项目 | 提交 | 备注 |
|------|------|------|
| autoDiscount fetch 改为并行（非阻塞）| `943fde8` | 减少约 300ms 串行延迟 |
| datetime picker scroll/resize listener throttle（rAF）| `943fde8` | 消除高频 setState jank |
| autocomplete 下拉 z-index 提升 z-[9000] | `943fde8` | 防止被 stacking context 裁切 |
| autocomplete 下拉 max-h-52 + overflow-y-auto | `943fde8` | mobile 键盘弹起后可用 |
| Get Quote CTA mobile sticky bottom | `943fde8` | sm:static desktop 正常 |

### Phase F — 状态字典一致性
| 项目 | 提交 | 备注 |
|------|------|------|
| 新建 `apps/customer/lib/booking-status.ts` | `449d0ba` | portal web 单一来源 |
| `bookings/page.tsx` → `getOpStatusBadge()` | `449d0ba` | 替换内联 STATUS_CONFIG |
| `BookingDetailClient.tsx` → 共享 imports | `449d0ba` | 移除重复定义 |
| PAYMENT_FAILED label 统一 "Payment Failed" | `449d0ba` | 之前是 "Pay Failed" |
| driver job_done label 对齐 "Trip Complete" | `449d0ba` | 与 app 一致 |

---

## 🔴 阻塞项（待解决）

| 项目 | 阻塞原因 | 解决方向 |
|------|---------|---------|
| **quote_sessions 无 customer_id** | DB schema 未加字段，无法从 backend 查未转化 quote | 加 `ALTER TABLE quote_sessions ADD COLUMN customer_id uuid`；portal /book 传入 customer_id |
| **真正的 backend quote resume** | 依赖上面 schema change | Phase B 补丁 |
| **App 运行时 E2E（simulator）** | `cliclick` 无法自动输入 email 字段；需要手动在模拟器上跑完整流程 | 手动操作 |
| **3DS 真实浏览器测试（App）** | 需要真实 Stripe 3DS 测试卡在真机上触发 | 真机 TestFlight |
| **APNs E2E 验证** | 所有 `apns_token = NULL`，无设备 token 注册 | Install TestFlight Build 31 |

---

## 🟡 延迟项（不阻塞测试，但需要上线前完成）

| 项目 | 说明 |
|------|------|
| **官网 → portal 跨域真正同步登录** | 目前软信号方案；长期需迁移 portal 到 `portal.aschauffeured.com.au` |
| **BUG-009 RETURN trip 独立计价** | Frontend 分腿展示已完成，backend 计价仍为单次 |
| **BUG-010 guestBaseFare fallback** | `base_calculated_minor` 应替换为 `pre_discount_fare_minor` |
| **BUG-011 total_price_minor 服务端验证** | 当前不校验客户端传入金额 |
| **BUG-013 waypoint_charge_enabled 默认值** | `public-pricing.service.ts` line 61 默认 true → 应为 false |
| **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` Vercel Dashboard** | 本地 `.env.local` 已更新，Vercel 还用 FALLBACK_PK |
| **App Store 上架流程** | 截图、metadata、TestFlight review |
| **`src/modules/` archive** | 确认无引用后 `git mv src/modules src/_archive_modules` |
| **Driver portal BottomNav named import bug** | `apps/driver/app/invoices/page.tsx` + `layout.tsx` |
| **Admin portal `/(platform)/*` 元数据** | layout.tsx title 说 "Customer Portal"（copy-paste 错误）|

---

## 📊 上线前必须完成的缺口

| 优先级 | 缺口 | 工作量估计 |
|--------|------|----------|
| P0 | App 运行时 E2E 验证（simulator 或真机）| 1–2h 手动 |
| P0 | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → Vercel Dashboard | 5min |
| P0 | Live Stripe keys + webhook 注册 | 1h |
| P1 | quote resume backend（schema + service）| 2–3h |
| P1 | APNs E2E（真机 token 注册）| 1h |
| P1 | BUG-009 RETURN 独立计价 | 3–4h |
| P2 | BUG-013 waypoint_charge_enabled 默认值 | 15min |
| P2 | Driver BottomNav import fix | 15min |
| P3 | App Store 上架资料 | 2–3h |

---

## 🟢 当前可测试状态

| 流程 | 状态 |
|------|------|
| 官网报价 → portal 登录 → 报价选车 → 预订 → 支付 | ✅ 可测 |
| Continue booking（有 PENDING 预订）| ✅ 可测 |
| 未登录 `/book/resume` → 跳 login → 回来 | ✅ 可测 |
| 官网账户图标菜单（未登录/已登录）| ✅ 可测 |
| Portal 预订列表 + 详情 | ✅ 可测 |
| App 报价 → 选车 → checkout → 成功 | ⚠️ 未跑 runtime E2E |
| APNs 推送 | ❌ 需真机 |
| Stripe 3DS（App）| ❌ 需真机 |
