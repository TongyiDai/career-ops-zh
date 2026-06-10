import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function copyIfMissing(src, dest) {
  const from = path.join(root, src);
  const to = path.join(root, dest);
  if (!fs.existsSync(to)) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    console.log(`created ${dest}`);
  } else {
    console.log(`exists ${dest}`);
  }
}

function writeIfMissing(file, content) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    console.log(`created ${file}`);
  } else {
    console.log(`exists ${file}`);
  }
}

function mkdirIfMissing(dir) {
  const target = path.join(root, dir);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
    console.log(`created ${dir}`);
  } else {
    console.log(`exists ${dir}`);
  }
}

copyIfMissing('config/profile.example.yml', 'config/profile.yml');
copyIfMissing('config/model-providers.example.yml', 'config/model-providers.yml');
copyIfMissing('config/domestic-portals.example.json', 'config/domestic-portals.json');
copyIfMissing('config/level-mapping.cn.example.yml', 'config/level-mapping.cn.yml');
copyIfMissing('config/tracker-backends.example.json', 'config/tracker-backends.json');
mkdirIfMissing('inbox/processed');
mkdirIfMissing('inbox/errors');

writeIfMissing('cv.md', `# 请在这里填写你的中文简历\n\n## 个人摘要\n\n请写 3-5 行：你的职业主线、核心能力、代表成果和目标方向。\n\n## 工作经历\n\n### 公司｜岗位｜时间\n\n- 负责：\n- 推动：\n- 结果：\n\n## 代表项目\n\n### 项目名称\n\n- 背景：\n- 角色：\n- 做法：\n- 结果：\n\n## 教育经历\n\n## 技能关键词\n`);

writeIfMissing('article-digest.md', `# 项目/作品/案例证据库\n\n用于沉淀简历之外的证明材料：项目链接、文章、案例、指标、截图说明等。\n\n## 代表成果\n\n- 名称：\n- 链接：\n- 指标：\n- 可用于哪些岗位：\n`);

writeIfMissing('interview-prep/story-bank.md', `# 面试故事库 Story Bank\n\n> 用于沉淀可复用的 STAR+R 故事。所有故事必须来自真实经历：cv.md、article-digest.md、面试复盘或用户补充。\n\n## 故事索引\n\n| ID | 故事标题 | 适用问题 | 能力标签 | 证据来源 | 最后更新 |\n|---|---|---|---|---|---|\n\n## 待补充故事\n\n### STORY-001｜{故事标题}\n\n- 适用岗位：\n- 适用问题：\n- 能力标签：\n- 可信证据：\n\n#### S｜背景\n#### T｜任务\n#### A｜行动\n#### R｜结果\n#### R+｜反思与复用\n`);

writeIfMissing('data/offers.md', `# Offer 对比记录\n\n| 日期 | 公司 | 岗位 | 职级/Title | Base | Bonus | 股票/期权 | 总包 | 城市/远程 | 状态 | 关键风险 | 决策 |\n|---|---|---|---|---:|---:|---:|---:|---|---|---|---|\n`);

writeIfMissing('data/failure-reviews.md', `# 失败复盘记录\n\n| 日期 | 公司 | 岗位 | 阶段 | 结果 | 最可能原因 | 可控改进 | 不可控因素 | 下一步 |\n|---|---|---|---|---|---|---|---|---|\n`);

writeIfMissing('data/growth-radar.md', `# AI 时代能力雷达\n\n| 日期 | AI 工具熟练度 | Agent/自动化思维 | 业务结构化 | 数据与评测 | 技术理解边界 | 产品化/规模化 | 组织推动力 | 职业叙事表达 | 下一个动作 |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---|\n`);

console.log('user initialization complete');
