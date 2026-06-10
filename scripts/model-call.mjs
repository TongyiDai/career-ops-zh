import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function parseArgs(argv) {
  const args = { provider: null, prompt: null, file: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--provider') args.provider = argv[++i];
    else if (arg === '--prompt') args.prompt = argv[++i];
    else if (arg === '--file') args.file = argv[++i];
    else if (!args.prompt) args.prompt = arg;
  }
  return args;
}

function readConfig() {
  const file = path.join(root, 'config/model-providers.yml');
  if (!fs.existsSync(file)) {
    throw new Error('config/model-providers.yml 不存在，请先运行 npm run init:user');
  }
  return fs.readFileSync(file, 'utf8');
}

function getBlock(yaml, provider) {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${provider}:`);
  if (start === -1) throw new Error(`未找到 provider: ${provider}`);
  const block = {};
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^  [a-zA-Z0-9_-]+:\s*$/.test(line)) break;
    const match = line.match(/^    ([a-zA-Z0-9_-]+):\s*"?([^"#]+?)"?\s*(?:#.*)?$/);
    if (match) block[match[1]] = match[2].trim();
  }
  return block;
}

async function callOpenAICompatible(provider, cfg, prompt) {
  const apiKey = process.env[cfg.api_key_env];
  if (!apiKey && provider !== 'ollama') {
    throw new Error(`环境变量 ${cfg.api_key_env} 未设置`);
  }
  const baseUrl = cfg.base_url?.replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: '你是 AI 求职助手，面向中文求职市场，输出专业、克制、结构化的中文建议。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`模型调用失败 ${res.status}: ${text}`);
  const json = JSON.parse(text);
  return json.choices?.[0]?.message?.content ?? text;
}

async function main() {
  const args = parseArgs(process.argv);
  const yaml = readConfig();
  const provider = args.provider || (yaml.match(/^default_provider:\s*([^\n]+)/m)?.[1] || 'current-agent').trim();
  let prompt = args.prompt || '';
  if (args.file) prompt = fs.readFileSync(path.resolve(root, args.file), 'utf8');
  if (!prompt) {
    console.error('用法：npm run model:call -- --provider deepseek --prompt "..."');
    console.error('或：npm run model:call -- --provider qwen --file examples/jd-example.md');
    process.exit(1);
  }

  if (provider === 'current-agent') {
    console.log(JSON.stringify({
      ok: false,
      provider,
      message: 'current-agent 表示由当前 AI Agent 处理，不通过脚本调用 API。请指定 --provider deepseek/qwen/doubao/kimi/glm/minimax/ollama/openai 等。'
    }, null, 2));
    return;
  }

  const cfg = getBlock(yaml, provider);
  if (cfg.type !== 'openai-compatible') {
    throw new Error(`当前脚本 v0.1 仅支持 openai-compatible provider，${provider} 的 type=${cfg.type}`);
  }
  const output = await callOpenAICompatible(provider, cfg, prompt);
  console.log(output);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

