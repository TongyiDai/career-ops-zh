import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const today = new Date().toISOString().slice(0, 10);

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function write(file, content) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  console.log(`written ${file}`);
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

const args = process.argv.slice(2);
const outputArg = args.find((arg) => arg.startsWith('--output='));
const output = outputArg?.split('=')[1] || `output/career-growth-kit-${today}.md`;

const template = read('templates/growth-kit-template.md');
const profileHint = exists('config/profile.yml')
  ? '已检测到 config/profile.yml：生成后请结合用户目标岗位、薪酬和偏好补齐。'
  : '未检测到 config/profile.yml：请先运行 npm run init:user。';

const content = `# 职业成长系统工作台

**生成日期：** ${today}  
**说明：** 这是可复制到面试准备、复盘、offer 对比和成长计划中的工作台模板。  
**上下文：** ${profileHint}

> 使用建议：先用 /career-zh growth 让 AI 基于 cv.md、profile.yml 和历史记录填充第一版，再由用户人工确认事实和边界。

${template}
`;

write(output, content);
