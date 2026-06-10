import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const DEFAULT_CONFIG = 'config/domestic-portals.example.json';
const USER_CONFIG = 'config/domestic-portals.json';
const PIPELINE_PATH = 'data/pipeline.md';
const HISTORY_PATH = 'data/domestic-scan-history.tsv';
const DEFAULT_TIMEOUT_MS = 12_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; ai-career-assistant-zh/0.1; +https://github.com/open-source)';
const TRACKING_QUERY_KEYS = new Set([
  'track_id', 'trackId', 'recommend_id', 'recommendId', 'spm', 'scm', 'from', 'source', 'utm_source', 'utm_medium',
  'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', '_signature', 'timestamp', 'random', 'ts', 'share_token',
]);

function argValue(name) {
  const args = process.argv.slice(2);
  const idx = args.indexOf(name);
  if (idx >= 0) return args[idx + 1];
  const prefix = `${name}=`;
  const hit = args.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function hasArg(name) {
  return process.argv.slice(2).includes(name);
}

function numericArg(name, fallback) {
  const raw = argValue(name);
  if (raw == null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function ensureDataFiles({ dryRun = false } = {}) {
  if (dryRun) return;
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  if (!fs.existsSync(path.join(root, PIPELINE_PATH))) {
    fs.writeFileSync(path.join(root, PIPELINE_PATH), '# 待处理岗位 Pipeline\n\n## 待评估\n\n', 'utf8');
  }
  if (!fs.existsSync(path.join(root, HISTORY_PATH))) {
    fs.writeFileSync(path.join(root, HISTORY_PATH), 'url\tfirst_seen\tsource\ttitle\tcompany\tstatus\tlocation\n', 'utf8');
  }
}

function normalizeKeywords(value) {
  const arr = Array.isArray(value) ? value : value ? [value] : [];
  return arr.map((item) => String(item).toLowerCase().trim()).filter(Boolean);
}

function valueIncludes(value, keyword) {
  if (!keyword) return true;
  return String(value || '').toLowerCase().includes(keyword);
}

function collectSources(config) {
  const sources = Array.isArray(config.sources) ? [...config.sources] : [];
  const defaultProvider = config.default_provider || 'static-html';
  const defaultEnabled = config.default_enabled ?? false;

  for (const industry of config.industries || []) {
    for (const company of industry.companies || []) {
      sources.push({
        provider: company.provider || industry.provider || defaultProvider,
        enabled: company.enabled ?? industry.enabled ?? defaultEnabled,
        name: company.name,
        company: company.company || company.name,
        industry_id: industry.id,
        industry_name: industry.name,
        careers_url: company.careers_url,
        api: company.api,
        jobs: company.jobs,
        keyword: company.keyword || industry.keyword || config.default_keyword,
        page_size: company.page_size || industry.page_size || config.default_page_size,
        page_index: company.page_index || industry.page_index || config.default_page_index,
        timeout_ms: company.timeout_ms || industry.timeout_ms || config.default_timeout_ms,
        location: company.location,
        link_include: company.link_include || industry.link_include || config.default_link_include,
        link_exclude: company.link_exclude || industry.link_exclude || config.default_link_exclude,
        python_browser: company.python_browser || industry.python_browser || config.default_python_browser,
        scan_status: company.scan_status || industry.scan_status,
        notes: company.notes,
      });
    }
  }

  return sources;
}

function buildTitleFilter(config) {
  const positive = normalizeKeywords(config?.title_filter?.positive);
  const negative = normalizeKeywords(config?.title_filter?.negative);
  return (title = '') => {
    const lower = String(title).toLowerCase();
    const okPositive = positive.length === 0 || positive.some((keyword) => lower.includes(keyword));
    const badNegative = negative.some((keyword) => lower.includes(keyword));
    return okPositive && !badNegative;
  };
}

function buildLocationFilter(config) {
  const allow = normalizeKeywords(config?.location_filter?.allow);
  const block = normalizeKeywords(config?.location_filter?.block);
  return (location = '') => {
    const lower = String(location || '').toLowerCase();
    if (!lower) return true;
    if (block.some((keyword) => lower.includes(keyword))) return false;
    if (allow.length === 0) return true;
    return allow.some((keyword) => lower.includes(keyword));
  };
}

function getByPath(obj, dottedPath) {
  if (!dottedPath) return obj;
  return String(dottedPath).split('.').reduce((current, part) => {
    if (current == null) return undefined;
    if (/^\d+$/.test(part)) return current[Number(part)];
    return current[part];
  }, obj);
}

function interpolateEnv(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name) => process.env[name] || '');
}

function isBlockedHost(hostname) {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) return true;
  if (net.isIP(lower)) {
    if (lower.startsWith('10.') || lower.startsWith('127.') || lower.startsWith('169.254.')) return true;
    if (lower.startsWith('192.168.')) return true;
    const firstTwo = lower.split('.').slice(0, 2).map(Number);
    if (firstTwo[0] === 172 && firstTwo[1] >= 16 && firstTwo[1] <= 31) return true;
    if (lower === '::1') return true;
  }
  return false;
}

function assertSafeHttpUrl(rawUrl, label = 'url') {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`${label} 非法：${rawUrl}`);
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error(`${label} 只支持 http/https：${rawUrl}`);
  if (isBlockedHost(parsed.hostname)) throw new Error(`${label} 指向本地或内网地址，已拒绝：${rawUrl}`);
  return parsed.href;
}

