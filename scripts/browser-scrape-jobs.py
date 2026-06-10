#!/usr/bin/env python3
"""Render or fetch a careers page and extract job-like links as JSON.

This script is intentionally conservative: it only reads public pages, does not
log in, does not solve CAPTCHA, and refuses localhost/private-network URLs.
"""

from __future__ import annotations

import argparse
import html
import ipaddress
import json
import re
import socket
import sys
import urllib.parse
import urllib.request
from typing import Any


USER_AGENT = "Mozilla/5.0 (compatible; ai-career-assistant-zh-python/0.1; +https://github.com/open-source)"
DEFAULT_INCLUDE = ["job", "jobs", "career", "position", "recruit", "zhaopin", "招聘", "职位", "岗位", "加入"]
DEFAULT_EXCLUDE = ["privacy", "login", "signin", "help", "about", "news", "隐私", "登录", "帮助", "关于"]
GENERIC_LINK_TITLES = {"招聘", "招聘贤才", "社会招聘", "校园招聘", "实习生招聘", "加入我们", "加入小米", "职位列表", "查看更多", "更多"}


def is_blocked_hostname(hostname: str) -> bool:
    lower = hostname.lower().strip("[]")
    if lower == "localhost" or lower.endswith(".localhost"):
        return True
    try:
        ip = ipaddress.ip_address(lower)
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved
    except ValueError:
        pass
    return False


def assert_safe_http_url(raw_url: str, label: str = "url") -> str:
    parsed = urllib.parse.urlparse(raw_url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError(f"{label} 只支持 http/https：{raw_url}")
    if not parsed.hostname:
        raise ValueError(f"{label} 缺少 hostname：{raw_url}")
    if is_blocked_hostname(parsed.hostname):
        raise ValueError(f"{label} 指向本地或内网地址，已拒绝：{raw_url}")
    return raw_url


def normalize_url(raw_url: str, base_url: str) -> str:
    if not raw_url:
        return ""
    try:
        return assert_safe_http_url(urllib.parse.urljoin(base_url, raw_url.strip()), "岗位 URL")
    except Exception:
        return ""


def strip_tags(text: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", text or "", flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def fetch_static_html(url: str, timeout: float) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"})
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - URL is validated above.
        final_url = assert_safe_http_url(response.geturl(), "redirected_url")
        charset = response.headers.get_content_charset() or "utf-8"
        data = response.read()
    return data.decode(charset, errors="replace")


def extract_anchor_jobs(html_text: str, base_url: str, company: str, source: str, include: list[str], exclude: list[str], limit: int) -> list[dict[str, str]]:
    jobs: list[dict[str, str]] = []
    seen: set[str] = set()
    anchor_re = re.compile(r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>([\s\S]*?)</a>", re.I)
    include_lower = [item.lower() for item in include if item]
    exclude_lower = [item.lower() for item in exclude if item]
    for match in anchor_re.finditer(html_text):
        href = normalize_url(match.group(1), base_url)
        title = strip_tags(match.group(2))
        if not href or not title or len(title) > 120 or title in GENERIC_LINK_TITLES:
            continue
        haystack = f"{href} {title}".lower()
        if include_lower and not any(item in haystack for item in include_lower):
            continue
        if exclude_lower and any(item in haystack for item in exclude_lower):
            continue
        if href in seen:
            continue
        seen.add(href)
        jobs.append({"title": title, "url": href, "company": company, "location": "", "source": source})
        if len(jobs) >= limit:
            break
    return jobs


def render_with_playwright(
    url: str,
    timeout_ms: int,
    wait_ms: int,
    selector: str,
    warnings: list[str],
    keyword: str = "",
    limit: int = 50,
) -> tuple[str, list[dict[str, str]]]:
    try:
        from playwright.sync_api import sync_playwright  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on local optional dependency.
        warnings.append(
            "python-playwright 未安装，已退回静态 HTML 抓取；如需渲染 SPA，请执行：python3 -m pip install playwright && python3 -m playwright install chromium"
        )
        raise RuntimeError(str(exc)) from exc

    captured: list[dict[str, str]] = []
    alibaba_csrf = ""

    def maybe_capture_response(response: Any) -> None:
        nonlocal alibaba_csrf
        try:
            content_type = (response.headers.get("content-type") or "").lower()
            response_url = response.url.lower()
            if "talent.alibaba.com/user/getuser" in response_url:
                parsed = urllib.parse.urlparse(response.url)
                alibaba_csrf = urllib.parse.parse_qs(parsed.query).get("_csrf", [""])[0]
            if "json" not in content_type:
                return
            if not any(token in response_url for token in ["job", "position", "recruit", "career", "zhaopin"]):
                return
            data = response.json()
            captured.extend(extract_jobs_from_json(data, response.url))
        except Exception:
            return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT, viewport={"width": 1366, "height": 900})
        page.on("response", maybe_capture_response)
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        if selector:
            page.wait_for_selector(selector, timeout=timeout_ms)
        page.wait_for_timeout(wait_ms)
        parsed_url = urllib.parse.urlparse(page.url or url)
        if parsed_url.hostname == "talent.alibaba.com" and alibaba_csrf:
            captured.extend(fetch_alibaba_positions_in_page(page, alibaba_csrf, keyword, limit, warnings))
        html_text = page.content()
        browser.close()
    return html_text, captured


