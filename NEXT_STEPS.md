# NEXT_STEPS.md — Priorities & Blockers

_最后更新：2026-03-09_

---

## 🔴 立即处理（P1）

### 1. APNs p8 文件
- **操作**：用系统 Safari 访问 https://developer.apple.com/account/resources/authkeys/review/DY4WS2ACK7
- 撤销 Key DY4WS2ACK7
- 重新创建（名称：ASDriverPush，勾选 APNs，Sandbox & Production）
- 用系统浏览器下载 → `~/Downloads/AuthKey_XXXXXXXXXX.p8`
- 设置 Railway env vars：
  - `APNS_KEY_ID` = 新 Key ID
  - `APNS_TEAM_ID` = QQ482WQ97D
  - `APNS_PRIVATE_KEY` = p8 文件内容（\n 转义）
  - `APNS_BUNDLE_ID` = com.aschauffeured.driver

---

## 🟡 进行中（P2）

### 2. RETURN Trip 独立计算
- **目标**：Outbound (A→B→C) 和 return (C→B→A) 各自独立计算距离+toll+价格
- **入口**：`src/pricing/pricing.resolver.ts` + `src/public/public-pricing.service.ts`
- **当前状态**：两程 waypoints 已分开（outboundWaypoints + returnWaypoints），但两程路线距离/toll 是否独立需验证

### 3. Email OTP 登录（Driver App）
- **目标**：替换 SMS OTP，改用平台邮件发送 OTP
- **后端**：在 `src/notification/` 添加平台级 email utility
- **env vars**：RESEND_API_KEY 或 SENDGRID_API_KEY
- **iOS**：更新 `LoginView.swift`，Phone OTP Tab → Email OTP Tab

### 4. App Store 提交（ASDriver）
- **待完成**：
  - 下载 App Store Distribution Provisioning Profile
  - xcodebuild archive + xcrun altool 上传
  - 截图（5 页：Login, Home, Bookings, Quote, More）
  - App Store Connect 元数据填写

---

## 🟢 待验证（部署后确认）

### 5. 官网 Widget 验证
- CSP 修复已 deploy（commit d1a3998）
- 确认 widget 可正常加载 service types 和报价
- 确认价格显示 2 位小数
- 确认划线价包含 waypoint 费用
- 确认手机端 passengers +/- 按钮正常

### 6. Customer Portal 定价验证
- 确认 Base fare 行 = pre_discount_fare_minor（折前，含 waypoints）
- 确认 Discount 行在 toll 之前显示
- 确认 Total = discounted fare + toll（toll 不打折）
- 确认 RETURN trip 划线价正确

### 7. Admin Portal Breakdown 验证
- 确认无重复 Stops/Baby Seats 行
- 确认顺序：Base Fare → Discount → Toll → Total

---

## 📋 交接笔记（给下一个 Agent Session）

1. 读取 MEMORY.md → PROJECT_STATE.md → DECISIONS.md → BUGS.md 再开始工作
2. 今日修复了大量定价显示 bug，核心逻辑在 `pricing.resolver.ts`
3. `pre_discount_fare_minor` 是关键字段，所有前端定价显示的基准
4. APNs 是最大阻塞项，需要用户用系统浏览器操作
5. RETURN trip 独立计算逻辑需进一步验证
6. 模型分工：执行用 gpt-5.4，审查用 claude-opus-4.6
