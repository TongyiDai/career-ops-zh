import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const providerIndex = process.argv.indexOf('--provider');
const fileIndex = process.argv.indexOf('--file');
const provider = providerIndex >= 0 ? process.argv[providerIndex + 1] : 'deepseek';
const file = fileIndex >= 0 ? process.argv[fileIndex + 1] : 'examples/jd-example.md';

const shared = fs.readFileSync('modes/_shared.md', 'utf8');
const evaluate = fs.readFileSync('modes/evaluate.md', 'utf8');
const cv = fs.existsSync('cv.md') ? fs.readFileSync('cv.md', 'utf8') : '';
const profile = fs.existsSync('config/profile.yml') ? fs.readFileSync('config/profile.yml', 'utf8') : '';
const jd = fs.readFileSync(file, 'utf8');

const prompt = `请基于以下 AI 求职助手规则，评估岗位并输出中文岗位评估报告。\n\n# 共享规则\n${shared}\n\n# 评估模式\n${evaluate}\n\n# 用户画像\n${profile}\n\n# 用户简历\n${cv}\n\n# JD\n${jd}`;

const child = spawnSync(process.execPath, ['scripts/model-call.mjs', '--provider', provider, '--prompt', prompt], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024
});

if (child.stdout) process.stdout.write(child.stdout);
if (child.stderr) process.stderr.write(child.stderr);
process.exit(child.status ?? 0);

