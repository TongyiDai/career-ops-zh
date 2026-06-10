import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function parseArgs(argv) {
  const args = {
    input: 'cv.md',
    output: 'output/resume.html',
    title: 'AI 求职助手 - 中文简历'
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input') args.input = argv[++i];
    else if (arg === '--output') args.output = argv[++i];
    else if (arg === '--title') args.title = argv[++i];
  }
  return args;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inlineMarkdown(text) {
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`(.+?)`/g, '<code>$1</code>');
  return s;
}

function markdownToHtml(md) {
  const lines = md.split(/\r?\n/);
  const html = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }
  closeList();
  return html.join('\n');
}

const args = parseArgs(process.argv);
const inputPath = path.resolve(root, args.input);
const outputPath = path.resolve(root, args.output);
const templatePath = path.resolve(root, 'templates/resume-template.html');

if (!fs.existsSync(inputPath)) {
  console.error(`输入文件不存在：${args.input}`);
  process.exit(1);
}
if (!fs.existsSync(templatePath)) {
  console.error('模板不存在：templates/resume-template.html');
  process.exit(1);
}

const md = fs.readFileSync(inputPath, 'utf8');
const template = fs.readFileSync(templatePath, 'utf8');
const content = markdownToHtml(md);
const title = md.match(/^#\s+(.+)$/m)?.[1] || args.title;
const html = template
  .replaceAll('{{TITLE}}', escapeHtml(title))
  .replaceAll('{{CONTENT}}', content.split('\n').map((line) => `      ${line}`).join('\n'));

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');
console.log(JSON.stringify({ ok: true, input: args.input, output: args.output }, null, 2));

