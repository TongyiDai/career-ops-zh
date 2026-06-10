(async function () {
  const platform = 'universal';
  const postUrl = 'http://localhost:8787/jd';
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  document.querySelectorAll('*').forEach((el) => {
    try {
      el.style.userSelect = 'auto';
      el.style.webkitUserSelect = 'auto';
      el.oncopy = null;
      el.oncontextmenu = null;
    } catch {}
  });
  ['copy', 'cut', 'contextmenu', 'selectstart'].forEach((evt) => {
    document.addEventListener(evt, (e) => e.stopPropagation(), true);
  });

  const selectors = [
    '[data-testid*="job"]', '[data-qa*="job"]', '[data-role*="job"]',
    '[class*="job-detail"]', '[class*="jobDetail"]', '[class*="position-detail"]', '[class*="positionDetail"]', '[class*="jd-content"]',
    '[class*="job-content"]', '[class*="job-description"]', '[class*="job-info"]',
    '[class*="position-content"]', '[class*="detail-content"]', '[class*="job-desc"]',
    '[class*="recruit"]', '[class*="requirement"]', '[class*="responsibility"]', '[class*="description"]',
    'main', 'article', '#main', '#content', '#app', '#root', '.content',
  ];

  let main = document.body;
  let bestLen = clean(document.body.innerText).length;
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((el) => {
      const len = clean(el.innerText).length;
      if (len > 200 && len < bestLen) {
        main = el;
        bestLen = len;
      }
    });
  }

  const iframeTexts = [];
  document.querySelectorAll('iframe').forEach((iframe) => {
    try {
      const text = clean(iframe.contentDocument?.body?.innerText || '');
      if (text.length > 120) iframeTexts.push(text);
    } catch {}
  });
  const rawText = [clean(main.innerText || document.body.innerText), ...iframeTexts].sort((a, b) => b.length - a.length)[0];
  const title = clean(document.querySelector('h1')?.innerText || document.querySelector('[class*="title"]')?.innerText || document.title);
  const payload = {
    url: location.href,
    page_title: document.title,
    captured_at: new Date().toISOString(),
    platform,
    extracted: { job_title: title.slice(0, 160), raw_text: rawText },
  };

  try {
    const res = await fetch(postUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await res.json();
    alert(result.ok ? `✓ JD captured\n${result.file}` : `❌ ${result.error || 'server error'}`);
  } catch (error) {
    alert(`❌ 本地 inbox server 没启动？\n请运行：npm run inbox-server\n\n${error.message}`);
  }
})();
