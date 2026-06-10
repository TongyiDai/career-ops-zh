# AI 求职助手

面向中文求职市场的 AI 职业操作系统。

如果说招聘方已经在用 AI 扫简历、排候选人、写面评，那么候选人也应该拥有自己的 AI 作战室：**看清机会、讲清自己、少走弯路、少投垃圾岗位**。

它不是海投机器，也不是“把简历润色得更漂亮”的小工具，而是帮你把求职变成一套可执行流程：

```text
职业定位 → 岗位发现 → JD 初筛 → 深度评估 → 简历定制 → 沟通话术 → 面试准备 → 管道跟进 → 复盘成长
```

> 公司用 AI 筛候选人。我们把 AI 交给候选人，让候选人更清醒地筛机会、讲清自己、管理职业选择。

## 这个项目能给求职者什么价值？

### 1. 不再被岗位标题牵着走

“AI 产品经理”“解决方案架构师”“客户成功”“增长运营”“专家”这些 title 很容易让人误判。AI 求职助手会结合你的 `cv.md` 和 `config/profile.yml` 判断：

- 这个岗位到底属于什么角色类型？
- 它和你的真实经历是否对齐？
- 是值得重点推进，还是只是关键词看起来很美？
- 风险是偏技术、偏销售、偏产品、偏低阶，还是职责模糊？

### 2. 不只是告诉你“投不投”，还告诉你“怎么投”

对一个岗位，它会继续追问：

- 简历应该突出哪段经历？
- Boss / 猎头 / 内推应该怎么开口？
- 面试官最可能追问什么？
- 你该怎么解释转型、空窗、行业切换、职级变化？
- 这个机会对下一阶段职业叙事有没有帮助？

### 3. 把求职从“焦虑刷岗位”变成“经营机会管道”

你可以把 JD、联系人、面试记录、Offer、失败复盘都沉淀下来。每一次面试不是孤立事件，而是下一次表达和判断的素材。

## 受哪些开源项目启发？

本项目受两个开源项目启发，并在中文求职场景下重新设计：

- **`career-ops`**：启发了“职业操作系统”的整体思路，包括岗位评估、简历定制、沟通、面试、管道管理等模块化 workflow。
- **`career-ops-china`**：启发了中文求职市场增强能力，包括本地 tracker、故事库沉淀、国内平台语境、JD inbox / bookmarklet 等思路。

在此基础上，`career-ops-zh` 做了几件更偏中文候选人的事：

- 用中文求职语境重写模式文件，不照搬 Cover Letter / ATS 逻辑；
- 增加国内公司官网和公开招聘接口扫描；
- 增加基于用户画像的本地岗位初筛报告；
- 强化“职业叙事”和“角色匹配”，避免只按关键词推荐；
- 默认保护隐私：真实简历、画像、投递记录和输出报告不进入 Git。

## 求职者操作 SOP：从 0 到一次高质量投递

下面这套流程适合第一次使用，也适合每次认真推进一个新岗位。

### Step 0：安装和初始化

```bash
git clone https://github.com/TongyiDai/career-ops-zh.git
cd career-ops-zh
npm install
npm run doctor
npm run init:user
```

初始化后重点填写三个文件：

| 文件 | 怎么填 | 作用 |
|---|---|---|
| `cv.md` | 写你的真实中文简历事实，不要夸张、不编造 | 所有简历、面试故事和匹配判断的事实源 |
| `config/profile.yml` | 写目标岗位、城市、行业、薪资、不接受项、职业叙事 | 决定系统如何筛岗位、排序和标风险 |
| `article-digest.md` | 放作品、项目、文章、案例、截图说明 | 给简历和面试提供证据库 |

### Step 1：先让 AI 帮你校准职业定位

把你的简历和目标说清楚后，让 Agent 读取 `cv.md` + `config/profile.yml`，请它回答：

```text
/career-zh coach
请基于我的 cv.md 和 profile.yml，判断我最适合的 3 条求职主线、应该避开的岗位类型，以及简历叙事该怎么讲。
```

目标不是得到一个“漂亮人设”，而是得到一个能解释你过往经历、也能连接下一步机会的职业叙事。

### Step 2：获得岗位，可以有三种方式

#### 方式 A：最简单，直接粘 JD

```text
/career-zh evaluate
【粘贴 Boss / 猎聘 / 官网 / 猎头发来的 JD】
```

#### 方式 B：用 bookmarklet 从浏览器捕获 JD

