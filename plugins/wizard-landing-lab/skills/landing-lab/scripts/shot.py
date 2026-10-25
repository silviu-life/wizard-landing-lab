# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright"]
# ///
"""Screenshot a page at desktop (1440x900) and mobile (390x844) size and report what is broken.

Run: uv run shot.py URL OUT_DIR [--prefix NAME-]
Writes OUT_DIR/<prefix>desktop.png and <prefix>mobile.png (full page) and prints JSON:
  {"desktop": {...}, "mobile": {...}} with console_errors, broken_images and overflow_px (horizontal scroll, mobile matters).
"""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

SIZES = {"desktop": (1440, 900), "mobile": (390, 844)}
CHECK = """() => ({
  broken_images: [...document.images].filter(i => i.complete && !i.naturalWidth).map(i => i.currentSrc || i.src),
  overflow_px: Math.max(0, document.documentElement.scrollWidth - innerWidth),
})"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("out")
    ap.add_argument("--prefix", default="")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    report = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for name, (w, h) in SIZES.items():
            page = browser.new_page(viewport={"width": w, "height": h}, is_mobile=name == "mobile")
            errors = []
            page.on("console", lambda m: m.type == "error" and errors.append(m.text))
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(a.url, wait_until="networkidle")
            page.wait_for_timeout(500)
            page.screenshot(path=out / f"{a.prefix}{name}.png", full_page=True)
            report[name] = {"console_errors": errors, **page.evaluate(CHECK)}
            page.close()
        browser.close()
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
