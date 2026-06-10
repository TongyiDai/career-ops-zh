(async function () {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const selectors = [
    '[data-testid*="job"]', '[data-qa*="job"]', '[data-role*="job"]',
    '[class*="job-detail"]', '[class*="jobDetail"]', '[class*="position-detail"]', '[class*="positionDetail"]',
    '[class*="recruit-detail"]', '[class*="recruitDetail"]', '[class*="ats-detail"]',
    '[class*="description"]', '[class*="Description"]', '[class*="requirement"]', '[class*="Requirement"]',
    '[class*="responsibility"]', '[class*="Responsibility"]', '[class*="job-content"]', '[class*="content"]',
    'main', 'article', '#app', '#root'
  ];
  const titleSelectors = ['h1', '[class*="job-title"]', '[class*="jobTitle"]', '[class*="position-title"]', '[class*="positionTitle"]', '[class*="name"]'];

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

  function firstText(doc, list) {
    for (const selector of list) {
      const text = clean(doc.querySelector(selector)?.innerText || doc.querySelector(selector)?.textContent);
      if (text) return text;
    }
    return '';
  }

  const chunks = [bestText(document)];
  document.querySelectorAll('iframe').forEach((iframe) => {
    try {
      const doc = iframe.contentDocument;
      const text = doc ? bestText(doc) : '';
      if (text) chunks.push(text);
    } catch {}
  });

  const rawText = chunks.sort((a, b) => b.length - a.length)[0] || clean(document.body.innerText);
  const title = firstText(document, titleSelectors) || document.title;
  const payload = {
    url: location.href,
    page_title: document.title,
    captured_at: new Date().toISOString(),
    platform: 'company-careers-spa',
    extracted: { job_title: clean(title).slice(0, 160), raw_text: rawText },
  };

  try {
    const res = await fetch('http://localhost:8787/jd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await res.json();
    alert(result.ok ? `✓ Careers SPA JD captured\n${result.file}` : `❌ ${result.error || 'server error'}`);
  } catch (error) {
    alert(`❌ 本地 inbox server 没启动？\n请运行：npm run inbox-server\n\n${error.message}`);
  }
})();