```bash
npm run inbox-server
npm run build:bookmarklets
```

然后打开 `output/bookmarklets-install.html`，把按钮拖到浏览器书签栏。之后你在 Boss、猎聘、拉勾、Mokahr、大厂官网看到 JD，点一下书签按钮，JD 会进入本地 `inbox/*.json`。

#### 方式 C：扫描公司官网 / 公开招聘接口

```bash
# 示例：扫描后生成岗位初筛报告
PYTHON=/path/to/python npm run scan:domestic -- \
  --config=config/company-careers.cn.example.json \
  --source=阿里巴巴 \
  --include-disabled \
  --recommend \
  --recommend-limit=10
```

报告会输出：分数、建议、公司、岗位、城市、角色判断、命中点、风险和可点击投递链接。

### Step 3：先初筛，再深评

不要看到岗位就投。建议先分三档：

| 档位 | 动作 |
|---|---|
| 重点推进 | 打开 JD 原链接，做正式评估，准备定制简历和内推话术 |
| 可推进 | 看团队、职责和职级是否清晰，再决定是否投入时间 |
| 备选观察 / 谨慎 | 暂不花太多时间，除非有强内推或 JD 明显补充了匹配信息 |

正式评估：

```text
/career-zh evaluate
【粘贴 JD】
```

你应该得到：

- 是否值得投；
- 为什么匹配；
- 哪些地方有风险；
- 简历应该突出什么；
- 面试会被追问什么；
- 投递优先级和推荐动作。

### Step 4：为这个岗位定制简历

```text
/career-zh resume
【粘贴 JD】
```

原则：不是“重新编一份简历”，而是从你的真实经历里选择最相关的证据，把顺序、标题、摘要、关键词和项目表达调到更适合这个岗位。

如果要生成 HTML / PDF：

```bash
npm run resume:html
npm run resume:pdf -- --input output/sample-resume.html --output output/sample-resume.pdf
```

### Step 5：写沟通话术，而不是只发“您好，我对岗位感兴趣”

```text
/career-zh message
场景：Boss 开场白 / 猎头回复 / 内推请求 / 微信私聊 / 面试后 follow-up / 谈薪
岗位：...
我的匹配点：...
```

好的话术应该做到三件事：

1. 一句话说明你是谁；
2. 两三个证据说明为什么匹配；
3. 给对方一个低成本下一步，比如“方便的话我可以发一版针对该岗位的简历”。

### Step 6：面试前把故事讲顺

```text
/career-zh interview
【粘贴 JD 或公司信息】
```

重点准备：

- 30 秒 / 2 分钟自我介绍；
- 2-3 个最能证明匹配度的项目故事；
- 面试官可能追问的风险问题；
- 你要反问对方的团队、业务、目标和岗位真实性问题。

### Step 7：每周复盘一次，不让经验流失

```text
/career-zh growth
请根据本周投递、面试和反馈，帮我更新失败复盘、故事库和下周动作。
```

一次失败面试不是浪费，它应该沉淀成：一个更清楚的故事、一个风险回答、一条岗位筛选规则，或者一次职业定位修正。

## 核心原则

1. **质量优先，不鼓励海投**：只认真推进高匹配机会。
2. **人类在环**：AI 负责评估、草拟和建议，最终投递/发送/接受 offer 必须由人决定。
3. **职业叙事优先**：不只列经历，而是帮你讲清“我是谁、我解决过什么问题、我下一步适合什么”。
4. **中文市场优先**：围绕 Boss、猎聘、脉脉、内推、猎头、微信沟通和中文面试语境设计。
5. **模型中立**：兼容国外模型、国内模型和本地模型，不绑定单一供应商。
6. **隐私默认本地优先**：真实简历、画像、投递记录、报告默认留在本地，不进入 Git。

## 模型兼容策略

AI 求职助手不假设你一定使用 OpenAI/Claude，也不假设你只能使用国内模型。项目分为两层：

### 1. AI CLI / Agent 层

适合直接在这些工具里使用本项目：

| 工具 | 典型模型/生态 | 用法 |
|---|---|---|
| Claude Code | Claude | 读取 `AGENTS.md` 和 `modes/*.md` 执行 |
| Codex / OpenAI CLI | GPT 系列 | 执行同一套模式文件 |
| Gemini CLI | Gemini | 执行同一套模式文件 |
| Qwen Code / 通义系 CLI | Qwen | 执行同一套中文模式 |
| 豆包 / 火山方舟工具链 | Doubao / Seed | 通过 API 或兼容 CLI 接入 |
| DeepSeek / Kimi / 智谱 / MiniMax | 国产大模型 | 通过 OpenAI-compatible API 或自定义脚本接入 |
| Ollama / vLLM | 本地模型 | 通过本地 OpenAI-compatible endpoint 接入 |