async function fetchWithTimeout(url, { method = 'GET', headers = {}, body = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const safeUrl = assertSafeHttpUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(safeUrl, {
      method,
      headers: { 'user-agent': USER_AGENT, ...headers },
      body,
      redirect: 'follow',
      signal: controller.signal,
    });
    assertSafeHttpUrl(response.url, 'redirected_url');
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${text.replace(/\s+/g, ' ').slice(0, 180)}`);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeUrl(rawUrl, baseUrl) {
  if (!rawUrl) return '';
  try {
    return canonicalizeJobUrl(new URL(String(rawUrl).trim(), baseUrl).href);
  } catch {
    return '';
  }
}

function canonicalizeJobUrl(rawUrl) {
  const parsed = new URL(assertSafeHttpUrl(rawUrl, '岗位 URL'));
  const host = parsed.hostname.toLowerCase();
  const keepOnly = (keys) => {
    const next = new URL(parsed.origin + parsed.pathname);
    for (const key of keys) {
      const value = parsed.searchParams.get(key);
      if (value) next.searchParams.set(key, value);
    }
    return next.href;
  };

  if (host === 'talent.alibaba.com' && parsed.pathname.includes('/position-detail')) return keepOnly(['positionId']);
  if (host === 'jobs.bytedance.com' && /\/position\/[^/]+\/detail/.test(parsed.pathname)) return `${parsed.origin}${parsed.pathname}`;
  if (host === 'careers.tencent.com' && parsed.pathname.endsWith('/jobdesc.html')) return keepOnly(['postId']);
  if (host === 'zhaopin.jd.com' && parsed.pathname.includes('/job_detail')) return keepOnly(['positionId']);
  if (host === 'careers.ctrip.com' && parsed.pathname.includes('/job-detail')) return keepOnly(['jobId']);
  if (host === 'hr.163.com' && parsed.pathname.includes('/job-detail')) return keepOnly(['id']);

  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_QUERY_KEYS.has(key) || key.toLowerCase().startsWith('utm_')) parsed.searchParams.delete(key);
  }
  parsed.hash = '';
  parsed.searchParams.sort();
  return parsed.href;
}

function normalizeJob(job, source) {
  const title = String(job?.title || job?.name || '').trim();
  const url = normalizeUrl(job?.url || job?.jobUrl || job?.job_url || job?.applyUrl || job?.href, source.careers_url || source.api?.url);
  if (!title || !url) return null;
  return {
    title,
    url,
    company: String(job?.company || source.company || source.name || '').trim(),
    location: String(job?.location || job?.city || job?.work_location || '').trim(),
    source: source.name,
  };
}

async function fetchManualList(source) {
  const jobs = Array.isArray(source.jobs) ? source.jobs : [];
  return jobs.map((job) => normalizeJob(job, source)).filter(Boolean);
}

async function fetchPublicJson(source) {
  const api = source.api || {};
  if (!api.url) throw new Error('public-json 缺少 api.url');
  const headers = Object.fromEntries(Object.entries(api.headers || {}).map(([key, value]) => [key, interpolateEnv(value)]));
  const body = api.body == null ? null : JSON.stringify(api.body);
  const response = await fetchWithTimeout(api.url, {
    method: api.method || 'GET',
    headers: body ? { 'content-type': 'application/json', ...headers } : headers,
    body,
    timeoutMs: api.timeout_ms || DEFAULT_TIMEOUT_MS,
  });
  const json = await response.json();
  const rawJobs = getByPath(json, api.jobs_path || 'jobs');
  if (!Array.isArray(rawJobs)) throw new Error(`public-json 返回中未找到数组：${api.jobs_path || 'jobs'}`);
  const fields = api.fields || {};
  return rawJobs.map((item) => normalizeJob({
    title: getByPath(item, fields.title || 'title'),
    url: getByPath(item, fields.url || 'url'),
    location: getByPath(item, fields.location || 'location'),
    company: getByPath(item, fields.company || 'company'),
  }, source)).filter(Boolean);
}

function stripTags(text) {
  return String(text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBalancedObject(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = text.indexOf('{', markerIndex);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let quote = '';
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function parseJsonLikeObject(text) {
  const normalized = text.replace(/:undefined([,}])/g, ':null$1');
  return JSON.parse(normalized);
}

async function fetchStaticHtml(source) {
  if (!source.careers_url) throw new Error('static-html 缺少 careers_url');
  const baseUrl = assertSafeHttpUrl(source.careers_url, 'careers_url');
  const response = await fetchWithTimeout(baseUrl, { timeoutMs: source.timeout_ms || DEFAULT_TIMEOUT_MS });
  const html = await response.text();
  const include = normalizeKeywords(source.link_include || ['job', 'career', 'position', '招聘', '职位', '岗位']);
  const exclude = normalizeKeywords(source.link_exclude || ['privacy', 'login', 'signin', 'help']);
  const jobs = [];
  const seen = new Set();
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRegex)) {
    const href = normalizeUrl(match[1], baseUrl);
    const text = stripTags(match[2]);
    if (!href || !text || text.length > 80) continue;
    const haystack = `${href} ${text}`.toLowerCase();
    if (!include.some((keyword) => haystack.includes(keyword))) continue;
    if (exclude.some((keyword) => haystack.includes(keyword))) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    jobs.push({ title: text, url: href, company: source.company || source.name, location: source.location || '', source: source.name });
  }
  return jobs;
}

async function fetchTencentCareers(source) {
  const pageSize = Math.min(Number(source.page_size || source.limit || 50), 100);
  const pageIndex = Number(source.page_index || 1);
  const keyword = encodeURIComponent(source.keyword || '');
  const url = `https://careers.tencent.com/tencentcareer/api/post/Query?timestamp=${Date.now()}&countryId=&cityId=&bgIds=&productId=&categoryId=&parentCategoryId=&attrId=&keyword=${keyword}&pageIndex=${pageIndex}&pageSize=${pageSize}&language=zh-cn&area=cn`;
  const response = await fetchWithTimeout(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      referer: 'https://careers.tencent.com/',
    },
    timeoutMs: source.timeout_ms || DEFAULT_TIMEOUT_MS,
  });
  const json = await response.json();
  const posts = json?.Data?.Posts;
  if (!Array.isArray(posts)) throw new Error('腾讯 careers API 返回中未找到 Data.Posts');
  return posts.map((post) => normalizeJob({
    title: post.RecruitPostName,
    url: post.PostURL || `https://careers.tencent.com/jobdesc.html?postId=${post.PostId}`,
    location: post.LocationName,
    company: source.company || post.ComName || '腾讯',
  }, source)).filter(Boolean);
}

