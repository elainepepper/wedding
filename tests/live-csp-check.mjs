// The policy on the real site: fonts, films, map and the manager's Firebase
// sign-in must all survive it.
import { chromium, devices } from "@playwright/test";
const browser = await chromium.launch();

const guest = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
const gv = [];
guest.on("console", (m) => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) gv.push(t.slice(0, 170)); });
guest.on("pageerror", (e) => gv.push("ERR: " + e.message.slice(0, 120)));
await guest.goto("https://haykalelaine.com/invitation-preview", { waitUntil: "networkidle", timeout: 60000 });
await guest.waitForTimeout(3000);
const tap = async (re) => { await guest.locator("button:visible", { hasText: re }).first().click({ force: true, timeout: 10000 }); await guest.waitForTimeout(900); };
const nextUntil = async (re) => { for (let i = 0; i < 6; i++) { if (re.test(await guest.locator("main").innerText())) return true; await tap(/^\s*Next\s*$/); } return false; };
await tap(/^\s*RSVP\s*$/); await tap(/Joyfully accept/);
await nextUntil(/02 · DRESS CODE/i); await nextUntil(/03 · AT THE TABLE/i);
await guest.locator("button.choice-card:visible").first().click({ force: true }); await guest.waitForTimeout(400);
await nextUntil(/04 · YOUR JOURNEY/i); await tap(/^\s*No\s*$/);
await nextUntil(/FINDING YOUR WAY/i); await guest.waitForTimeout(2500);
const guestState = await guest.evaluate(() => ({
  fontsLoaded: document.fonts.status,
  serifApplied: getComputedStyle(document.querySelector("h2")).fontFamily.slice(0, 30),
  mapPresent: Boolean(document.querySelector(".venue-map iframe")),
  brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
}));

const mgr = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
const mv = [];
mgr.on("console", (m) => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) mv.push(t.slice(0, 170)); });
mgr.on("pageerror", (e) => mv.push("ERR: " + e.message.slice(0, 120)));
await mgr.goto("https://haykalelaine.com/manager", { waitUntil: "networkidle", timeout: 60000 });
await mgr.waitForTimeout(5000);
const mgrState = await mgr.evaluate(() => ({
  signInFormPresent: Boolean(document.querySelector('input[type="password"]')),
  googleButton: [...document.querySelectorAll("button")].some((b) => /google/i.test(b.textContent || "")),
  text: (document.body.innerText || "").slice(0, 70).replace(/\s+/g, " "),
}));

console.log(JSON.stringify({ guestViolations: gv.slice(0, 4), guestState, managerViolations: mv.slice(0, 4), mgrState }, null, 1));
await browser.close();