### 2. Provider 配置层

`config/model-providers.example.yml` 预留了模型供应商配置，支持：

- OpenAI-compatible API；
- Anthropic；
- Google Gemini；
- 阿里云百炼 / 通义千问；
- 火山方舟 / 豆包；
- DeepSeek；
- Moonshot / Kimi；
- 智谱 GLM；
- MiniMax；
- Ollama / 本地模型。

原则：

- 默认用你当前 AI Agent 的能力；
- 需要批量处理、扫描、自动评估时，再启用 provider 配置；
- 所有模型输出都必须遵循本项目的中文评估框架和人类复核原则。

## MVP 命令设计

```text
/career-zh                    显示命令菜单
/career-zh evaluate {JD}       岗位匹配评估
/career-zh resume {JD}         生成岗位定制中文简历
/career-zh message             生成 Boss/猎头/内推/微信沟通话术
/career-zh interview {JD}      生成面试准备材料
/career-zh tracker             查看/更新求职管道
/career-zh coach               职业策略顾问
/career-zh parse-jd            解析 Boss/猎聘/猎头/内推等非标准 JD
/career-zh growth              职业成长系统：故事库、复盘、Offer、谈薪、职级、能力雷达
/career-zh story-sync          从历史报告/面试记录同步 STAR 故事库
/career-zh scan                扫描国内公司官网/公开招聘接口
/career-zh inbox               处理 bookmarklet 捕获到本地的 JD
/career-zh research            公司/团队/薪酬/工时深度调研
```

## Tracker 后端：本地 Markdown + 可选飞书多维表格

默认情况下，求职管道仍写入本地 Markdown：`data/applications.md`、`data/followups.md`、`data/interviews.md`、`data/contacts.md`。如果需要团队协作、移动端查看或仪表盘，可以把这些表导出为飞书多维表格 records package：

```bash
# 预览导出，不联网、不写飞书
npm run tracker:sync

# 初始化后复制 config/tracker-backends.example.json 到 config/tracker-backends.json
npm run init:user

# 填好 app_token/table_id 后，用自己的配置导出
npm run tracker:sync -- --config=config/tracker-backends.json --backend=lark-base
```

输出文件位于 `output/tracker-lark-base-records-YYYY-MM-DD.json`。脚本默认不直接写入飞书，目的是避免误同步隐私信息；真正写入前应确认 Base 权限、字段映射和去重 key。

如需真实写入飞书，可在确认 Base 字段和权限后显式追加 `--execute-lark`。脚本会先按配置中的 `key_fields` 查询已有记录：命中 0 条则创建，命中 1 条则带 `record-id` 更新，命中多条会拒绝写入以避免重复污染。

## Story Sync：从历史材料回流故事库

参考 `career-ops-china` 的故事库沉淀思路，项目提供了本地 `story-sync` 脚本：从 `reports/*.md`、`interview-prep/*.md`、`data/interviews.md`、`data/failure-reviews.md`、`cv.md`、`article-digest.md` 中提取可复用 STAR+R 故事线索。

```bash
# 预览候选故事，不修改故事库
npm run story-sync

# 人工确认后追加草稿到 interview-prep/story-bank.md
npm run story-sync -- --apply
```

默认会生成 `output/story-sync-candidates-YYYY-MM-DD.md`。所有候选故事都会保留证据来源，并标记为“待用户确认事实边界”，避免编造经历或指标。

## Bookmarklet + Local Inbox

参考 `career-ops-china` 的核心经验：国内 JD 取数不要硬爬 Boss/猎聘/Mokahr/大厂 SPA。更稳定的路径是：**用户在浏览器里打开 JD → 点击书签按钮 → 本地服务器接收 JSON → AI 批量处理 inbox**。

```bash
# 1. 启动本地 JD inbox server
npm run inbox-server

# 2. 生成 bookmarklet 安装页
npm run build:bookmarklets

# 3. 打开 output/bookmarklets-install.html，把按钮拖到浏览器书签栏
```

捕获后的 JD 会写入：

