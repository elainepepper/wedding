import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const report = { routes: {}, console: {}, network: {}, widths: {} };

const ROUTES = ["/", "/preview", "/manager-preview", "/after-party?preview=1", "/i/not-a-real-token/nobody", "/definitely-not-a-page"];
for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errors = [];
  const failed = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/api/")) failed.push(`${r.status()} ${r.url().slice(-60)}`); });
  const resp = await page.goto("http://localhost:3111" + route, { waitUntil: "networkidle", timeout: 40000 }).catch(() => null);
  await page.waitForTimeout(2500);
  report.routes[route] = resp ? resp.status() : "no response";
  report.console[route] = errors.length ? errors.slice(0, 3) : "clean";
  report.network[route] = failed.length ? failed.slice(0, 3) : "clean";
  await page.close();
}

// responsive sweep on /preview: horizontal overflow check
for (const width of [375, 390, 430, 768, 1280, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  await page.goto("http://localhost:3111/preview", { waitUntil: "networkidle", timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  report.widths[width] = overflow > 1 ? `HORIZONTAL OVERFLOW ${overflow}px` : "ok";
  await page.close();
}

// reduced motion: page still renders content
const rm = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await rm.goto("http://localhost:3111/preview", { waitUntil: "networkidle", timeout: 40000 }).catch(() => {});
await rm.waitForTimeout(2000);
report.reducedMotionH1 = await rm.evaluate(() => Boolean(document.querySelector("h1, h2")?.textContent?.trim()));
await rm.close();

await browser.close();
console.log(JSON.stringify(report, null, 2));
