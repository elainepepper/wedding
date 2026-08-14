// The policy must protect without breaking: no CSP violations anywhere in the
// journey, the map frame still loads, and the manager's sign-in still runs.
import { chromium, devices } from "@playwright/test";
const browser = await chromium.launch();
const page = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
const violations = [];
page.on("console", (m) => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) violations.push(t.slice(0, 160)); });
page.on("pageerror", (e) => violations.push("pageerror: " + e.message.slice(0, 120)));

const tap = async (re) => { await page.locator("button:visible", { hasText: re }).first().click({ force: true, timeout: 10000 }); await page.waitForTimeout(900); };
const nextUntil = async (re) => { for (let i = 0; i < 6; i++) { if (re.test(await page.locator("main").innerText())) return true; await tap(/^\s*Next\s*$/); } return false; };

await page.goto("http://localhost:3000/invitation-preview", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await tap(/^\s*RSVP\s*$/); await tap(/Joyfully accept/);
await nextUntil(/02 · DRESS CODE/i); await nextUntil(/03 · AT THE TABLE/i);
await page.locator("button.choice-card:visible").first().click({ force: true }); await page.waitForTimeout(400);
await nextUntil(/04 · YOUR JOURNEY/i); await tap(/^\s*No\s*$/);
await nextUntil(/FINDING YOUR WAY/i);
await page.waitForTimeout(2500);
const map = await page.evaluate(() => { const f = document.querySelector(".venue-map iframe"); return f ? { present: true, src: (f.src || "").slice(0, 40) } : { present: false }; });
const media = await page.evaluate(() => ({ videos: document.querySelectorAll("video").length, images: [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length }));

// the manager: Firebase auth must be able to start under the policy
const mgr = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
const mgrViolations = [];
mgr.on("console", (m) => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) mgrViolations.push(t.slice(0, 160)); });
await mgr.goto("http://localhost:3000/manager", { waitUntil: "networkidle" });
await mgr.waitForTimeout(3000);
const mgrText = (await mgr.locator("body").innerText()).slice(0, 60).replace(/\s+/g, " ");

console.log(JSON.stringify({ journeyViolations: violations.slice(0, 5), map, media, managerViolations: mgrViolations.slice(0, 5), managerShows: mgrText }, null, 1));
await browser.close();
