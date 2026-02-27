# Chauffeur Solutions Platform Constitution v1.0

---

## 一、UI 规则
→ 所有 UI 来自 tenant-config 驱动
→ 所有表单字段来自 schema 驱动
→ 所有组件来自 packages/ui
→ 零硬编码颜色/文案/选项
→ 禁止原生 date/time/select
→ CI 阻断所有硬编码

## 二、变量/字段规则
→ 字段名全平台统一
→ 姓名：first_name / last_name
→ 电话：phone_country_code / phone_number
→ 时间：pickup_datetime（UTC）+ timezone
→ 地址：address / lat / lng
→ 租户：tenant_id（所有业务表必须有）
→ 禁止前端传 tenant_id（从 JWT 读）
→ 禁止字段名随意改动

## 三、Auth 规则
→ 单一 Auth 系统
→ JWT = user_id + active_tenant_id + role
→ 所有请求从 JWT 读 tenant_id
→ RLS 用 session variable
→ API Key 给租户官网调用
→ Super Admin 独立域名
→ API Key 必须可轮换/可撤销/带 scope/带过期

## 四、数据规则
→ 单一生产 DB
→ 所有业务表必须有 tenant_id
→ RLS 全覆盖
→ 转单死字段不可变
→ Migration 必须有 up/down
→ 不允许直接改生产数据

## 五、转单死字段（不可变）
pickup_address / lat / lng
dropoff_address / lat / lng
waypoints[]
pickup_datetime / timezone
customer_first_name / last_name
customer_phone_country_code / phone_number
customer_email
booking_reference / status
passengers / luggage
total_price / driver_payout / currency
allowed_vehicles[]
vehicle_id / driver_id / assigned_at

## 六、权限规则
Super Admin：
→ 平台级操作，管理所有租户
→ 只走 admin.chauffeursolutions.com

Tenant Admin：
→ 只能操作自己租户数据
→ tenant_id 从 JWT 强制

Tenant Staff：→ 只能操作订单
Driver：→ 只能看自己的订单
Passenger：→ 只能看自己的订单

禁止：
→ 租户访问其他租户数据
→ 前端绕过权限
→ 硬编码角色判断

## 七、代码规则
→ 所有逻辑先给 Claude 审查
→ ChatGPT 设计方案（不写代码）
→ OpenClaw 执行代码
→ 每个 Phase 完成才进下一个
→ 禁止跳步骤
→ 有疑问必须问 Claude

## 八、新功能规则
→ 评估是否对所有租户有价值
→ 有价值 → 平台功能 + 开关控制
→ 无价值 → 不做
→ 禁止给某个租户写特殊代码

## 九、部署规则
→ main branch = 生产
→ push main → 自动部署
→ Railway（后端）/ Vercel（前端）
→ 每次部署后验证版本号

## 十、配置与密钥规则
→ 环境变量分级：dev/staging/prod
→ API Key 必须可轮换/可撤销
→ 带 scope/带过期时间
→ 禁止硬编码任何密钥

## 十一、测试门禁规则
→ PR 必须过：
   类型检查 + lint + 单测
   + 集成测试 + RLS 回归测试
→ 新增业务表无 tenant_id + RLS
   → CI 直接 fail

## 十二、可观测性规则
→ 结构化日志
→ 错误追踪
→ 核心指标：
   下单成功率/派单时延/支付失败率
→ P1 问题定义与告警升级路径固定

## 十三、备份与恢复规则
→ 明确 RPO/RTO
→ 月度恢复演练
→ 不只看"备份成功"

## 十四、审计与追踪规则
→ 所有写操作记录：
   who/when/tenant_id/before/after/request_id
→ 关键操作必须可追溯：
   派单/改价/取消/退款

## 十五、幂等与并发规则
→ 创建订单/支付/派单
   必须支持 idempotency_key
→ 关键状态流转加版本号或乐观锁
→ 防止并发覆盖

## 十六、状态机规则
→ 明确定义 allowed transitions
→ 谁能从 A→B 必须有定义
→ 禁止任意状态跳转
→ 禁止 completed→pending 回跳

## 十七、时间与货币规则
→ DB 全部 UTC 存储
→ 展示层才做时区转换
→ 金额统一最小货币单位（分）存储
→ 禁止 float 金额计算

---

## CI 检查清单
□ 类型检查通过
□ Lint 通过
□ 单元测试通过
□ RLS 回归测试通过
□ 无硬编码颜色/选项/字段
□ 新表有 tenant_id + RLS
□ 无原生 date/time/select

## 发布检查清单
□ 版本号更新
□ Migration up/down 测试
□ 所有服务版本确认
□ 关键 API 健康检查
□ 监控告警正常
