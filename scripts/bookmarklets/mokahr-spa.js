(async function () {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const selectors = ['[class*="job-detail"]', '[class*="jobDetail"]', '[class*="position-detail"]', '[class*="description"]', '[class*="requirement"]', 'main', '#app', '#root'];
  const title = clean(document.querySelector('h1')?.innerText || document.querySelector('[class*="title"]')?.innerText || document.title);
  function bestText(doc) {
    let best = clean(doc.body?.innerText || '');
    for (const selector of selectors) {
      doc.querySelectorAll(selector).forEach((el) => {
        const text = clean(el.innerText || el.textContent);
        if (text.length > 120 && text.length < Math.max(best.length, 121)) best = text;
      });
    }
    return best;
  }
  const chunks = [bestText(document)];
  document.querySelectorAll('iframe').forEach((iframe) => {
    try {
      const text = iframe.contentDocument ? bestText(iframe.contentDocument) : '';
      if (text) chunks.push(text);
    } catch {}
  });
  const rawText = chunks.sort((a, b) => b.length - a.length)[0];
  const payload = {
    url: location.href,
    page_title: document.title,
    captured_at: new Date().toISOString(),
    platform: 'mokahr-spa',
    extracted: { job_title: title, raw_text: rawText },
  };
  try {
    const res = await fetch('http://localhost:8787/jd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await res.json();
    alert(result.ok ? `✓ SPA JD captured\n${result.file}` : `❌ ${result.error || 'server error'}`);
  } catch (error) {
    alert(`❌ 本地 inbox server 没启动？\n请运行：npm run inbox-server\n\n${error.message}`);
  }
})();