async function fetchBaiduCareers(source) {
  const response = await fetchWithTimeout('https://talent.baidu.com/jobs/social-list', {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      referer: 'https://talent.baidu.com/jobs/social',
    },
    timeoutMs: source.timeout_ms || DEFAULT_TIMEOUT_MS,
  });
  const html = await response.text();
  const dataText = extractBalancedObject(html, 'window.__INITIAL_DATA__');
  if (!dataText) throw new Error('百度招聘页未找到 window.__INITIAL_DATA__');
  const data = parseJsonLikeObject(dataText);
  const posts = data?.listData?.listDetailData;
  if (!Array.isArray(posts)) throw new Error('百度招聘页 SSR 数据中未找到 listData.listDetailData');
  const keyword = String(source.keyword || '').trim().toLowerCase();
  const filtered = keyword
    ? posts.filter((post) => `${post.name || ''} ${post.postType || ''} ${post.workPlace || ''}`.toLowerCase().includes(keyword))
    : posts;
  return filtered.map((post) => normalizeJob({
    title: post.name,
    url: `https://talent.baidu.com/jobs/social-detail?jobId=${encodeURIComponent(post.jobId || post.postId || '')}`,
    location: post.workPlace,
    company: source.company || '百度',
  }, source)).filter(Boolean);
}

async function fetchJdCareers(source) {
  const pageSize = Math.min(Number(source.page_size || source.limit || 50), 100);
  const pageIndex = Number(source.page_index || 1);
  const response = await fetchWithTimeout('https://zhaopin.jd.com/web/job/job_list', {
    method: 'POST',
    headers: {
      accept: 'application/json,text/plain,*/*',
      'content-type': 'application/json',
      referer: 'https://zhaopin.jd.com/web/job/job_list',
    },
    body: JSON.stringify({ page: pageIndex, pageSize, keyword: source.keyword || '' }),
    timeoutMs: source.timeout_ms || DEFAULT_TIMEOUT_MS,
  });
  const json = await response.json();
  if (!Array.isArray(json)) throw new Error('京东招聘接口返回中未找到岗位数组');
  const keyword = String(source.keyword || '').trim().toLowerCase();
  const posts = keyword
    ? json.filter((post) => `${post.positionNameOpen || ''} ${post.positionName || ''} ${post.jobType || ''} ${post.workCity || ''}`.toLowerCase().includes(keyword))
    : json;
  return posts.map((post) => normalizeJob({
    title: post.positionNameOpen || post.positionName,
    url: `https://zhaopin.jd.com/web/job/job_detail?positionId=${encodeURIComponent(post.positionId || post.id || '')}`,
    location: post.workCity,
    company: source.company || post.positionDeptName || '京东',
  }, source)).filter(Boolean);
}

async function fetchMeituanCareers(source) {
  const pageSize = Math.min(Number(source.page_size || source.limit || 50), 100);
  const pageNo = Number(source.page_index || 1);
  const response = await fetchWithTimeout('https://zhaopin.meituan.com/api/official/job/getVolunteerJobList', {
    method: 'POST',
    headers: {
      accept: 'application/json,text/plain,*/*',
      'content-type': 'application/json;charset=UTF-8',
      referer: 'https://zhaopin.meituan.com/web/social',
    },
    body: JSON.stringify({
      keyword: source.keyword || '',
      pageNo,
      pageSize,
      workCityCodeList: [],
      jobTypeCodeList: [],
      aspirationDirectionCodeList: [],
    }),
    timeoutMs: source.timeout_ms || DEFAULT_TIMEOUT_MS,
  });
  const json = await response.json();
  if (json?.status !== 1) throw new Error(`美团招聘接口返回失败：${json?.message || 'unknown'}`);
  const posts = json?.data?.list;
  if (!Array.isArray(posts)) throw new Error('美团招聘接口返回中未找到 data.list');
  if (posts.length === 0) throw new Error('美团招聘接口匿名请求返回空列表；该接口可能需要站点会话、筛选参数或由用户使用 bookmarklet 导出 JD');
  return posts.map((post) => normalizeJob({
    title: post.name || post.jobName,
    url: `https://zhaopin.meituan.com/web/social/detail?jobUnionId=${encodeURIComponent(post.jobUnionId || post.id || '')}`,
    location: post.workCityName || post.cityName || post.workCity,
    company: source.company || '美团',
  }, source)).filter(Boolean);
}

