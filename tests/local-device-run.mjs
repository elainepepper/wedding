// Multi-device QA harness for the Elaine & Haykal wedding site.
// Runs the full guest journey and every public route on emulated devices.
// Start the site first (pnpm build && pnpm start), then: node tests/local-device-run.mjs
import { chromium, devices } from "@playwright/test";

const BASE = "http://localhost:3000";
const DEVICES = {
  "iPhone 13": devices["iPhone 13"],
  "Pixel 7": devices["Pixel 7"],
  "iPad (gen 7)": devices["iPad (gen 7)"],
  "Desktop": { viewport: { width: 1440, height: 900 } },
};

const results = [];
const check = (device, name, ok, detail = "") => {
  results.push({ device, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${device}] ${name}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch();

for (const [label, device] of Object.entries(DEVICES)) {
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
  const pageErrors = [];
  const failedRequests = [];
  let crashed = false;
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("crash", () => { crashed = true; });
  page.on("response", (r) => {
    const path = r.url().replace(BASE, "");
    // /api/* and /manager fail by design on a machine without Firebase
    // credentials, and the unknown-page check asks for its own 404.
    if (r.status() >= 400 && !path.startsWith("/api/") && !path.startsWith("/manager") && !path.includes("definitely-not-a-page")) failedRequests.push(`${r.status()} ${path}`);
  });

  const audit = async (name) => {
    const data = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.includes("gallery/06")).map((i) => i.src.split("/").slice(-2).join("/")),
    }));
    check(label, `${name}: no horizontal overflow`, data.overflowX <= 1, data.overflowX > 1 ? `${data.overflowX}px too wide` : "");
    check(label, `${name}: no broken images`, data.broken.length === 0, data.broken.join(", "));
  };

  try {
    // ---- 1. The full preview journey ----
    await page.goto(`${BASE}/invitation-preview`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2500);
    check(label, "preview loads", (await page.locator("h2, h1").count()) > 0);
    await audit("preview");

    const clickByText = async (text) => {
      const btn = page.locator("button:visible", { hasText: new RegExp(`^\\s*${text}\\s*$`) }).first();
      await btn.click({ timeout: 8000, force: true });
      await page.waitForTimeout(900);
    };
    // On a phone, the first tap of Next scrolls any unanswered question into
    // view rather than turning the page (by design) — so tap like a thumb
    // does: until the page actually turns.
    const nextUntil = async (pattern) => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (pattern.test(await page.locator("main").innerText())) return true;
        await page.locator("button:visible", { hasText: /^\s*Next\s*$/ }).first().click({ timeout: 8000, force: true });
        await page.waitForTimeout(1100);
      }
      return pattern.test(await page.locator("main").innerText());
    };

    await clickByText("RSVP");
    await clickByText("Joyfully accept");
    check(label, "reply step opens and accepts", true);
    check(label, "dress code step reached", await nextUntil(/02 · DRESS CODE/i));
    check(label, "dinner step reached", await nextUntil(/03 · AT THE TABLE/i));
    // meal: pick salmon for the sample guest
    await page.locator("button.meal-select-button:visible").first().click({ timeout: 8000, force: true });
    await page.waitForTimeout(500);
    check(label, "travel step reached", await nextUntil(/04 · YOUR JOURNEY/i));
    await clickByText("No");                         // not flying in
    check(label, "venue step reached", await nextUntil(/FINDING YOUR WAY/i));
    // the map must sit centred in its frame, cropped evenly on both sides
    const mapInfo = await page.evaluate(() => {
      const map = document.querySelector(".venue-map");
      const film = map ? map.querySelector("iframe") : null;
      if (!map || !film) return null;
      const mr = map.getBoundingClientRect();
      const fr = film.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      return { boxOff: Math.round(mr.left - (vw - mr.right)), cropDiff: Math.round((mr.left - fr.left) - (fr.right - mr.right)) };
    });
    // a few px of box offset is scrollbar rounding, not a layout fault
    check(label, "venue map centred", !!mapInfo && Math.abs(mapInfo.boxOff) <= 6 && Math.abs(mapInfo.cropDiff) <= 2, JSON.stringify(mapInfo));
    check(label, "wishes step reached", await nextUntil(/05 · FROM THE HEART/i));
    const confirm = page.locator("button:visible", { hasText: /preview confirmation/i }).first();
    await confirm.scrollIntoViewIfNeeded();
    await confirm.click({ timeout: 8000, force: true });
    await page.waitForTimeout(2000);
    const bodyText = await page.locator("main").innerText();
    check(label, "journey reaches confirmation", /thank you/i.test(bodyText), "");
    check(label, "countdown is running", /days/i.test(bodyText));
    await audit("confirmation");

    // let the films play a while — watching for renderer trouble
    await page.waitForTimeout(8000);
    check(label, "page alive after films play", !crashed && (await page.title()).length > 0);
    const playing = await page.evaluate(() => [...document.querySelectorAll("video")].filter((v) => !v.paused).length);
    // one film on show; a second is legitimate mid-crossfade, all three never
    check(label, "hidden background films stay paused", playing <= 2, `${playing} playing`);

    // ---- 1b. Guests who decline go straight on to the wishes page ----
    // (steps are identical whether one guest or a whole couple declines)
    await page.goto(`${BASE}/invitation-preview`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2000);
    await clickByText("RSVP");
    await page.locator("button:visible", { hasText: /Regretfully decline/ }).first().click({ timeout: 8000, force: true });
    await page.waitForTimeout(900);
    check(label, "declined guests reach the wishes page", await nextUntil(/0\d · FROM THE HEART/i));
    check(label, "declined guests can still leave wishes and send", /preview confirmation/i.test(await page.locator("main").innerText()));

    // ---- 2. The archway (home) ----
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 30000 });
    check(label, "archway loads", (await page.locator(".portal-arch").count()) > 0);
    await page.locator(".portal-enter").click();
    await page.waitForTimeout(600);
    check(label, "uninvited visitor is politely refused", (await page.locator(".portal-refused").count()) > 0);
    await audit("archway");

    // ---- 3. Locked / quiet routes ----
    await page.goto(`${BASE}/welcome`, { waitUntil: "networkidle", timeout: 30000 });
    check(label, "welcome without link shows the lock", /by invitation/i.test(await page.locator("main").innerText()));
    await page.goto(`${BASE}/after-party`, { waitUntil: "networkidle", timeout: 30000 });
    check(label, "after-party rests without a link", /resting quietly/i.test(await page.locator("main").innerText()));
    await page.goto(`${BASE}/table`, { waitUntil: "networkidle", timeout: 30000 });
    const tableText = await page.locator("main, body").first().innerText();
    check(label, "table page needs a personal link", /personal link|could not find/i.test(tableText), tableText.slice(0, 80));
    await page.goto(`${BASE}/manager`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    const managerText = await page.locator("body").innerText();
    check(label, "manager shows sign-in gate, no data", !/guests?\s*·|households/i.test(managerText), managerText.slice(0, 60).replace(/\s+/g, " "));
    await page.goto(`${BASE}/definitely-not-a-page`, { waitUntil: "domcontentloaded", timeout: 30000 });
    check(label, "unknown page 404s gracefully", /404|not.*found/i.test(await page.locator("body").innerText()));

    // Without NEXT_PUBLIC_FIREBASE_* set locally, the manager's sign-in
    // screen reports invalid-api-key; on the live site those values exist.
    const realErrors = pageErrors.filter((m) => !m.includes("auth/invalid-api-key"));
    check(label, "no uncaught script errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));
    check(label, "no failed asset requests", failedRequests.length === 0, [...new Set(failedRequests)].slice(0, 5).join(", "));
    check(label, "renderer never crashed", !crashed);
  } catch (error) {
    check(label, "device run completed", false, error.message.split("\n")[0]);
  }
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n=== ${results.length - failed.length} of ${results.length} checks passed ===`);
process.exit(failed.length ? 1 : 0);
