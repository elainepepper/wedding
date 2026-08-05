// Opens a real invitation on the live site and checks each step, taking a
// picture of every screen. Failures are printed plainly and the run goes red.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const LINK = process.env.INVITE_LINK;
if (!LINK) { console.error("Set the TEST_INVITE_LINK secret to a real invitation link."); process.exit(1); }
mkdirSync("tests/screens", { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

try {
  await page.goto(LINK, { waitUntil: "networkidle", timeout: 45000 });
  await page.screenshot({ path: "tests/screens/1-archway.png" });
  check("the archway loads", await page.locator(".portal-arch").count() > 0);
  check("the guest is recognised", await page.locator(".portal-refused").count() === 0,
        "a refusal here means the link or its token is wrong");

  await page.locator(".portal-enter").click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "tests/screens/2-invitation.png" });
  const invitation = await page.locator("#invitation").count();
  check("ENTER opens the invitation", invitation > 0);
  check("the page is not blank", (await page.locator("h2, h1").first().innerText()).trim().length > 0);

  const rsvp = page.locator(".rsvp-trigger");
  if (await rsvp.count()) {
    await rsvp.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: "tests/screens/3-reply.png" });
    check("the reply page opens", await page.locator("#rsvp").isVisible());
    check("the guest's own names are listed", (await page.locator(".party-rsvp-list").innerText()).trim().length > 0);
  } else {
    check("the invitation offers a way to reply", false, "no RSVP trigger found");
  }

  const scrolls = await page.evaluate(() => {
    const before = window.scrollY;
    window.scrollBy(0, 400);
    return window.scrollY !== before || document.documentElement.scrollHeight <= window.innerHeight;
  });
  check("the page scrolls", scrolls);
  check("no script errors", errors.length === 0, errors.join(" | "));
} catch (error) {
  check("the journey completed", false, error.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