```text
inbox/*.json
```

然后使用 `/career-zh inbox` 处理。当前内置：通用、Boss 直聘、猎聘、拉勾、Mokahr/大厂 SPA、公司官网 Careers SPA 捕获按钮。数据只发送到本机 `localhost:8787`，不会发给第三方。

## 国内招聘来源扫描

项目已加入国内版扫描骨架，参考原 `career-ops` 的 provider 思路，但针对中文市场做了边界调整：

- 对**公司官网招聘页**：支持 `static-html`，抓取公开网页中的职位链接；
- 对**公开 JSON 接口**：支持 `public-json`，通过配置映射 title/url/location/company 字段；
- 对**已适配的大厂招聘 API / SSR 数据 / SPA 渲染**：当前支持 `tencent-careers`、`baidu-careers`、`jd-careers`、`netease-careers`、`xiaomi-careers`、`ctrip-careers`、`python-browser` 等 provider；已验证可抓取腾讯、百度、京东、小米、网易、携程、字节跳动、阿里巴巴/阿里云/阿里健康/菜鸟等官网公开岗位；
- 对**手工维护或测试来源**：支持 `manual-list`；
- 对 **Boss 直聘、猎聘、拉勾、智联、前程无忧** 等强登录/强风控平台：默认走 `agent-handoff`，不绕过登录、不模拟用户、不自动投递，只给搜索建议，并鼓励用户粘贴 JD 后解析。

```bash
# dry-run：使用示例配置，不写入 data
npm run scan:domestic -- --dry-run

# 初始化后会复制 config/domestic-portals.example.json 到 config/domestic-portals.json
npm run init:user

# 使用自己的国内招聘来源配置扫描
npm run scan:domestic -- --config=config/domestic-portals.json

# 只扫描某个来源
npm run scan:domestic -- --source=示例公司

# 审计公司官网目录可访问性/可抽取性，不写入 pipeline
npm run scan:domestic -- --config=config/company-careers.cn.example.json --include-disabled --audit-sources --limit=20

# 扫描后生成本地岗位初筛报告，用于把官网岗位接入“匹配判断”链路
PYTHON=/path/to/python npm run scan:domestic -- --config=config/company-careers.cn.example.json --source=阿里巴巴 --include-disabled --dry-run --recommend --recommend-limit=10
```

扫描结果会写入：

```text
data/pipeline.md
data/domestic-scan-history.tsv
```

追加 `--recommend` 后，还会生成：

```text
output/domestic-job-recommendations-YYYY-MM-DD.md
```

该报告会基于 `config/profile.yml`、`cv.md` 和岗位 title/company/location 做本地启发式初筛，输出 Top 岗位、分数、建议、命中点和风险。它不是正式 LLM 岗位评估；对高分岗位，仍应打开原 JD 复核后再使用 `/career-zh evaluate` 或 `npm run evaluate:provider` 生成完整评估报告。

配置模板位于：

```text
config/domestic-portals.example.json
config/company-careers.cn.example.json
```

注意：`company-careers.cn.example.json` 是 200+ 公司官网招聘入口目录，不等于这些公司都已经能稳定抽取岗位。很多大厂招聘站是 SPA、需要公开 JSON API、动态渲染或站点特化 selector；可先用 `--audit-sources` 生成审计报告，再逐个把可靠来源从 `disabled` 改为 `enabled`。

其中 `config/company-careers.cn.example.json` 按热门行业整理了 20+ 个行业、200+ 家明星公司的官网招聘页候选入口，默认全部关闭。建议复制为自己的配置后，先启用少量行业验证：

```bash
npm run scan:domestic -- --config=config/company-careers.cn.example.json --industry=ai-foundation-models --dry-run

# 只预览某个行业的候选来源，不访问网页
npm run scan:domestic -- --config=config/company-careers.cn.example.json --industry=ai-foundation-models --include-disabled --list-sources
```

## 简历生成

AI 求职助手支持从 Markdown 简历生成中文 HTML 简历，并可选生成 PDF。

```bash
# 从 cv.md 生成 HTML
npm run resume:html

# 指定输入输出
npm run resume:html -- --input output/001-tailored-resume-sample.md --output output/sample-resume.html

# 生成 PDF（需要先安装 Playwright）
npm install playwright
npx playwright install chromium
npm run resume:pdf -- --input output/sample-resume.html --output output/sample-resume.pdf
```

HTML 模板位于：

```text
templates/resume-template.html
```