def fetch_alibaba_positions_in_page(page: Any, csrf: str, keyword: str, limit: int, warnings: list[str]) -> list[dict[str, str]]:
    """Use Alibaba's public position search endpoint with the page-issued CSRF token."""
    page_size = max(1, min(limit, 100))
    body: dict[str, Any] = {
        "batchId": "",
        "corpCode": "",
        "categoryType": "social",
        "pageIndex": 1,
        "pageSize": page_size,
        "channel": "group_official_site",
        "language": "zh",
    }
    if keyword:
        body["key"] = keyword
    try:
        result = page.evaluate(
            """
            async ({body, csrf}) => {
              const response = await fetch('/position/search?_csrf=' + encodeURIComponent(csrf), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
              });
              return { status: response.status, data: await response.json() };
            }
            """,
            {"body": body, "csrf": csrf},
        )
    except Exception as exc:
        warnings.append(f"阿里招聘 position/search 请求失败：{exc}")
        return []
    if result.get("status") != 200:
        warnings.append(f"阿里招聘 position/search HTTP {result.get('status')}")
        return []
    return extract_jobs_from_json(result.get("data"), "https://talent.alibaba.com/position/search")


def extract_jobs_from_json(data: Any, base_url: str) -> list[dict[str, str]]:
    jobs: list[dict[str, str]] = []
    title_keys = ["title", "name", "jobName", "job_name", "positionName", "positionNameOpen", "jobTitle", "RecruitPostName"]
    url_keys = ["url", "href", "jobUrl", "job_url", "applyUrl", "PostURL", "positionUrl"]
    location_keys = ["location", "city", "workCity", "workPlace", "workLocation", "LocationName"]

    def location_from_obj(obj: dict[str, Any]) -> str:
        for key in location_keys:
            if obj.get(key):
                return str(obj.get(key, "")).strip()
        work_locations = obj.get("workLocations") or obj.get("work_locations")
        if isinstance(work_locations, list):
            return "/".join(str(item).strip() for item in work_locations if item)
        city_info = obj.get("city_info") or obj.get("cityInfo")
        if isinstance(city_info, dict) and city_info.get("name"):
            return str(city_info.get("name", "")).strip()
        city_list = obj.get("city_list") or obj.get("cityList")
        if isinstance(city_list, list):
            names = [str(item.get("name") or item.get("i18n_name") or "").strip() for item in city_list if isinstance(item, dict)]
            return "/".join(name for name in names if name)
        return ""

    def generated_url(obj: dict[str, Any]) -> str:
        parsed = urllib.parse.urlparse(base_url)
        host = parsed.hostname or ""
        if host == "jobs.bytedance.com" and obj.get("id") and obj.get("title"):
            return f"https://jobs.bytedance.com/experienced/position/{obj.get('id')}/detail"
        return ""

    def normalize_job_url(raw_url: str, obj: dict[str, Any]) -> str:
        parsed = urllib.parse.urlparse(base_url)
        if parsed.hostname == "talent.alibaba.com" and obj.get("id"):
            return f"https://talent.alibaba.com/off-campus/position-detail?positionId={obj.get('id')}"
        return normalize_url(raw_url, base_url) if raw_url else generated_url(obj)

    def walk(obj: Any) -> None:
        if isinstance(obj, list):
            for item in obj:
                walk(item)
            return
        if not isinstance(obj, dict):
            return
        title = next((str(obj.get(key, "")).strip() for key in title_keys if obj.get(key)), "")
        raw_url = next((str(obj.get(key, "")).strip() for key in url_keys if obj.get(key)), "")
        url = normalize_job_url(raw_url, obj)
        if title and url:
            location = location_from_obj(obj)
            jobs.append({"title": title, "url": url, "location": location})
        for value in obj.values():
            if isinstance(value, (list, dict)):
                walk(value)

    walk(data)
    deduped: list[dict[str, str]] = []
    seen: set[str] = set()
    for job in jobs:
        if job["url"] in seen:
            continue
        seen.add(job["url"])
        deduped.append(job)
    return deduped


