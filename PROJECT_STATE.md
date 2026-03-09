# PROJECT_STATE.md — Current Architecture & Status

## 项目信息
- 项目名：Chauffeur Solutions (CS) SaaS
- 公司：AS Concierges Pty Ltd / ASChauffeured
- 负责人：Charles Chan
- 时区：Australia/Sydney

## 部署环境
| 环境 | URL | 平台 |
|------|-----|------|
| Backend (NestJS) | https://chauffeur-saas-production.up.railway.app | Railway |
| Admin Portal | https://chauffeur-saa-s.vercel.app | Vercel |
| Customer Portal | https://aschauffeured.chauffeurssolution.com | Vercel |
| Official Website | https://aschauffeur.com.au | Vercel |

## 仓库路径
- SaaS 主仓库：`/Users/charleschan/.openclaw/workspace/Chauffeur-SaaS`
- iOS Driver App：`/Users/charleschan/.openclaw/workspace/asdriver-native`
- Customer App (RN)：`/Users/charleschan/.openclaw/workspace/customer-app`
- 官网：`/Users/charleschan/.openclaw/workspace/aschauffeur-elite-docs`

## 技术栈
- Backend: NestJS + TypeScript
- Frontend: Next.js (App Router)
- DB: Supabase (Postgres) + Row Level Security
- Payments: Stripe Connect
- SMS/Comms: Twilio / Resend / SendGrid
- Maps: Google Maps API
- iOS: Swift (ASDriverNative) + Expo (customer-app)

## 租户信息
- 租户：aschauffeured
- tenant_id：`aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- 测试账号：admin@aschauffeured.com.au / Admin1234!

## 关键文件
| 文件 | 用途 |
|------|------|
| `src/pricing/pricing.resolver.ts` | 核心定价逻辑 |
| `src/pricing/pricing.types.ts` | 定价类型定义 |
| `src/public/public-pricing.service.ts` | 公开报价 API |
| `src/customer-portal/customer-portal.controller.ts` | 客户端 API + discount-preview |
| `src/customer/discount.resolver.ts` | 折扣计算 |
| `src/driver/driver-app.service.ts` | 司机 App + 推送通知 |
| `src/notification/notification.service.ts` | 通知服务 |
| `apps/customer/app/book/BookPageClient.tsx` | 预订页面（定价显示） |
| `apps/customer/app/quote/QuoteClient.tsx` | 报价页面 |
| `apps/admin/app/(tenant)/bookings/[id]/page.tsx` | Admin 预订详情 |
| `aschauffeur-elite-docs/src/components/booking/BookingWidget.tsx` | 官网预订 widget |

## 定价 Snapshot 字段说明
| 字段 | 含义 |
|------|------|
| `pre_discount_fare_minor` | 折前 fare（含 waypoints+seats，不含 toll） |
| `discount_amount_minor` | 折扣金额 |
| `grand_total_minor` | 最终总价（折后 fare + toll） |
| `toll_minor` | 公路费 |
| `parking_minor` | 停车费 |
| `toll_parking_minor` | toll + parking 合计 |
| `waypoints_minor` | Waypoint 费用（已含在 pre_discount_fare_minor） |

## 状态流（司机任务）
assigned → accepted → on_the_way → arrived → passenger_on_board → job_done → fulfilled

## Apple Developer
- Team ID：QQ482WQ97D
- Bundle ID：com.aschauffeured.driver
- Apple ID：asconcierges@gmail.com

## 最新 Commits（截至 2026-03-09）
- Chauffeur-SaaS main：`0f8455c`
- asdriver-native main：`3876de3`
- aschauffeur-elite-docs main：`d1a3998`
- customer-app：`e2ac46b`

## 活跃模块状态
| 模块 | 状态 |
|------|------|
| 定价引擎 | ✅ 稳定 |
| 客户预订流程 | ✅ 稳定 |
| 折扣系统 | ✅ 修复完成 |
| Admin 预订管理 | ✅ 稳定 |
| 官网 Widget | ✅ CSP 修复完成 |
| APNs 推送通知 | 🔴 p8 文件未下载 |
| Email OTP 登录 | 🟡 未实现 |
| RETURN trip 独立计算 | 🟡 进行中 |
| App Store 提交 | 🟡 进行中 |