async function fetchNeteaseCareers(source) {
  const pageSize = Math.min(Number(source.page_size || source.limit || 50), 100);
  const currentPage = Number(source.page_index || 1);
  const response = await fetchWithTimeout('https://hr.163.com/api/hr163/position/queryPage', {
    method: 'POST',
    headers: {
      accept: 'application/json,text/plain,*/*',
      'content-type': 'application/json',
      referer: 'https://hr.163.com/job-list.html',
    },
    body: JSON.stringify({ currentPage, pageSize, keyword: source.keyword || '' }),
    timeoutMs: source.timeout_ms || DEFAULT_TIMEOUT_MS,
  });
  const json = await response.json();
  if (json?.code !== 200) throw new Error(`网易招聘接口返回失败：${json?.msg || json?.code || 'unknown'}`);
  const posts = json?.data?.list;
  if (!Array.isArray(posts)) throw new Error('网易招聘接口返回中未找到 data.list');
  return posts.map((post) => normalizeJob({
    title: post.name,
    url: `https://hr.163.com/job-detail.html?id=${encodeURIComponent(post.id || '')}`,
    location: Array.isArray(post.workPlaceNameList) ? post.workPlaceNameList.join('/') : post.workPlaceName,
    company: source.company || post.productName || '网易',
  }, source)).filter(Boolean);
}

async function fetchXiaomiCareers(source) {
  const response = await fetchWithTimeout('https://hr.xiaomi.com/job/list', {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      referer: 'https://hr.xiaomi.com/',
    },
    timeoutMs: source.timeout_ms || DEFAULT_TIMEOUT_MS,
  });
  const html = await response.text();
  const jobs = [];
  const seen = new Set();
  const linkRegex = /<a\b[^>]*href=["']([^"']*\/job\/view\/[^"']+)["'][^>]*title=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(linkRegex)) {
    const url = normalizeUrl(match[1], 'https://hr.xiaomi.com/job/list');
    const title = stripTags(match[2]);
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    jobs.push(normalizeJob({ title, url, company: source.company || '小米' }, source));
  }
  return jobs.filter(Boolean);
}

async function fetchCtripCareers(source) {
  const pageSize = Math.min(Number(source.page_size || source.limit || 50), 100);
  const pageIndex = Number(source.page_index || 1);
  const condition = source.keyword ? { jobName: source.keyword } : {};
  const response = await fetchWithTimeout('https://careers.ctrip.com/api/hrrecruit/getJobAd', {
    method: 'POST',
    headers: {
      accept: 'application/json,text/plain,*/*',
      'content-type': 'application/json',
      referer: 'https://careers.ctrip.com/experienced/jobList',
    },
    body: JSON.stringify({ condition, pageIndex, pageSize }),
    timeoutMs: source.timeout_ms || DEFAULT_TIMEOUT_MS,
  });
  const json = await response.json();
  if (json?.retCode !== '201') throw new Error(`携程招聘接口返回失败：${json?.retMessage || json?.retCode || 'unknown'}`);
  const posts = json?.retValue?.recruitJobAdList;
  if (!Array.isArray(posts)) throw new Error('携程招聘接口返回中未找到 retValue.recruitJobAdList');
  return posts.slice(0, pageSize).map((post) => normalizeJob({
    title: post.jobTitle,
    url: `https://careers.ctrip.com/experienced/job-detail?jobId=${encodeURIComponent(post.jobId || post.id || '')}`,
    location: post.cityName,
    company: source.company || post.buName || '携程',
  }, source)).filter(Boolean);
}

async function fetchPythonBrowser(source) {
  if (!source.careers_url) throw new Error('python-browser 缺少 careers_url');
  const browserConfig = source.python_browser || {};
  const python = process.env.PYTHON || 'python3';
  const args = [
    path.join(root, 'scripts/browser-scrape-jobs.py'),
    '--url', assertSafeHttpUrl(source.careers_url, 'careers_url'),
    '--company', source.company || source.name || '',
    '--source', source.name || '',
    '--limit', String(Math.min(Number(source.page_size || source.limit || 50), 100)),
    '--timeout-ms', String(source.timeout_ms || DEFAULT_TIMEOUT_MS),
    '--wait-ms', String(browserConfig.wait_ms || 2500),
  ];
  if (source.keyword) args.push('--keyword', String(source.keyword));
  if (browserConfig.selector) args.push('--selector', String(browserConfig.selector));
  if (browserConfig.browser === false) args.push('--no-browser');
  for (const item of normalizeKeywords(source.link_include || [])) args.push('--include', item);
  for (const item of normalizeKeywords(source.link_exclude || [])) args.push('--exclude', item);

  let stdout;
  try {
    stdout = execFileSync(python, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: (source.timeout_ms || DEFAULT_TIMEOUT_MS) + 5000,
      maxBuffer: 1024 * 1024 * 5,
    });
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim() : '';
    throw new Error(`python-browser 执行失败：${stderr || error.message}`);
  }
  const result = JSON.parse(stdout);
  const jobs = Array.isArray(result.jobs) ? result.jobs : [];
  if (jobs.length === 0 && Array.isArray(result.warnings) && result.warnings.length > 0) {
    throw new Error(result.warnings.join('；'));
  }
  return jobs.map((job) => normalizeJob(job, source)).filter(Boolean);
}

