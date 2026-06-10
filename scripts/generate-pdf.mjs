import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function parseArgs(argv) {
  const args = {
    input: 'output/resume.html',
    output: 'output/resume.pdf',
    source: 'cv.md'
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--input') args.input = argv[++i];
    else if (arg === '--output') args.output = argv[++i];
    else if (arg === '--source') args.source = argv[++i];
  }
  return args;
}

async function ensureHtml(args) {
  const htmlPath = path.resolve(root, args.input);
  if (fs.existsSync(htmlPath)) return;
  const child = spawnSync(process.execPath, ['scripts/generate-html-resume.mjs', '--input', args.source, '--output', args.input], {
    cwd: root,
    encoding: 'utf8'
  });
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  if (child.status !== 0) process.exit(child.status ?? 1);
}

async function main() {
  const args = parseArgs(process.argv);
  await ensureHtml(args);

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('缺少 playwright。请先执行：npm install playwright && npx playwright install chromium');
    process.exit(1);
  }

  const inputPath = path.resolve(root, args.input);
  const outputPath = path.resolve(root, args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(inputPath).href, { waitUntil: 'networkidle' });
  await page.pdf({ path: outputPath, format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
  await browser.close();

  console.log(JSON.stringify({ ok: true, input: args.input, output: args.output }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

