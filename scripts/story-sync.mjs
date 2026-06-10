import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const today = new Date().toISOString().slice(0, 10);
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const maxArg = args.find((arg) => arg.startsWith('--max='));
const maxItems = Number(maxArg?.split('=')[1] || 8);

const sourceGlobs = [
  'cv.md',
  'article-digest.md',
  'reports',
  'interview-prep',
  'data/interviews.md',
  'data/failure-reviews.md'
];

const storyBankPath = path.join(root, 'interview-prep/story-bank.md');
const outputPath = path.join(root, `output/story-sync-candidates-${today}.md`);

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function listMarkdownFiles(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return rel.endsWith('.md') ? [rel] : [];
  return fs.readdirSync(full)
    .filter((file) => file.endsWith('.md'))
    .map((file) => path.join(rel, file))
    .filter((file) => file !== 'interview-prep/story-bank.md')
    .sort();
}

function clean(text) {
  return (text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

function splitBlocks(content) {
  return content
    .split(/\n(?=#{1,4}\s)|\n\s*\n|\n(?=-\s+)/)
    .map(clean)
    .filter((block) => block.length >= 35 && block.length <= 1400)
    .filter(isStoryLikeBlock);
}

function isMarkdownTable(block) {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length >= 2 && lines.filter((line) => line.startsWith('|') && line.endsWith('|')).length >= 2;
}

function isQuestionListOnly(block) {
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const questionLines = lines.filter((line) => /[？?]$/.test(line) || /^\d+[.、]\s*.+[？?]?$/.test(line));
  return questionLines.length / lines.length >= 0.8;
}

function isAdviceOnly(block) {
  const stripped = block.replace(/^[-*]\s*/, '');
  return stripped.length < 80 && /^(不建议|建议|需要|可以|应该|不要|请)/.test(stripped);
}

function isStoryLikeBlock(block) {
  if (isMarkdownTable(block)) return false;
  if (isQuestionListOnly(block)) return false;
  if (isAdviceOnly(block)) return false;
  const hasAction = /负责|推动|参与|搭建|上线|灰度|落地|设计|协作|处理|建立|主导/.test(block);
  const hasResult = /提升|降低|增长|覆盖|转化|留存|满意度|效率|收入|成本|\d+(\.\d+)?\s*(%|人|万|千|\+|家|次|倍)/.test(block);
  const hasProject = /项目|产品|系统|平台|助手|Agent|RAG|知识库|客户|业务/.test(block);
  return hasProject && (hasAction || hasResult) && block.length >= 60;
}

function scoreBlock(block) {
  const patterns = [
    [/\bAI\b|Agent|RAG|大模型|模型|智能|自动化|知识库/g, 2],
    [/0\s*到\s*1|从\s*0\s*到\s*1|搭建|上线|灰度|落地|推进|负责/g, 2],
    [/跨团队|协作|算法|工程|设计|销售|客户成功|客户共创/g, 2],
    [/提升|降低|增长|覆盖|转化|留存|满意度|效率|收入|成本/g, 2],
    [/\d+(\.\d+)?\s*(%|人|万|千|\+|个月|周|天|家|次|倍)/g, 3],
    [/挑战|问题|失败|复盘|风险|冲突|难点|瓶颈/g, 1],
    [/面试|追问|故事|简历|匹配亮点|代表项目/g, 1]
  ];
  return patterns.reduce((sum, [regex, weight]) => sum + ((block.match(regex) || []).length * weight), 0);
}

function inferTags(text) {
  const tags = [];
  const rules = [
    ['AI 落地', /AI|Agent|RAG|大模型|模型|智能|知识库/],
    ['产品判断', /产品|需求|方案|路线|评测|指标/],
    ['业务结果', /提升|降低|增长|收入|成本|效率|覆盖|转化/],
    ['组织协作', /跨团队|协作|推进|算法|工程|设计|销售|客户成功/],
    ['客户共创', /客户|共创|交付|POC|续费|满意度/],
    ['失败复盘', /失败|复盘|拒|挂|改进|教训/]
  ];
  for (const [tag, regex] of rules) {
    if (regex.test(text)) tags.push(tag);
  }
  return tags.length ? tags.slice(0, 4) : ['待确认'];
}

function inferTitle(text) {
  const heading = text.match(/^#{1,4}\s+(.{4,60})/);
  if (heading) return heading[1].replace(/[：:]+$/, '');
  const project = text.match(/(企业知识库 AI 助手|AI Agent|RAG|知识库|评测体系|客户共创|跨团队推进|0\s*到\s*1).{0,24}/i);
  if (project) return clean(project[0]).slice(0, 34);
  return clean(text).replace(/^[-*]\s*/, '').slice(0, 34);
}

function confidence(score) {
  if (score >= 12) return '高';
  if (score >= 7) return '中';
  return '低';
}

function normalize(text) {
  return clean(text).toLowerCase().replace(/[\s\p{P}]/gu, '').slice(0, 80);
}

function themeKey(candidate) {
  const text = `${candidate.title}\n${candidate.block}`;
  const themes = [
    ['enterprise-ai-kb', /企业知识库\s*AI\s*助手|知识库.*RAG|RAG.*知识库/],
    ['agent-evaluation', /AI\s*Agent.*可用|任务完成率|工具调用成功率/],
    ['customer-co-creation', /客户共创|客户定制|产品通用化|重点客户/],
    ['cross-functional', /跨团队|算法.*工程.*设计|工程.*设计.*客户成功/],
    ['failure-review', /失败|复盘|拒信|挂面|改进/]
  ];
  for (const [key, regex] of themes) {
    if (regex.test(text)) return key;
  }
  return normalize(candidate.title).slice(0, 32);
}

function collectCandidates() {
  const files = sourceGlobs.flatMap(listMarkdownFiles).filter(exists);
  const seen = new Set();
  const candidates = [];
  for (const file of files) {
    const content = read(file);
    for (const block of splitBlocks(content)) {
      const score = scoreBlock(block);
      if (score < 5) continue;
      const key = normalize(block);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        file,
        title: inferTitle(block),
        block,
        score,
        tags: inferTags(block),
        confidence: confidence(score)
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function existingStoryKeys() {
  if (!fs.existsSync(storyBankPath)) return new Set();
  const content = fs.readFileSync(storyBankPath, 'utf8');
  return new Set((content.match(/^###\s+.+$/gm) || []).map(normalize));
}

function renderStory(candidate, index) {
  const id = `STORY-DRAFT-${String(index + 1).padStart(3, '0')}`;
  return `### ${id}｜${candidate.title}

- **适用岗位：** 待用户确认
- **适用问题：** 0-1 项目 / 跨部门协作 / AI 落地 / 项目深挖
- **能力标签：** ${candidate.tags.join(' / ')}
- **可信证据：** ${candidate.file}
- **状态：** 待用户确认事实边界

#### S｜背景
${candidate.block}

#### T｜任务
待补充：请确认你在该项目中的具体责任、目标和约束。

#### A｜行动
待补充：请补充你的关键决策、协作动作和取舍。

#### R｜结果
待补充：请确认可公开表达的业务结果；如无明确数字，不要编造。

#### R+｜反思与复用
待补充：请补充这段经历可迁移到哪些岗位/场景，以及下一次会怎么做。
`;
}

function render(candidates) {
  const rows = candidates.map((item, index) => `| STORY-DRAFT-${String(index + 1).padStart(3, '0')} | ${item.title.replace(/\|/g, '/')} | ${item.tags.join(' / ')} | ${item.file} | ${item.confidence} | 人工确认后入库 |`).join('\n');
  return `# Story Sync 候选故事

**生成日期：** ${today}  
**模式：** ${apply ? '已请求追加到故事库' : '预览，不修改故事库'}

> 这些内容是从本地历史材料中提取的故事草稿。请先确认事实边界、指标是否可公开、个人贡献是否准确，再改成正式 STORY 编号。

| ID | 标题 | 能力标签 | 证据来源 | 置信度 | 建议动作 |
|---|---|---|---|---:|---|
${rows || '| - | 未发现候选故事 | - | - | - | 补充 cv.md、reports 或 data/interviews.md |'}

${candidates.map(renderStory).join('\n')}
`;
}

const existing = existingStoryKeys();
const selected = [];
const selectedThemes = new Set();
for (const candidate of collectCandidates()) {
  if (existing.has(normalize(candidate.title))) continue;
  const key = themeKey(candidate);
  if (selectedThemes.has(key)) continue;
  selectedThemes.add(key);
  selected.push(candidate);
  if (selected.length >= maxItems) break;
}
const candidates = selected;
const content = render(candidates);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, content, 'utf8');
console.log(`written ${path.relative(root, outputPath)}`);

if (apply && candidates.length) {
  fs.mkdirSync(path.dirname(storyBankPath), { recursive: true });
  const appendix = `\n## Story Sync 草稿（${today}）\n\n${candidates.map(renderStory).join('\n')}\n`;
  fs.appendFileSync(storyBankPath, appendix, 'utf8');
  console.log(`appended ${path.relative(root, storyBankPath)}`);
} else if (apply) {
  console.log('no new candidates to append');
}