async function fetchSource(source) {
  if (source.provider === 'manual-list') return fetchManualList(source);
  if (source.provider === 'public-json') return fetchPublicJson(source);
  if (source.provider === 'tencent-careers') return fetchTencentCareers(source);
  if (source.provider === 'baidu-careers') return fetchBaiduCareers(source);
  if (source.provider === 'jd-careers') return fetchJdCareers(source);
  if (source.provider === 'meituan-careers') return fetchMeituanCareers(source);
  if (source.provider === 'netease-careers') return fetchNeteaseCareers(source);
  if (source.provider === 'xiaomi-careers') return fetchXiaomiCareers(source);
  if (source.provider === 'ctrip-careers') return fetchCtripCareers(source);
  if (source.provider === 'python-browser') return fetchPythonBrowser(source);
  if (source.provider === 'static-html') return fetchStaticHtml(source);
  if (source.provider === 'agent-handoff') return [];
  throw new Error(`未知 provider：${source.provider}`);
}

async function auditSources(sources, { limit = 0, output = '' } = {}) {
  const selected = limit > 0 ? sources.slice(0, limit) : sources;
  const rows = [];
  const startedAt = new Date().toISOString();
  for (const source of selected) {
    const started = Date.now();
    const row = {
      name: source.name,
      company: source.company,
      industry_id: source.industry_id || '',
      industry_name: source.industry_name || '',
      provider: source.provider,
      url: source.careers_url || source.api?.url || '',
      enabled: source.enabled !== false,
      scan_status: source.scan_status || '',
      ok: false,
      raw_jobs: 0,
      sample_titles: [],
      error: '',
      elapsed_ms: 0,
    };
    try {
      if (source.provider === 'agent-handoff') {
        row.ok = true;
        row.error = 'agent-handoff：无需自动抓取';
      } else {
        const jobs = await fetchSource(source);
        row.raw_jobs = jobs.length;
        row.sample_titles = jobs.slice(0, 5).map((job) => job.title);
        row.ok = jobs.length > 0;
        if (!row.ok) row.error = '页面可访问但未抽取到岗位链接；可能是 SPA、需要公开 JSON API 或 selector 配置';
      }
    } catch (error) {
      row.error = error.message;
    } finally {
      row.elapsed_ms = Date.now() - started;
      rows.push(row);
    }
  }

  const summary = {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    total_catalog_sources: sources.length,
    audited_sources: selected.length,
    ok_sources: rows.filter((row) => row.ok).length,
    sources_with_jobs: rows.filter((row) => row.raw_jobs > 0).length,
    failed_sources: rows.filter((row) => !row.ok).length,
    by_error: rows.reduce((acc, row) => {
      const key = row.ok ? 'ok' : (row.error || 'unknown');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  };

  const report = { summary, rows };
  if (output) {
    const target = path.join(root, output);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(report, null, 2), 'utf8');
  }

  console.log(JSON.stringify(report, null, 2));
  if (rows.some((row) => !row.ok)) process.exitCode = 1;
}

function loadSeenUrls() {
  const seen = new Set();
  for (const file of [PIPELINE_PATH, HISTORY_PATH]) {
    const target = path.join(root, file);
    if (!fs.existsSync(target)) continue;
    const text = fs.readFileSync(target, 'utf8');
    for (const match of text.matchAll(/https?:\/\/[^\s|)]+/g)) {
      seen.add(match[0]);
      try { seen.add(canonicalizeJobUrl(match[0])); } catch {}
    }
  }
  return seen;
}

function readTextIfExists(file) {
  const target = path.join(root, file);
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
}

