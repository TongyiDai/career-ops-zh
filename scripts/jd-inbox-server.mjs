import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const portArg = process.argv.find((arg) => arg.startsWith('--port='));
const port = Number(portArg?.split('=')[1] || process.env.CAREER_ZH_INBOX_PORT || 8787);
const inboxDir = path.join(root, 'inbox');
const maxBytes = 5_000_000;

fs.mkdirSync(inboxDir, { recursive: true });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function slugify(value, max = 48) {
  return String(value || 'unknown')
    .replace(/[\\/<>:"|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, max)
    .trim() || 'unknown';
}

function normalizePayload(payload) {
  const extracted = payload?.extracted || {};
  return {
    url: String(payload?.url || ''),
    page_title: String(payload?.page_title || ''),
    captured_at: payload?.captured_at || new Date().toISOString(),
    platform: String(payload?.platform || 'universal'),
    extracted: {
      job_title: String(extracted.job_title || ''),
      company: String(extracted.company || ''),
      location: String(extracted.location || ''),
      salary: String(extracted.salary || ''),
      description: String(extracted.description || ''),
      requirements: String(extracted.requirements || ''),
      raw_text: String(extracted.raw_text || ''),
    },
  };
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('ok');
  }

  if (req.method === 'POST' && req.url === '/jd') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxBytes) req.destroy();
    });
    req.on('end', () => {
      let payload;
      try {
        payload = normalizePayload(JSON.parse(body));
      } catch {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
      }

      if (!payload.url && !payload.extracted.raw_text) {
        res.writeHead(422, { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: 'missing url/raw_text' }));
      }

      const titleHint = payload.extracted.job_title || payload.extracted.company || payload.page_title || payload.platform;
      const filename = `jd-${timestamp()}-${slugify(payload.platform, 24)}-${slugify(titleHint)}.json`;
      const target = path.join(inboxDir, filename);
      fs.writeFileSync(target, JSON.stringify(payload, null, 2), 'utf8');

      console.log(`[${new Date().toISOString()}] saved inbox/${filename}`);
      console.log(`  platform: ${payload.platform}`);
      console.log(`  url: ${payload.url}`);
      console.log(`  title: ${titleHint}`);
      console.log(`  raw_text length: ${payload.extracted.raw_text.length}`);

      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: true, file: `inbox/${filename}` }));
    });
    return;
  }

  res.writeHead(404, { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`AI 求职助手 JD Inbox Server: http://localhost:${port}`);
  console.log(`POST /jd -> ${inboxDir}`);
  console.log('先运行 npm run build:bookmarklets，再打开 output/bookmarklets-install.html 安装书签按钮。');
});
