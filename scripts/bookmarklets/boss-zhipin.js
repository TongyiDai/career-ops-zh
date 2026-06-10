(async function () {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const q = (selectors) => selectors.map((s) => document.querySelector(s)).find(Boolean);
  const title = clean(q(['.job-name', '.name', 'h1', '[class*="job-title"]'])?.innerText || document.title);
  const company = clean(q(['.company-info .name', '.company-name', '[class*="company"]'])?.innerText || '');
  const salary = clean(q(['.salary', '[class*="salary"]'])?.innerText || '');
  const location = clean(q(['.job-location', '.location-address', '[class*="location"]'])?.innerText || '');
  const rawText = clean(document.body.innerText);
  const payload = {
    url: location.href,
    page_title: document.title,
    captured_at: new Date().toISOString(),
    platform: 'boss-zhipin',
    extracted: { job_title: title, company, salary, location, raw_text: rawText },
  };
  try {
    const res = await fetch('http://localhost:8787/jd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await res.json();
    alert(result.ok ? `✓ Boss JD captured\n${result.file}` : `❌ ${result.error || 'server error'}`);
  } catch (error) {
    alert(`❌ 本地 inbox server 没启动？\n请运行：npm run inbox-server\n\n${error.message}`);
  }
})();