function extractListValues(text, key) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^\\s*${key}:\\s*$`).test(line));
  if (start < 0) return [];
  const baseIndent = lines[start].match(/^\s*/)?.[0].length || 0;
  const values = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const indent = line.match(/^\s*/)?.[0].length || 0;
    if (indent <= baseIndent && !line.trim().startsWith('-')) break;
    const match = line.match(/^\s*-\s*"?([^"\n#]+?)"?\s*$/);
    if (match) values.push(match[1].trim());
    else if (indent <= baseIndent + 2 && /^\s*[a-zA-Z0-9_-]+:\s*$/.test(line)) break;
  }
  return values.filter(Boolean);
}

function uniq(values) {
  return values.filter((value, index, arr) => value && arr.indexOf(value) === index);
}

function hasPattern(text, pattern) {
  return pattern.test(text);
}

const ROLE_SIGNAL_CATALOG = [
  {
    type: '解决方案/售前',
    keywords: ['解决方案', '售前', '商业技术工程师', 'BTE', '价值顾问', '行业解决方案', '方案专家', '咨询'],
    job: /解决方案|售前|商业技术|\bBTE\b|价值顾问|价值工程|方案专家|行业方案|行业解决方案|咨询|转型顾问|Forward Deployed/i,
    profile: /解决方案|售前|商业技术|\bBTE\b|价值顾问|价值工程|方案专家|行业方案|行业解决方案|咨询|转型顾问|Forward Deployed/i,
  },
  {
    type: '客户成功/价值顾问',
    keywords: ['客户成功', 'CSM', 'KA', '大客户', '战略客户', '客户体验', 'NPS', '续约', '交付'],
    job: /客户成功|CSM|KA|大客户|战略客户|客户体验|NPS|续约|交付|实施顾问/i,
    profile: /客户成功|CSM|KA|大客户|战略客户|客户体验|NPS|续约|交付|实施顾问/i,
  },
  {
    type: 'HRTech/People',
    keywords: ['HR', 'HRTech', 'People', '人力', '招聘', '绩效', 'OKR', '组织', '协同', '人效'],
    job: /HR|HRTech|People|人力|招聘|绩效|OKR|组织|飞书|钉钉|协同|人效|人力资源数字化/i,
    profile: /HR|HRTech|People|人力|招聘|绩效|OKR|组织|飞书|钉钉|协同|人效|人力资源数字化/i,
  },
  {
    type: '产品',
    keywords: ['产品经理', '产品专家', '产品运营', '平台产品', '产品负责人'],
    job: /产品经理|产品专家|产品运营|平台产品|产品负责人/i,
    profile: /产品经理|产品专家|产品运营|平台产品|产品负责人|产品方向/i,
  },
  {
    type: '技术/研发',
    keywords: ['开发工程师', '研发工程师', '算法工程师', 'Java', '后端', '前端', '架构师', '技术负责人'],
    job: /开发工程师|研发工程师|算法工程师|测试工程师|Java|客户端|后端|前端|K8S|容器|推理加速|训练框架|架构师/i,
    profile: /开发工程师|研发工程师|算法工程师|测试工程师|Java|客户端|后端|前端|K8S|容器|推理加速|训练框架|架构师|技术负责人/i,
  },
  {
    type: '数据/算法/AI研究',
    keywords: ['数据分析', '数据科学', '机器学习', '深度学习', '算法', '模型训练', 'LLM', 'NLP', 'CV'],
    job: /数据分析|数据科学|机器学习|深度学习|算法|模型训练|LLM|NLP|CV|推荐系统/i,
    profile: /数据分析|数据科学|机器学习|深度学习|算法|模型训练|LLM|NLP|CV|推荐系统/i,
  },
  {
    type: '运营/增长',
    keywords: ['业务运营', '策略运营', '方案运营', '服务运营', '交付运营', '客户运营', '增长运营'],
    job: /业务运营|策略运营|方案运营|服务运营|交付运营|客户运营|AI服务运营|增长运营|用户运营/i,
    profile: /业务运营|策略运营|方案运营|服务运营|交付运营|客户运营|AI服务运营|增长运营|用户运营/i,
  },
  {
    type: '销售/商务',
    keywords: ['销售专家', '销售经理', '商务拓展', 'BD', '渠道销售', '销售负责人', '商业化'],
    job: /销售专家|销售经理|商务拓展|BD|渠道销售|泛互联网销售|销售-/i,
    profile: /销售专家|销售经理|商务拓展|BD|渠道销售|销售负责人|商业化/i,
  },
  {
    type: '市场/营销',
    keywords: ['市场', '营销', '品牌', '内容传播', '投放', '广告', '公关'],
    job: /市场|营销|品牌|内容传播|达人|投放|广告|公关/i,
    profile: /市场|营销|品牌|内容传播|达人|投放|广告|公关/i,
  },
];

function detectRoleSignals(haystack, rolePreferenceText, cautionText = '') {
  const matched = ROLE_SIGNAL_CATALOG.filter((role) => hasPattern(haystack, role.job));
  const preferred = ROLE_SIGNAL_CATALOG.filter((role) => hasPattern(rolePreferenceText, role.profile));
  const cautioned = ROLE_SIGNAL_CATALOG.filter((role) => hasPattern(cautionText, role.profile));
  const preferredTypes = new Set(preferred.map((role) => role.type));
  const cautionTypes = new Set(cautioned.map((role) => role.type));
  const aligned = matched.filter((role) => preferredTypes.has(role.type) && !cautionTypes.has(role.type));
  const cautionedMatches = matched.filter((role) => cautionTypes.has(role.type) && !preferredTypes.has(role.type));
  const primary = aligned[0] || matched[0];
  return {
    matchedTypes: matched.map((role) => role.type),
    alignedTypes: aligned.map((role) => role.type),
    cautionedTypes: cautionedMatches.map((role) => role.type),
    roleType: primary ? primary.type : '待复核',
    hasRoleMatch: aligned.length > 0,
    hasRoleMismatch: matched.length > 0 && aligned.length === 0,
    hasCautionedRole: cautionedMatches.length > 0,
  };
}

function buildLocalMatcher() {
  const profile = readTextIfExists('config/profile.yml');
  const cv = readTextIfExists('cv.md');
  const profileText = `${profile}\n${cv}`.toLowerCase();
  const targetCities = extractListValues(profile, 'target_cities');
  const dealBreakers = extractListValues(profile, 'deal_breakers');
  const strongPositive = extractListValues(profile, 'strong_positive');
  const cautionKeywords = extractListValues(profile, 'caution');
  const primaryTargets = extractListValues(profile, 'primary');
  const secondaryTargets = extractListValues(profile, 'secondary');
  const preferredCompanyTerms = extractListValues(profile, 'preferred');
  const rolePreferenceText = [...strongPositive, ...primaryTargets, ...secondaryTargets].join('\n').toLowerCase();
  const cautionText = [...cautionKeywords, ...dealBreakers].join('\n').toLowerCase();
  const targetTerms = uniq([
    ...strongPositive,
    ...primaryTargets,
    ...secondaryTargets,
    ...ROLE_SIGNAL_CATALOG.flatMap((role) => role.profile.test(rolePreferenceText) ? role.keywords : []),
  ]);
  const riskTerms = ['外包', '驻场', '电话销售', '纯销售', '客服', '实习', '校招', ...cautionKeywords];
  const hasRealProfile = !profile.includes('张三') && !cv.includes('请在这里填写你的中文简历');

  return (job) => {
    const haystack = `${job.company} ${job.title} ${job.location}`;
    const lower = haystack.toLowerCase();
    const matchedTargets = targetTerms.filter((term) => lower.includes(term.toLowerCase()));
    const matchedCities = targetCities.filter((city) => job.location && job.location.includes(city));
    const matchedCompany = preferredCompanyTerms.filter((term) => lower.includes(term.toLowerCase()) || profileText.includes(term.toLowerCase()));
    const risks = riskTerms.filter((term) => haystack.includes(term));
    const dealBreakerHits = dealBreakers.filter((term) => term && haystack.includes(term));

    const roleSignals = detectRoleSignals(haystack, rolePreferenceText, cautionText);
    const roleType = (roleSignals.hasRoleMismatch || roleSignals.hasCautionedRole) ? `${roleSignals.roleType}，需谨慎` : roleSignals.roleType;

    let score = 2.4;
    score += Math.min(matchedTargets.length, 5) * 0.3;
    if (matchedCities.length > 0) score += 0.45;
    if (matchedCompany.length > 0) score += 0.25;
    if (roleSignals.hasRoleMatch) score += Math.min(roleSignals.alignedTypes.length, 3) * 0.55;
    if (roleSignals.hasRoleMismatch) score -= 0.65;
    if (roleSignals.hasCautionedRole) score -= 0.55;
    if (/负责人|专家|高级|架构|Lead/i.test(job.title)) score += 0.2;
    score -= risks.length * 0.25;
    score -= dealBreakerHits.length * 0.8;
    score = Math.max(1, Math.min(5, Math.round(score * 10) / 10));
    const suggestion = score >= 4.2 ? '重点推进' : score >= 3.6 ? '可推进' : score >= 3.0 ? '备选观察' : '谨慎/不建议';
    return { score, suggestion, matchedTargets, matchedCities, roleType, risks: [...risks, ...dealBreakerHits], hasRealProfile };
  };
}

function writeRecommendationReport(jobs, { output = '', top = 20, dryRun = false } = {}) {
  if (jobs.length === 0) return '';
  const match = buildLocalMatcher();
  const ranked = jobs.map((job) => ({ ...job, match: match(job) })).sort((a, b) => b.match.score - a.match.score).slice(0, top);
  const date = new Date().toISOString().slice(0, 10);
  const target = output || `output/domestic-job-recommendations-${date}.md`;
  const hasRealProfile = ranked.some((job) => job.match.hasRealProfile);
  const lines = [
    `# 官网岗位初筛报告（${date}）`,
    '',
    `> 来源：scan-domestic-jobs 本地启发式初筛；${hasRealProfile ? '已读取当前 cv/profile。' : '当前 cv.md / profile.yml 仍像模板内容，以下仅适合作为链路演示，正式推荐前请先补全个人信息。'}`,
    '',
    '## Top 岗位',
    '',
    '| 排名 | 分数 | 建议 | 公司 | 岗位 | 城市 | 角色判断 | 命中点 | 风险 | 投递链接 |',
    '|---:|---:|---|---|---|---|---|---|---|---|',
    ...ranked.map((job, index) => `| ${index + 1} | ${job.match.score} | ${job.match.suggestion} | ${job.company} | [${job.title}](${job.url}) | ${job.location || '未注明'} | ${job.match.roleType} | ${job.match.matchedTargets.slice(0, 5).join('、') || '-'} | ${job.match.risks.join('、') || '-'} | [打开投递](${job.url}) |`),
    '',
    '## 下一步建议',
    '',
    '- 优先对“重点推进 / 可推进”的岗位运行正式 JD 评估，补充岗位职责细节后再定制简历。',
    '- 如果当前 profile/cv 仍是模板，请先补全个人摘要、代表项目、目标职级、目标薪酬和不接受项。',
    '- 对来源为官网 API 的岗位，仍建议人工打开原链接复核岗位是否仍在线、是否真实开放、是否需要内推。',
    '',
  ];
  if (!dryRun) {
    fs.mkdirSync(path.dirname(path.join(root, target)), { recursive: true });
    fs.writeFileSync(path.join(root, target), lines.join('\n'), 'utf8');
  }
  return target;
}