def main() -> int:
    parser = argparse.ArgumentParser(description="Render/fetch a careers page and extract job links.")
    parser.add_argument("--url", required=True)
    parser.add_argument("--company", default="")
    parser.add_argument("--source", default="")
    parser.add_argument("--keyword", default="")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--timeout-ms", type=int, default=12000)
    parser.add_argument("--wait-ms", type=int, default=2500)
    parser.add_argument("--selector", default="")
    parser.add_argument("--include", action="append", default=[])
    parser.add_argument("--exclude", action="append", default=[])
    parser.add_argument("--browser", dest="browser", action="store_true", default=True)
    parser.add_argument("--no-browser", dest="browser", action="store_false")
    args = parser.parse_args()

    warnings: list[str] = []
    url = assert_safe_http_url(args.url, "url")
    include = args.include or DEFAULT_INCLUDE
    exclude = args.exclude or DEFAULT_EXCLUDE
    html_text = ""
    captured_jobs: list[dict[str, str]] = []
    mode = "static"

    if args.browser:
        try:
            html_text, captured_jobs = render_with_playwright(
                url, args.timeout_ms, args.wait_ms, args.selector, warnings, args.keyword, args.limit
            )
            mode = "browser"
        except Exception:
            html_text = fetch_static_html(url, args.timeout_ms / 1000)
            mode = "static-fallback"
    else:
        html_text = fetch_static_html(url, args.timeout_ms / 1000)

    jobs = captured_jobs + extract_anchor_jobs(html_text, url, args.company, args.source, include, exclude, args.limit)
    keyword = args.keyword.lower().strip()
    if keyword:
        jobs = [job for job in jobs if keyword in f"{job.get('title', '')} {job.get('location', '')}".lower()]

    normalized: list[dict[str, str]] = []
    seen: set[str] = set()
    for job in jobs:
        title = str(job.get("title", "")).strip()
        job_url = normalize_url(str(job.get("url", "")), url)
        if not title or not job_url or job_url in seen:
            continue
        seen.add(job_url)
        normalized.append(
            {
                "title": title,
                "url": job_url,
                "company": str(job.get("company") or args.company).strip(),
                "location": str(job.get("location", "")).strip(),
                "source": str(job.get("source") or args.source).strip(),
            }
        )
        if len(normalized) >= args.limit:
            break

    json.dump({"mode": mode, "warnings": warnings, "jobs": normalized}, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
