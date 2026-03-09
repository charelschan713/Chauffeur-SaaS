# MEMORY.md — Permanent Rules & Constraints

## 输出语言规则
- 用户输出：仅简体中文
- 代码、文件名、命令、字段名、原始错误：英文
- 禁止韩文、混合语言

## 报告格式（每次任务必须）
1. 结论
2. 修改文件
3. 修改内容
4. 风险影响
5. 手动测试步骤
6. 未完成 / 待确认

## 模型分工
- 执行模型：openai/gpt-5.4
- 审查模型：anthropic/claude-opus-4.6
- 兜底模型：anthropic/claude-sonnet-4.6

## 高风险模块（强制：诊断→审查→修改→报告）
- auth / payments / DB schema / booking flow / invoice / driver assignment

## 产品原则
- Toll / Parking 永远不打折，折后加上
- Waypoints + Baby Seats 合并进 Base Fare 行显示（不单独列出）
- pre_discount_fare_minor = 折前 fare（含 waypoints+seats，不含 toll）
- grand_total_minor = 折后 fare + toll/parking
- Discount 行显示在 toll 之前
- RETURN trip: outbound (A→B→C) 和 return (C→B→A) 独立计算，不简单翻倍

## 架构边界
- 所有 DB 查询必须包含 tenant_id（多租户）
- DB migration 通过 psycopg2 Python 脚本 + Railway DATABASE_URL
- 禁止用 railway up 部署（用 git push origin main）
- 禁止在未通过 3 个 build 的情况下 push

## 推送前必须通过
1. `npm run build` — NestJS backend
2. `cd apps/admin && npm run build`
3. `cd apps/customer && npm run build`

## 设计 Token（UI）
- BG: #1A1A2E / CARD: #222236 / BORDER: #333355
- GOLD: #C8A870 / TEXT: #FFFFFF / MUTED: #9CA3AF
- 无卡片边框，用阴影代替

## 禁止操作
- 禁止无审批的大范围重构
- 禁止同一任务同时改架构和实现
- 禁止静默修改任务范围外的内容
- 禁止不出报告就结束任务