function appendPipeline(jobs) {
  if (jobs.length === 0) return;
  let text = fs.readFileSync(path.join(root, PIPELINE_PATH), 'utf8');
  if (!text.includes('## 待评估')) text += '\n## 待评估\n\n';
  const block = jobs.map((job) => `- [ ] [${job.title}](${job.url}) | ${job.company} | ${job.location || '未注明'} | 来源：${job.source} | [投递链接](${job.url})`).join('\n');
  text = text.replace(/## 待评估\s*/, (marker) => `${marker}${block}\n`);
  fs.writeFileSync(path.join(root, PIPELINE_PATH), text, 'utf8');
}

function appendHistory(jobs, status = 'added') {
  if (jobs.length === 0) return;
  const date = new Date().toISOString().slice(0, 10);
  const lines = jobs.map((job) => `${job.url}\t${date}\t${job.source}\t${job.title}\t${job.company}\t${status}\t${job.location || ''}`).join('\n') + '\n';
  fs.appendFileSync(path.join(root, HISTORY_PATH), lines, 'utf8');
}

async function main() {
  const configPath = argValue('--config') || (fs.existsSync(path.join(root, USER_CONFIG)) ? USER_CONFIG : DEFAULT_CONFIG);
  const dryRun = hasArg('--dry-run');
  const ignoreHistory = hasArg('--ignore-history') || hasArg('--refresh-report');
  const reportOnly = hasArg('--report-only') || hasArg('--refresh-report');
  const includeDisabled = hasArg('--include-disabled');
  const listSources = hasArg('--list-sources');
  const audit = hasArg('--audit-sources');
  const recommend = hasArg('--recommend') || hasArg('--match-report');
  const limit = numericArg('--limit', 0);
  const recommendLimit = numericArg('--recommend-limit', numericArg('--top', 20));
  const output = argValue('--output');
  const recommendOutput = argValue('--recommend-output') || argValue('--match-output');
  const sourceFilter = argValue('--source')?.toLowerCase();
  const industryFilter = argValue('--industry')?.toLowerCase();
  const config = readJson(configPath);
  ensureDataFiles({ dryRun });

  const titleFilter = buildTitleFilter(config);
  const locationFilter = buildLocationFilter(config);
  const seen = ignoreHistory ? new Set() : loadSeenUrls();
  const sources = collectSources(config).filter((source) => {
    if (!source || (!includeDisabled && source.enabled === false)) return false;
    if (sourceFilter && !valueIncludes(source.name, sourceFilter) && !valueIncludes(source.company, sourceFilter)) return false;
    if (industryFilter && !valueIncludes(source.industry_id, industryFilter) && !valueIncludes(source.industry_name, industryFilter)) return false;
    return true;
  });

  if (listSources) {
    console.log(`来源清单：${sources.length}`);
    for (const source of sources) {
      const industry = source.industry_name ? `${source.industry_name} / ` : '';
      const state = source.enabled === false ? 'disabled' : 'enabled';
      console.log(`- [${state}] ${industry}${source.name} | ${source.provider} | ${source.careers_url || source.api?.url || ''}`);
    }
    return;
  }

  if (audit) {
    await auditSources(sources, { limit, output });
    return;
  }

  const newJobs = [];
  const handoff = [];
  const errors = [];
  let found = 0;
  let filteredTitle = 0;
  let filteredLocation = 0;
  let duplicates = 0;

  for (const source of sources) {
    if (source.provider === 'agent-handoff') {
      handoff.push(source);
      continue;
    }
    try {
      const jobs = await fetchSource(source);
      found += jobs.length;
      for (const job of jobs) {
        if (!titleFilter(job.title)) { filteredTitle++; continue; }
        if (!locationFilter(job.location)) { filteredLocation++; continue; }
        if (seen.has(job.url)) { duplicates++; continue; }
        seen.add(job.url);
        newJobs.push(job);
      }
    } catch (error) {
      errors.push({ source: source.name, error: error.message });
    }
  }

  if (!dryRun && !reportOnly) {
    appendPipeline(newJobs);
    appendHistory(newJobs);
  }

  let recommendationReport = '';
  if (recommend && newJobs.length > 0) {
    recommendationReport = writeRecommendationReport(newJobs, { output: recommendOutput || '', top: recommendLimit, dryRun });
  }

  console.log(`国内岗位扫描完成${dryRun ? '（dry-run，未写入）' : ''}`);
  console.log(`配置文件：${configPath}`);
  console.log(`启用来源：${sources.length}`);
  if (industryFilter) console.log(`行业过滤：${industryFilter}`);
  console.log(`发现岗位：${found}`);
  console.log(`标题过滤：${filteredTitle}`);
  console.log(`城市过滤：${filteredLocation}`);
  console.log(`重复跳过：${duplicates}`);
  console.log(`新增岗位：${newJobs.length}`);
  if (ignoreHistory) console.log('历史去重：已忽略（用于刷新报告）');
  if (reportOnly) console.log('管道写入：已跳过（仅刷新报告）');
  if (recommendationReport) console.log(`初筛报告：${recommendationReport}`);
  if (newJobs.length > 0) {
    console.log('\n新增岗位：');
    for (const job of newJobs) console.log(`  + ${job.company} | ${job.title} | ${job.location || '未注明'} | ${job.url}`);
  }
  if (handoff.length > 0) {
    console.log('\n需要人工/Agent 接力的平台：');
    for (const item of handoff) console.log(`  • ${item.name}：${item.reason || item.search_hint || '未配置自动接口'}`);
  }
  if (errors.length > 0) {
    console.log('\n错误：');
    for (const item of errors) console.log(`  ✗ ${item.source}: ${item.error}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Fatal:', error.message);
  process.exit(1);
});