## 职业成长系统

Phase 5 开始，AI 求职助手不只服务“投递当下”，也服务长期职业复利：

- `interview-prep/story-bank.md`：面试故事库，把真实经历沉淀成 STAR+R 故事；
- `data/failure-reviews.md`：失败复盘，记录挂面、拒信、流程停滞和可改进动作；
- `data/offers.md`：Offer 对比，统一记录薪资结构、职级、风险和决策；
- `data/growth-radar.md`：AI 时代能力雷达，持续评估能力缺口；
- `modes/growth.md`：统一的职业成长模式，覆盖谈薪、职级对标、Offer 判断和 30/60/90 天成长计划。

生成职业成长工作台模板：

```bash
npm run growth:kit

# 指定输出路径
npm run growth:kit -- --output=output/my-growth-kit.md
```

## 目录结构

```text
career-ops-zh/
  AGENTS.md                    AI Agent 使用说明
  README.md                    项目说明
  config/
    profile.example.yml        候选人画像模板
    model-providers.example.yml 模型供应商配置模板
    domestic-portals.example.json 国内招聘来源配置模板
    company-careers.cn.example.json 中国热门行业公司官网招聘页目录
  data/
    applications.md            求职管道
    contacts.md                人脉/猎头/内推联系人
    followups.md               跟进记录
    interviews.md              面试记录
    offers.md                  Offer 对比记录
    failure-reviews.md         失败复盘记录
    growth-radar.md            AI 时代能力雷达
  interview-prep/
    story-bank.md              面试故事库
  modes/
    _shared.md                 共享规则
    evaluate.md                岗位评估
    resume.md                  简历定制
    message.md                 沟通话术
    interview.md               面试准备
    tracker.md                 管道管理
    coach.md                   职业策略
    growth.md                  职业成长系统
    inbox.md                   JD Inbox 捕获处理模式
    research.md                公司深度调研模式
  templates/
    resume-template.md         中文简历模板
    growth-kit-template.md     职业成长工作台模板
    states.yml                 求职状态枚举
  scripts/
    doctor.mjs                 初始化检查
    init-user.mjs              创建用户文件
    verify.mjs                 完整性检查
    generate-growth-kit.mjs    职业成长工作台生成脚本
    scan-domestic-jobs.mjs     国内招聘来源扫描脚本
    jd-inbox-server.mjs        本地 JD Inbox 服务器
    build-bookmarklets.mjs     Bookmarklet 安装页生成脚本
    bookmarklets/              浏览器 JD 捕获脚本
```

## 快速开始

```bash
cd career-ops-zh
npm run doctor
npm run init:user
```

然后补充：

- `cv.md`：你的中文简历事实源；
- `config/profile.yml`：目标岗位、薪酬、城市、偏好、职业叙事；
- 可选：`article-digest.md`：项目、文章、案例、作品集证据。

## 典型流程

### 1. 评估一个岗位

把 JD 粘给 AI Agent：

```text
/career-zh evaluate
【粘贴 Boss/猎聘/官网 JD】
```

输出：

- 总评分；
- 是否值得推进；
- 匹配点；
- 风险信号；
- 投递策略；
- 简历应强调什么；
- 面试会被追问什么。

### 2. 生成中文定制简历

```text
/career-zh resume
【粘贴 JD】
```

输出：

- 岗位定制版中文简历；
- 项目顺序调整建议；
- Summary；
- 关键词映射；
- 可选 PDF/Markdown 模板。

### 3. 生成沟通话术

```text
/career-zh message
场景：Boss 开场白 / 猎头回复 / 内推请求 / 微信私聊 / 面试后 follow-up / 谈薪
```

### 4. 面试准备

```text
/career-zh interview
【粘贴 JD 或公司信息】
```

输出：

- 30 秒 / 2 分钟自我介绍；
- 项目深挖稿；
- STAR 故事；
- 可能追问；
- 反问清单；
- 风险问题回答。

## 开源定位

AI 求职助手适合：

- 中高阶候选人；
- 互联网/AI/产品/技术/运营/HR/解决方案/商业化方向；
- 正在转型 AI、Agent、数字化、组织效率相关岗位的人；
- 不想海投，而想系统化经营职业机会的人。

## 伦理边界

- 不自动提交申请；
- 不伪造经历；
- 不建议低匹配海投；
- 不替用户做最终职业决定；
- 所有薪资、履历、项目数据必须由用户确认。
