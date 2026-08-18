import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const guest = {
  id: 999,
  first_name: "Memory",
  last_name: "Test",
  preferred_name: "Memory",
  rsvp_status: "Pending",
  age_group: "Adult",
  child_meal: 0,
  ceremony_invited: 1,
  reception_invited: 1,
  after_party_invited: 0,
  after_party_attending: "Pending",
  meal_selection: null,
  dietary_requirements: null,
  allergies: null,
  accessibility: null,
  transport_required: 0,
  accommodation_required: 0,
  travel_arrival: null,
  travel_departure: null,
  accommodation_name: null,
  bed_preference: null,
  table_name: null,
  room_nights: null,
  marriage_advice: null,
  wishes: null,
  mobile: null,
  has_submitted: false,
};

test("restores an unfinished mobile RSVP to the final form after reload", async ({
  page,
}) => {
  await page.route("**/api/invite/memorytest", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        household: { id: 999, name: "Memory Test", maxGuests: 1 },
        guests: [guest],
        afterPartyInvited: false,
        settings: null,
        roomBlock: { size: 50, taken: 0, full: false },
      }),
    }),
  );
  await page.route("**/api/site-settings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        musicUrl: null,
        musicTitle: null,
        siteDesign: null,
      }),
    }),
  );

  await page.goto("http://localhost:3120/rsvp?t=memorytest");
  await page.evaluate(() => {
    sessionStorage.setItem(
      "elaine-haykal-rsvp-draft:memorytest",
      JSON.stringify({
        version: 1,
        token: "memorytest",
        rsvp: {
          guestName: "Memory",
          countryCode: "+60",
          phoneNumber: "12345678",
          attendance: "yes",
          meal: "salmon",
          dietary: "",
          flyingIn: false,
          roomAtHyatt: null,
          bedPreference: null,
          nights: null,
          arrivalDate: "",
          departureDate: "",
          accommodation: "",
          accessibilityNote: "",
          wishes: "",
          advice: "A saved message",
        },
        guestResponses: [
          {
            id: 999,
            name: "Memory",
            rsvpStatus: "Confirmed",
            ceremonyAttending: true,
            receptionAttending: true,
            afterPartyInvited: false,
            afterPartyAttending: "Pending",
            mealSelection: "Salmon",
            dietaryRequirements: "",
            allergies: "",
            accessibility: "",
            transportRequired: false,
            accommodationRequired: false,
            travelArrival: "",
            travelDeparture: "",
            accommodationName: "",
            bedPreference: "",
            roomNights: null,
            tableName: "",
            wishes: "",
            advice: "A saved message",
            isChild: false,
            childMeal: false,
          },
        ],
        replyPhase: "contact",
        arrivalStepConfirmed: false,
        resumeSection: "wishes",
      }),
    );
  });

  await page.reload();

  await expect(page.locator("#wishes textarea")).toHaveValue("A saved message");
  await expect(page.getByRole("button", { name: /Send RSVP/i })).toBeVisible();
  await expect
    .poll(() =>
      page.locator("#wishes").evaluate((element) =>
        Math.round(element.getBoundingClientRect().top),
      ),
    )
    .toBeLessThan(180);
  await expect(page.locator(".invitation-scroll.is-motion-engine-ready")).toHaveCount(
    0,
  );
  await expect(page.locator(".dream-film[src]")).toHaveCount(1);
});
