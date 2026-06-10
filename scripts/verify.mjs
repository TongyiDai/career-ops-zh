import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const checks = [
  ['package.json', '项目 package 文件'],
  ['README.md', '项目说明'],
  ['AGENTS.md', 'Agent 说明'],
  ['config/profile.example.yml', '用户画像模板'],
  ['config/model-providers.example.yml', '模型供应商模板'],
  ['config/domestic-portals.example.json', '国内招聘来源配置模板'],
  ['config/company-careers.cn.example.json', '中国热门行业公司官网招聘页目录'],
  ['config/level-mapping.cn.example.yml', '中国大厂职级映射参考配置'],
  ['config/tracker-backends.example.json', 'Tracker 后端配置模板'],
  ['modes/_shared.md', '共享模式'],
  ['modes/evaluate.md', '岗位评估模式'],
  ['modes/resume.md', '简历模式'],
  ['modes/message.md', '沟通模式'],
  ['modes/interview.md', '面试模式'],
  ['modes/tracker.md', '管道模式'],
  ['modes/coach.md', '职业策略模式'],
  ['modes/growth.md', '职业成长系统模式'],
  ['modes/story-sync.md', '故事库同步模式'],
  ['modes/inbox.md', 'JD Inbox 捕获处理模式'],
  ['modes/research.md', '公司深度调研模式'],
  ['modes/auto-pipeline.md', '完整链路模式'],
  ['modes/parse-jd.md', '中文 JD 解析模式'],
  ['templates/states.yml', '状态模板'],
  ['templates/resume-template.md', '简历模板'],
  ['templates/resume-template.html', 'HTML 简历模板'],
  ['templates/growth-kit-template.md', '职业成长系统模板'],
  ['.agents/skills/career-zh/SKILL.md', 'career-zh Skill 路由'],
  ['LICENSE', '开源许可证'],
  ['CONTRIBUTING.md', '贡献指南'],
  ['docs/ROADMAP.md', '路线图'],
  ['scripts/model-call.mjs', '模型调用脚本'],
  ['scripts/evaluate-with-provider.mjs', 'Provider 岗位评估脚本'],
  ['scripts/generate-html-resume.mjs', 'HTML 简历生成脚本'],
  ['scripts/generate-pdf.mjs', 'PDF 简历生成脚本'],
  ['scripts/generate-growth-kit.mjs', '职业成长工作台生成脚本'],
  ['scripts/story-sync.mjs', '故事库同步脚本'],
  ['scripts/tracker-sync.mjs', 'Tracker 后端同步导出脚本'],
  ['scripts/scan-domestic-jobs.mjs', '国内招聘来源扫描脚本'],
  ['scripts/jd-inbox-server.mjs', 'JD Inbox 本地服务器'],
  ['scripts/build-bookmarklets.mjs', 'Bookmarklet 安装页生成脚本'],
  ['scripts/bookmarklets/universal.js', '通用 JD 捕获 bookmarklet'],
  ['scripts/bookmarklets/boss-zhipin.js', 'Boss 直聘 JD 捕获 bookmarklet'],
  ['scripts/bookmarklets/company-careers-spa.js', '大厂官网 Careers SPA JD 捕获 bookmarklet'],
  ['scripts/bookmarklets/lagou.js', '拉勾 JD 捕获 bookmarklet'],
  ['scripts/bookmarklets/liepin.js', '猎聘 JD 捕获 bookmarklet'],
  ['scripts/bookmarklets/mokahr-spa.js', 'Mokahr/SPA JD 捕获 bookmarklet']
];

const rows = checks.map(([file, label]) => ({
  file,
  label,
  exists: fs.existsSync(path.join(root, file))
}));

const missing = rows.filter((row) => !row.exists);

console.log(JSON.stringify({ ok: missing.length === 0, checks: rows, missing }, null, 2));

if (missing.length > 0) process.exitCode = 1;
