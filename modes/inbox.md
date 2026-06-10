# 模式：JD Inbox / Bookmarklet 捕获处理

## 目标

处理用户通过浏览器 bookmarklet 捕获到本地的 JD。这个模式用于 Boss 直聘、猎聘、Mokahr、大厂 SPA、公司官网等“用户已经在浏览器里看到 JD，但自动抓取不稳定”的场景。

核心思想：**不绕过登录/验证码/反爬；只读取用户浏览器里已经可见的内容，并写入本地 `inbox/*.json` 等待 AI 处理。**

## 前置命令

```bash
npm run inbox-server
npm run build:bookmarklets
```

然后打开：

```text
output/bookmarklets-install.html
```

把按钮拖到浏览器书签栏。

## 输入文件

```text
inbox/*.json
```

JSON 结构：

```json
{
  "url": "https://...",
  "page_title": "...",
  "captured_at": "2026-06-10T00:00:00.000Z",
    "platform": "universal | boss-zhipin | liepin | lagou | mokahr-spa | company-careers-spa",
  "extracted": {
    "job_title": "...",
    "company": "...",
    "location": "...",
    "salary": "...",
    "description": "...",
    "requirements": "...",
    "raw_text": "..."
  }
}
```

## 处理流程

1. 列出 `inbox/*.json`，跳过 `inbox/processed/`；
2. 对每个 JSON 做 triage：
   - 无正文或正文过短：提示重新捕获；
   - 命中用户 `preferences.deal_breakers`：建议 SKIP；
   - 标题明显不匹配：建议丢弃；
   - 有效 JD：进入 `parse-jd` → `evaluate` → `resume/message/interview/tracker`；
3. 报告头必须保留原始网页 URL，不要只写本地 JSON 文件名；
4. 处理后把 JSON 移到 `inbox/processed/`，避免下次重复处理。

## 输出建议

```markdown
# Inbox 处理汇总

| 文件 | 公司 | 岗位 | 来源 | 判断 | 下一步 |
|---|---|---|---|---|---|
```

## 关键规则

- 不自动投递；
- 不模拟用户登录；
- 不绕过验证码；
- 不把本地 inbox JSON 当作公开链接；
- 对 Boss/猎聘/拉勾/Mokahr/大厂 Careers SPA 这类平台，bookmarklet 是稳定主路径，WebFetch/Playwright 只能作为辅助。
