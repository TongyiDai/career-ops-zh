# AI 求职助手 Roadmap

## Phase 0：中文原生 MVP（已完成）

- 项目定位与 README；
- Agent 使用说明；
- 中文用户画像模板；
- 模型供应商兼容模板；
- 岗位评估、简历、沟通、面试、tracker、coach 六个核心模式；
- 初始化和验证脚本；
- 示例 CV/JD。

## Phase 1：Skill 化与完整样例链路

- `/career-zh` Skill Router；
- `auto-pipeline` 完整链路模式；
- 示例 JD → 评估报告 → 简历摘要 → 沟通话术 → 面试准备 → tracker 建议；
- 开源基础文件：LICENSE、CONTRIBUTING、.gitignore。

## Phase 2：中文平台适配（进行中）

- [x] Boss/猎聘/脉脉文本解析规范；
- [x] 猎头 JD 清洗；
- [x] 国内招聘来源扫描骨架：公司官网 HTML、公开 JSON API、手工来源、Agent 接力；
- [x] Bookmarklet + Local Inbox 取 JD 工作流骨架；
- [ ] 内推消息解析；
- 截图 OCR 后的结构化解析建议；
- 公司官网 JD 解析。

## Phase 2.5：中国市场增强（参考 career-ops-china）

- [x] 公司深度调研模式：中文薪酬源、工时、公司口碑、工商/融资、职级；
- [x] 外包/派遣/OD/大小周红线关键词模板；
- [x] story-sync：从历史报告和 mock interview 自动回流故事库；
- [x] tracker 后端可选飞书多维表格；
- [x] 大厂职级映射表结构化配置；
- [x] Bookmarklet 站点特化增强：拉勾、Mokahr iframe、大厂 careers SPA selector。

## Phase 3：模型 Provider 层（进行中）

- [x] OpenAI-compatible 调用脚本；
- [x] 国内模型 provider 配置：DeepSeek、Qwen、豆包、Kimi、GLM、MiniMax；
- [x] 本地模型 Ollama/vLLM 配置；
- [ ] 国内模型真实 API 连通性测试；
- 模型选择策略：中文写作、复杂推理、隐私本地化。

## Phase 4：中文简历与 PDF（进行中）

- [x] 中文 Markdown 简历模板；
- [x] HTML 简历模板；
- [x] HTML 生成脚本；
- [x] PDF 生成脚本（Playwright 可选依赖）；
- 一页版、中高阶版、管理岗版、专家岗版；
- 飞书文档导出工作流。

## Phase 5：职业成长系统（已完成）

- [x] 面试故事库；
- [x] 失败复盘；
- [x] offer 对比；
- [x] 谈薪助手；
- [x] 职级对标；
- [x] AI 时代能力雷达；
- [x] 职业成长工作台模板与生成脚本。

## Phase 6：开源发布

- GitHub 仓库初始化；
- 示例截图/GIF；
- Product positioning；
- Issue 模板；
- 安全与隐私说明；
- 中文社区反馈。
