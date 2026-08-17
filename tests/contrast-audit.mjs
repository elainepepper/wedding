// Measures the contrast of visible text against the light card background the
// invitation actually uses, and reports anything below the WCAG AA threshold.
import { chromium, devices } from "@playwright/test";

const AUDIT = `(() => {
  const parse = (c) => { const m = c.match(/[\\d.]+/g); return m ? m.slice(0, 3).map(Number) : null; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // The pale card the guest actually reads against.
  const CARD = [251, 247, 244];
  const out = new Map();
  document.querySelectorAll("main *").forEach((el) => {
    if (!el.textContent || !el.textContent.trim()) return;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.opacity === "0") return;
    const rgb = parse(cs.color);
    if (!rgb) return;
    const alpha = Number((cs.color.match(/[\\d.]+/g) || [])[3] ?? 1);
    // Flatten any translucency against the card, as the eye sees it.
    const seen = rgb.map((v, i) => Math.round(v * alpha + CARD[i] * (1 - alpha)));
    const size = parseFloat(cs.fontSize);
    const bold = Number(cs.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const cr = ratio(seen, CARD);
    const need = large ? 3 : 4.5;
    if (cr < need) {
      const key = cs.color + "|" + Math.round(size) + "|" + (el.className || el.tagName);
      if (!out.has(key)) out.set(key, { color: cs.color, size: Math.round(size), cls: String(el.className || el.tagName).slice(0, 40), ratio: Number(cr.toFixed(2)), need, text: el.textContent.trim().slice(0, 40) });
    }
  });
  return [...out.values()].sort((a, b) => a.ratio - b.ratio);
})()`;

const browser = await chromium.launch();
const page = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
const tap = async (re) => { await page.locator("button:visible", { hasText: re }).first().click({ force: true, timeout: 10000 }); await page.waitForTimeout(900); };
const nextUntil = async (re) => { for (let i = 0; i < 6; i++) { if (re.test(await page.locator("main").innerText())) return true; await tap(/^\s*Next\s*$/); } return false; };
await page.goto("http://localhost:3000/invitation-preview", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const report = async (label) => {
  const rows = await page.evaluate(AUDIT);
  if (rows.length) { console.log(`\n--- ${label}`); rows.forEach((r) => console.log(`  ${r.ratio} (needs ${r.need})  ${r.size}px  ${r.color}  .${r.cls}  "${r.text}"`)); }
  else console.log(`\n--- ${label}: all text passes`);
};
await report("invitation");
await tap(/^\s*RSVP\s*$/);
await report("reply");
await tap(/Joyfully accept/);
await nextUntil(/02 · DRESS CODE/i); await report("dress");
await nextUntil(/03 · AT THE TABLE/i); await report("dinner");
await page.locator("button.meal-select-button:visible").first().click({ force: true }); await page.waitForTimeout(400);
await nextUntil(/04 · YOUR JOURNEY/i); await report("travel");
await tap(/^\s*Yes\s*$/); await tap(/No, thank you/);
await nextUntil(/While you are here/i); await report("kuala lumpur");
await nextUntil(/FINDING YOUR WAY/i); await report("venue");
await browser.close();
