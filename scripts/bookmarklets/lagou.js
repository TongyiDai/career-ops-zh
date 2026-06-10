(async function () {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const pick = (selectors) => {
    for (const selector of selectors) {
      const text = clean(document.querySelector(selector)?.innerText || document.querySelector(selector)?.textContent);
      if (text) return text;
    }
    return '';
  };

  document.querySelectorAll('*').forEach((el) => {
    try {
      el.style.userSelect = 'auto';
      el.style.webkitUserSelect = 'auto';
      el.oncopy = null;
      el.oncontextmenu = null;
    } catch {}
  });

  const jobTitle = pick(['.position-head h1', '.job-name', '[class*="positionName"]', 'h1']) || document.title;
  const company = pick(['.company', '.company-name', '[class*="companyName"]', '[class*="company-name"]']);
  const salary = pick(['.salary', '[class*="salary"]']);
  const jobLocation = pick(['.work_addr', '[class*="address"]', '[class*="city"]']);
  const description = pick(['.job-detail', '.position-detail', '.job_bt', '[class*="jobDetail"]', '[class*="description"]']);
  const rawText = clean(description || document.body.innerText);

  const payload = {
    url: window.location.href,
    page_title: document.title,
    captured_at: new Date().toISOString(),
    platform: 'lagou',
    extracted: { job_title: clean(jobTitle), company, salary, location: jobLocation, description: rawText, raw_text: rawText },
  };

  try {
    const res = await fetch('http://localhost:8787/jd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await res.json();
    alert(result.ok ? `✓ 拉勾 JD captured\n${result.file}` : `❌ ${result.error || 'server error'}`);
  } catch (error) {
    alert(`❌ 本地 inbox server 没启动？\n请运行：npm run inbox-server\n\n${error.message}`);
  }
})();
