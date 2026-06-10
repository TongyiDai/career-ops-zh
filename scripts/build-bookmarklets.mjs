import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'scripts/bookmarklets');
const outputPath = path.join(root, 'output/bookmarklets-install.html');

function minifyBookmarklet(code) {
  return `javascript:${encodeURIComponent(code.replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim())}`;
}

const items = fs.readdirSync(sourceDir)
  .filter((file) => file.endsWith('.js'))
  .sort()
  .map((file) => {
    const code = fs.readFileSync(path.join(sourceDir, file), 'utf8');
    const title = file.replace(/\.js$/, '').replace(/-/g, ' ');
    return { file, title, href: minifyBookmarklet(code) };
  });

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>AI 求职助手 Bookmarklets</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; padding: 40px; line-height: 1.7; color: #172033; background: #f7f8fb; }
    .card { max-width: 900px; margin: 0 auto; background: #fff; border: 1px solid #e8ebf2; border-radius: 20px; padding: 32px; box-shadow: 0 12px 40px rgba(31, 42, 68, .08); }
    .btn { display: inline-block; margin: 8px 10px 8px 0; padding: 10px 14px; border-radius: 999px; background: #2454ff; color: #fff; text-decoration: none; font-weight: 700; }
    code { background: #eef2ff; border-radius: 6px; padding: 2px 6px; }
    li { margin: 6px 0; }
  </style>
</head>
<body>
  <main class="card">
    <h1>AI 求职助手：JD 捕获书签按钮</h1>
    <p>先运行 <code>npm run inbox-server</code>，然后把下面按钮拖到浏览器书签栏。打开 Boss/猎聘/公司官网 JD 后点击按钮，会把当前页面中你已经能看到的 JD 写入本地 <code>inbox/*.json</code>。</p>
    <section>
      ${items.map((item) => `<a class="btn" href="${item.href}">📥 ${item.title}</a>`).join('\n      ')}
    </section>
    <h2>使用步骤</h2>
    <ol>
      <li>终端运行 <code>npm run inbox-server</code>。</li>
      <li>把上面的按钮拖到书签栏。</li>
      <li>打开任意 JD 页面，确认内容已加载，再点击对应按钮。</li>
      <li>回到 AI Agent，运行 <code>/career-zh inbox</code> 或让助手处理 <code>inbox/*.json</code>。</li>
    </ol>
    <p><strong>隐私：</strong>数据只发送到本机 <code>localhost:8787</code>，不会发给第三方。</p>
  </main>
</body>
</html>`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`written ${path.relative(root, outputPath)}`);
