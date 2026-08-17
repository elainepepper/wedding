"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultSiteDesign,
  fontPairs,
  normaliseSiteDesign,
  SiteDesign,
} from "../lib/site-design";
import { rsvpDeadlineLabel } from "../lib/rsvp-window";
import { Dreamscape } from "./Dreamscape";
import { EtherealLoader } from "./EtherealLoader";
import { SiteMenu } from "./SiteMenu";
import { LockedInvitation } from "./LockedInvitation";
import { readToken } from "./invite-token";
import { musicElement } from "./music";
import { PhotoRail } from "./PhotoRail";
import { DreamBackdrop } from "./DreamBackdrop";
import { removeBrokenImage } from "./image-fallback";
import { CinematicMotion } from "./CinematicMotion";
import BubbleCursor from "./BubbleCursor";

// Splits off the first letter so it can carry a swash capital of its own —
// the flourish belongs on the initial only, never the whole name.
function ScriptName({ name }: { name: string }) {
  return (
    <>
      <span className="cap">{name.slice(0, 1)}</span>
      {name.slice(1)}
    </>
  );
}
function DressNote({ text }: { text: string }) {
  const ladiesMarker = "Ladies:";
  const ladiesIndex = text.indexOf(ladiesMarker);
  if (ladiesIndex < 0) return <>{text}</>;

  return (
    <>
      <span>{text.slice(0, ladiesIndex).trim()}</span>
      <span>{text.slice(ladiesIndex).trim()}</span>
    </>
  );
}

function HotelName({ name }: { name: string }) {
  const managedBy = " Managed By Banyan Tree";
  if (!name.endsWith(managedBy)) return <>{name}</>;
  return (
    <>
      {name.slice(0, -managedBy.length)}
      <br />
      <span>Managed by Banyan Tree</span>
    </>
  );
}

type Attendance = "yes" | "no" | null;
type Meal = "lamb" | "salmon" | null;
type InvitedGuest = {
  id: number;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  rsvp_status: string;
  age_group: "Adult" | "Child";
  child_meal: number;
  ceremony_invited: number;
  reception_invited: number;
  after_party_invited: number;
  after_party_attending: string;
  meal_selection: string | null;
  dietary_requirements: string | null;
  allergies: string | null;
  accessibility: string | null;
  transport_required: number;
  accommodation_required: number;
  travel_arrival: string | null;
  travel_departure: string | null;
  accommodation_name: string | null;
  bed_preference?: string | null;
  table_name?: string | null;
  room_nights?: number | null;
  marriage_advice?: string | null;
  wishes: string | null;
  mobile: string | null;
  has_submitted: boolean;
};
type InviteData = {
  household: { id: number; name: string; maxGuests: number };
  guests: InvitedGuest[];
  afterPartyInvited: boolean;
  settings: {
    rsvp_deadline?: string;
    confirmation_message?: string;
    music_url?: string | null;
    music_title?: string | null;
  } | null;
  // The couple's room block: `full` closes the offer for anyone who has not
  // already asked for one.
  roomBlock?: { size: number; taken: number; full: boolean } | null;
};
type MusicSettings = { musicUrl: string | null; musicTitle: string | null };
type PublicSiteSettings = MusicSettings & { siteDesign?: unknown };
type GuestResponse = {
  id: number;
  name: string;
  rsvpStatus: "Confirmed" | "Declined" | "Pending";
  ceremonyAttending: boolean;
  receptionAttending: boolean;
  afterPartyInvited: boolean;
  afterPartyAttending: "Yes" | "No" | "Pending";
  mealSelection: "Lamb" | "Salmon" | "";
  dietaryRequirements: string;
  allergies: string;
  accessibility: string;
  transportRequired: boolean;
  accommodationRequired: boolean;
  travelArrival: string;
  travelDeparture: string;
  accommodationName: string;
  bedPreference: string;
  roomNights: number | null;
  tableName: string;
  wishes: string;
  advice: string;
  isChild: boolean;
  childMeal: boolean;
};
type RsvpState = {
  guestName: string;
  countryCode: string;
  phoneNumber: string;
  attendance: Attendance;
  meal: Meal;
  dietary: string;
  flyingIn: boolean | null;
  roomAtHyatt: boolean | null;
  bedPreference: "King" | "Twin" | null;
  nights: number | null;
  arrivalDate: string;
  departureDate: string;
  accommodation: string;
  accessibilityNote: string;
  wishes: string;
  advice: string;
};

const initialRsvp: RsvpState = {
  guestName: "guest",
  countryCode: "+60",
  phoneNumber: "",
  attendance: null,
  meal: null,
  dietary: "",
  flyingIn: null,
  roomAtHyatt: null,
  bedPreference: null,
  nights: null,
  arrivalDate: "",
  departureDate: "",
  accommodation: "",
  accessibilityNote: "",
  wishes: "",
  advice: "",
};

// Short forms, so the selector stays narrow enough to sit beside the number
const countryCodes = [
  ["MY", "+60"],
  ["AU", "+61"],
  ["SG", "+65"],
  ["ID", "+62"],
  ["UK", "+44"],
  ["US", "+1"],
  ["NZ", "+64"],
  ["Other", "+"],
] as const;

const salmonDescription =
  "Seared Alaskan salmon with Peruvian asparagus, heirloom baby carrot, avruga caviar, celeriac mash and citrus fennel beurre blanc.";
const lambDescription =
  "Almond dukkha-crusted lamb with potato pavé, smoked eggplant purée, tomato on vines confit and balsamic rosemary reduction.";
const checkOutDate = (checkIn: string, nights: number | null) => {
  if (!checkIn || !nights) return "";
  const date = new Date(`${checkIn}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + nights);
  return date.toISOString().slice(0, 10);
};
const scrollToSection = (id: string) =>
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
const sceneLabels: Record<string, string> = {
  invitation: "The invitation",
  table: "Your table",
  schedule: "The evening",
  venue: "The Grand Salon",
  gallery: "Us, lately",
  rsvp: "Your reply",
  dress: "Dress code",
  meal: "Dinner",
  travel: "Your journey",
  recommendations: "Kuala Lumpur",
  wishes: "From the heart",
  confirmation: "Until November",
};

// A couple entered as "Mr Lim" and "Mrs Lim" reads as one address:
// "Mr & Mrs Lim". Malaysian honorifics carry the same pattern — "Dato
// Ahmad" and "Datin Ahmad" become "Dato & Datin Ahmad" — so any two of
// these titles sharing a surname combine the same way. Any other pair of
// names keeps the plain "A & B" form.
const HONORIFIC_ORDER = ["Datuk", "Dato", "Mr", "Datin", "Mrs", "Miss", "Ms"];
const HONORIFIC_PATTERN = new RegExp(
  `^(${HONORIFIC_ORDER.join("|")})\\.?\\s+(.+)$`,
  "i",
);
function joinGuestNames(names: Array<string | null | undefined>) {
  const clean = names.map((name) => (name || "").trim()).filter(Boolean);
  if (clean.length === 2) {
    const titled = clean.map((name) => name.match(HONORIFIC_PATTERN));
    if (
      titled[0] &&
      titled[1] &&
      titled[0][2].toLowerCase() === titled[1][2].toLowerCase() &&
      titled[0][1].toLowerCase() !== titled[1][1].toLowerCase()
    ) {
      const rank = (title: string) =>
        HONORIFIC_ORDER.findIndex(
          (entry) => entry.toLowerCase() === title.toLowerCase(),
        );
      const [first, second] =
        rank(titled[0][1]) <= rank(titled[1][1])
          ? [titled[0], titled[1]]
          : [titled[1], titled[0]];
      return `${first[1]} & ${second[1]} ${first[2]}`;
    }
  }
  return clean.join(" & ");
}

// Guest data may arrive in administrative all-caps. Preserve intentionally
// mixed-case names, but give all-caps records a gracious invitation treatment
// instead of repeating database casing in the confirmation headline.
function invitationCaseName(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed !== trimmed.toLocaleUpperCase()) return trimmed;

  return trimmed
    .toLocaleLowerCase()
    .replace(/(^|[\s&'’.-])\p{L}/gu, (match) => match.toLocaleUpperCase());
}

function splitMobile(mobile: string | null) {
  if (!mobile) return { countryCode: "+60", phoneNumber: "" };
  const compact = mobile.replace(/[\s()-]/g, "");
  const known = ["+60", "+61", "+65", "+62", "+44", "+64", "+1"].find((code) =>
    compact.startsWith(code),
  );
  return known
    ? { countryCode: known, phoneNumber: compact.slice(known.length) }
    : { countryCode: "+60", phoneNumber: compact.replace(/^\+/, "") };
}

function RibbonDivider() {
  return (
    <div className="ribbon-divider" aria-hidden="true">
      <span />
      <b>❦</b>
      <span />
    </div>
  );
}

const maps = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const foodPlaces = [
  {
    name: "Village Park Restaurant",
    note: "Nasi lemak, crisp fried chicken and fragrant coconut rice.",
    detail: "20 minutes by Grab",
    score: "Beloved local classic",
  },
  {
    name: "Super Kitchen Chilli Pan Mee",
    note: "Springy noodles, chilli and a poached egg — stir everything together before the first bite.",
    detail: "15 minutes by Grab",
    score: "Casual local favourite",
  },
  {
    name: "Oriental Kopi",
    note: "Kopi, kaya toast and egg tarts — worth the queue.",
    detail: "10 minutes",
    score: "4.4 · 6,800 reviews",
  },
  {
    name: "Jalan Alor Food Street",
    note: "Satay, grilled seafood and noodles under the lanterns, from dusk till late.",
    detail: "10 minutes by Grab",
    score: "Night-market institution",
  },
  {
    name: "Lot 10 Hutong",
    note: "Well-known hawker stalls gathered in one food court beneath Lot 10.",
    detail: "12 minutes on foot",
    score: "Heritage hawker hall",
  },
  {
    name: "Nyonya Colors",
    note: "Nyonya laksa, cendol and rainbow kuih — a sweet, quick taste of Peranakan Malaysia.",
    detail: "Pavilion, 12 minutes",
    score: "Local favourite",
  },
] as const;

const nearbyHotels = [
  {
    name: "Four Seasons Hotel Kuala Lumpur",
    note: "Five-star, beside the towers on Jalan Ampang.",
    walk: "8 minutes",
    score: "4.6 · 5,600 reviews",
  },
  {
    name: "Banyan Tree Kuala Lumpur",
    note: "Five-star, rooms from the 54th floor on Jalan Conlay.",
    walk: "6 minutes",
    score: "4.7 · 2,900 reviews",
  },
  {
    name: "Grand Millennium Kuala Lumpur",
    note: "Five-star, on Bukit Bintang beside Pavilion.",
    walk: "12 minutes",
    score: "4.5 · 8,800 reviews",
  },
  {
    name: "Pavilion Hotel Kuala Lumpur Managed By Banyan Tree",
    note: "Five-star, attached to Pavilion itself.",
    walk: "12 minutes",
    score: "4.5 · 1,900 reviews",
  },
  {
    name: "Berjaya Times Square Hotel Kuala Lumpur",
    note: "Four-star hotel with generous family rooms.",
    walk: "20 minutes",
    score: "4.3 · 23,000 reviews",
  },
] as const;

function NearbyHotelList() {
  const [openHotel, setOpenHotel] = useState<string | null>(null);

  return (
    <ul className="hotel-list hotel-disclosures">
      {nearbyHotels.map((hotel, index) => {
        const panelId = `hotel-description-${index}`;
        const isOpen = openHotel === hotel.name;
        return (
          <li className={isOpen ? "is-open" : ""} key={hotel.name}>
            <button
              type="button"
              className="hotel-disclosure-toggle"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() =>
                setOpenHotel((current) =>
                  current === hotel.name ? null : hotel.name,
                )
              }
            >
              <strong>
                <HotelName name={hotel.name} />
              </strong>
              <span>{isOpen ? "Details −" : "Details +"}</span>
            </button>
            <div
              className="hotel-description"
              id={panelId}
              aria-hidden={!isOpen}
            >
              <p>{hotel.note}</p>
            </div>
            <a
              className="hotel-distance-link"
              href={maps(`${hotel.name} Kuala Lumpur`)}
              target="_blank"
              rel="noreferrer"
            >
              {hotel.walk} away <span aria-hidden="true">↗</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

const pamperPlaces = [
  {
    name: "V Spa Bukit Bintang",
    note: "Calm rooms, gentle prices, open until late.",
    detail: "10 minutes",
    score: "4.8 · 780 reviews",
  },
  {
    name: "Health World Spa and Massage Bukit Bintang",
    note: "Deep tissue and foot massage, open very late indeed.",
    detail: "10 minutes",
    score: "4.7 · 670 reviews",
  },
  {
    name: "Thai Paradise Spa Kuala Lumpur",
    note: "Thai massage and aromatherapy, a few streets away.",
    detail: "5 minutes",
    score: "4.4 · 760 reviews",
  },
  {
    name: "Hair Quarters Pavilion Kuala Lumpur",
    note: "Wash, blow-dry and styling before the evening.",
    detail: "Pavilion, 12 minutes",
    score: "4.9 · 2,300 reviews",
  },
  {
    name: "Alice Hair Wonderland Pavilion Kuala Lumpur",
    note: "Cut and colour, much loved by regulars.",
    detail: "Pavilion, 12 minutes",
    score: "4.8 · 530 reviews",
  },
] as const;

const sightseeingPlaces = [
  {
    name: "Petronas Twin Towers",
    note: "The skybridge and the deck on the 86th floor. Book ahead.",
    detail: "5 minutes",
    score: "4.7 · 103,000 reviews",
  },
  {
    name: "Aquaria KLCC",
    note: "A walk-through aquarium beneath the convention centre, next door.",
    detail: "3 minutes",
    score: "4.3 · 40,000 reviews",
  },
  {
    name: "Petaling Street",
    note: "Chinatown's market street — bargains, old kopitiams and the beautifully restored shophouses around it.",
    detail: "15 minutes by Grab",
    score: "The old heart of KL",
  },
  {
    name: "Batu Caves",
    note: "The rainbow steps and the great golden statue — 272 stairs into a limestone cathedral. Go early, before the heat.",
    detail: "40 minutes by Grab",
    score: "Worth the morning",
  },
  {
    name: "Merdeka Square",
    note: "Where independence was declared — the Sultan Abdul Samad Building and the padang, loveliest at golden hour.",
    detail: "15 minutes by Grab",
    score: "History in one square",
  },
] as const;

const shoppingPlaces = [
  {
    name: "Suria KLCC",
    note: "At the foot of the towers. Everything, under one roof.",
    detail: "5 minutes",
    score: "4.6 · 75,000 reviews",
  },
  {
    name: "Pavilion Kuala Lumpur",
    note: "Reached by the covered walkway, without stepping into the sun.",
    detail: "12 minutes on foot",
    score: "4.6 · 63,000 reviews",
  },
  {
    name: "Central Market Kuala Lumpur",
    note: "Batik, pewter and craft — the place for something to carry home.",
    detail: "15 minutes by Grab",
    score: "4.3 · 61,000 reviews",
  },
  {
    name: "The Exchange TRX",
    note: "The city's newest mall — Seibu, the big global names and a rooftop park above it all.",
    detail: "10 minutes by Grab",
    score: "KL's newest landmark",
  },
  {
    name: "Sungei Wang Plaza",
    note: "The bargain-hunter's mall — cheap finds of every kind, and famously cheap manicures and pedicures.",
    detail: "12 minutes",
    score: "Budget treasure hunt",
  },
] as const;

const usefulApps = [
  {
    name: "Grab",
    note: "Rides and food delivery — how most of Kuala Lumpur gets about.",
    ios: "https://apps.apple.com/app/grab-taxi-ride-food-delivery/id647268330",
    android:
      "https://play.google.com/store/apps/details?id=com.grabtaxi.passenger",
  },
  {
    name: "Wise",
    note: "Spend in ringgit at the real exchange rate \u2014 the card and app travellers swear by.",
    ios: "https://apps.apple.com/app/wise-ex-transferwise/id612261027",
    android:
      "https://play.google.com/store/apps/details?id=com.transferwise.android",
  },
  {
    name: "Google Maps",
    note: "Save the Kuala Lumpur map offline and you will never be lost.",
    ios: "https://apps.apple.com/app/google-maps/id585027354",
    android:
      "https://play.google.com/store/apps/details?id=com.google.android.apps.maps",
  },
] as const;

const guideCategories = [
  { id: "eat", title: "Where to eat", places: foodPlaces },
  { id: "see", title: "Worth seeing", places: sightseeingPlaces },
  { id: "shop", title: "Shopping", places: shoppingPlaces },
  { id: "spa", title: "Spa, massage & hair", places: pamperPlaces },
  { id: "apps", title: "Apps worth downloading", apps: usefulApps },
] as const;

const eveningMoments = [
  { time: "6:00 PM", title: "Arrival & canapés" },
  { time: "7:00 PM", title: "The celebration begins" },
] as const;

// A gateway timeout or a maintenance page is not JSON. Reading it as JSON
// used to throw, and the browser's raw parser message was shown to the
// guest. Turn any unreadable reply into words a guest can act on.
async function readGuestResponse<T>(
  response: Response,
  fallback: string,
): Promise<T & { error?: string }> {
  try {
    return (await response.json()) as T & { error?: string };
  } catch {
    if (
      response.status === 504 ||
      response.status === 502 ||
      response.status === 408
    ) {
      throw new Error(
        "That took a little too long to reach us. Please try once more in a moment.",
      );
    }
    throw new Error(fallback);
  }
}

function Countdown() {
  const target = useMemo(
    () => new Date("2026-11-07T18:00:00+08:00").getTime(),
    [],
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = target - now;
  if (remaining <= 0)
    return <p className="countdown-live">Today, we celebrate. ✦</p>;
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return (
    <div
      className="countdown"
      role="timer"
      aria-label={`${days} days, ${hours} hours and ${minutes} minutes until the wedding`}
    >
      <div>
        <strong>{days}</strong>
        <span>days</span>
      </div>
      <div>
        <strong>{hours}</strong>
        <span>hours</span>
      </div>
      <div>
        <strong>{minutes}</strong>
        <span>minutes</span>
      </div>
    </div>
  );
}

function ChoiceButton({
  id,
  selected,
  title,
  detail,
  detailsOpen,
  onToggleDetails,
  onSelect,
}: {
  id: string;
  selected: boolean;
  title: string;
  detail: string;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onSelect: () => void;
}) {
  const panelId = `${id}-description`;
  return (
    <article
      className={`meal-option${selected ? " is-selected" : ""}${detailsOpen ? " is-open" : ""}`}
    >
      <button
        type="button"
        className="meal-details-toggle"
        aria-expanded={detailsOpen}
        aria-controls={panelId}
        onClick={onToggleDetails}
      >
        <strong>{title}</strong>
        <span>{detailsOpen ? "Details −" : "Details +"}</span>
      </button>
      <div className="meal-description" id={panelId} aria-hidden={!detailsOpen}>
        <p>{detail}</p>
      </div>
      <button
        type="button"
        className="meal-select-button"
        aria-pressed={selected}
        onClick={onSelect}
        data-ripple
      >
        {selected ? "✓ Selected" : "Select this main course"}
      </button>
    </article>
  );
}

function EveningRecap({ guests }: { guests: GuestResponse[] }) {
  const attending = guests.filter(
    (guest) =>
      guest.rsvpStatus === "Confirmed" &&
      (guest.mealSelection ||
        guest.childMeal ||
        guest.dietaryRequirements.trim() ||
        guest.allergies.trim()),
  );
  if (!attending.length) return null;

  return (
    <section className="evening-recap" aria-labelledby="evening-recap-title">
      <p className="step-label" id="evening-recap-title">
        Your evening
      </p>
      <div className="evening-recap__guests">
        {attending.map((guest) => {
          const dietary = [guest.dietaryRequirements, guest.allergies]
            .map((entry) => entry.trim())
            .filter(Boolean)
            .join(" · ");
          return (
            <article key={guest.id}>
              <h3>{guest.name}</h3>
              {guest.mealSelection ? (
                <p>
                  <span>Main course</span>
                  <strong>
                    {guest.mealSelection === "Salmon"
                      ? "Seared Alaskan salmon"
                      : "Almond dukkha-crusted lamb"}
                  </strong>
                </p>
              ) : null}
              {guest.childMeal ? (
                <p>
                  <span>Main course</span>
                  <strong>Children&rsquo;s meal</strong>
                </p>
              ) : null}
              {dietary ? (
                <p>
                  <span>Dietary notes</span>
                  <strong>{dietary}</strong>
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function WeddingExperience({
  invitationToken,
  previewMode = false,
}: {
  invitationToken?: string;
  previewMode?: boolean;
}) {
  // the token arrives in the address, or is remembered from earlier in the visit
  const [token, setToken] = useState(
    previewMode ? "" : (invitationToken ?? ""),
  );
  useEffect(() => {
    // Review routes must stay isolated from a guest token remembered earlier
    // in the same browser tab. Otherwise an expired token can lock the safe
    // sample journey and make visual QA impossible.
    if (previewMode) {
      setToken("");
      return;
    }
    const resolved = readToken(invitationToken); // always runs, always remembers
    if (resolved) setToken(resolved);
  }, [invitationToken, previewMode]);
  const personalised = Boolean(token) || previewMode;
  // Anyone arriving without their own invitation link meets the photograph
  // first. They may step past it and look around, but the RSVP stays closed.
  const [filmReady, setFilmReady] = useState(false);
  const [replyPhase, setReplyPhase] = useState<"attendance" | "contact">(
    "attendance",
  );
  const [rsvp, setRsvp] = useState<RsvpState>(() =>
    previewMode
      ? { ...initialRsvp, guestName: "Your name", phoneNumber: "12345678" }
      : initialRsvp,
  );
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [guestResponses, setGuestResponses] = useState<GuestResponse[]>(() =>
    previewMode
      ? [
          {
            id: -1,
            name: "Your name",
            rsvpStatus: "Pending",
            ceremonyAttending: true,
            receptionAttending: true,
            // the preview walks the FULL journey, secret chapter included
            afterPartyInvited: true,
            afterPartyAttending: "Pending",
            mealSelection: "",
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
            advice: "",
            isChild: false,
            childMeal: false,
          },
        ]
      : [],
  );
  const [inviteLoading, setInviteLoading] = useState(Boolean(token));
  const [inviteError, setInviteError] = useState("");
  const [activeSection, setActiveSection] = useState("welcome");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submissionInFlight = useRef(false);
  const submissionId = useRef("");
  const progressRef = useRef<HTMLDivElement | null>(null);
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  const [openMealDetail, setOpenMealDetail] = useState<string | null>(null);
  const [music, setMusic] = useState<MusicSettings>({
    musicUrl: null,
    musicTitle: null,
  });
  const [siteDesign, setSiteDesign] = useState<SiteDesign>(defaultSiteDesign);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site-settings", { cache: "no-store" })
      .then(async (response) =>
        response.ok
          ? (response.json() as Promise<PublicSiteSettings>)
          : { musicUrl: null, musicTitle: null, siteDesign: null },
      )
      .then((result) => {
        if (!cancelled) {
          setMusic({
            musicUrl: result.musicUrl,
            musicTitle: result.musicTitle,
          });
          setSiteDesign(normaliseSiteDesign(result.siteDesign));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // The song lives in one shared player (see music.ts) that usually began
  // at the front door, inside the tap on ENTER — so by the time a guest is
  // here it is already playing and simply carries on. This effect adopts
  // that player: it points it at the couple's chosen track once settings
  // arrive, and mirrors its state into the sound button.
  useEffect(() => {
    if (!music.musicUrl) return;
    const player = musicElement();
    audioRef.current = player;
    const wanted = new URL(music.musicUrl, window.location.origin).href;
    if (player.src !== wanted) {
      const wasPlaying = !player.paused;
      player.src = wanted;
      if (wasPlaying) player.play().catch(() => undefined);
    }
    const onPlay = () => setSoundEnabled(true);
    const onPause = () => setSoundEnabled(false);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    setSoundEnabled(!player.paused);
    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, [music.musicUrl]);

  // If the guest arrived on a direct link and skipped the archway, the
  // player has not begun. Browsers refuse sound until a real gesture —
  // iPhone Safari honours only touchend or click — so every gesture
  // retries, and the listeners leave once the song is truly playing.
  useEffect(() => {
    if (!music.musicUrl) return;
    const events = ["click", "touchend", "pointerdown", "keydown"] as const;
    const start = () => {
      const player = audioRef.current;
      if (!player) return;
      // Already playing — or played before and deliberately paused by the
      // guest. Either way these listeners have nothing left to do; a tap
      // must never restart music someone chose to turn off.
      if (!player.paused || player.currentTime > 0) {
        detach();
        return;
      }
      player
        .play()
        .then(detach)
        .catch(() => undefined);
    };
    const detach = () => {
      events.forEach((name) => window.removeEventListener(name, start));
    };
    start();
    events.forEach((name) =>
      window.addEventListener(name, start, { passive: true }),
    );
    return detach;
  }, [music.musicUrl]);

  const toggleSound = async () => {
    const player = audioRef.current;
    if (!player) return;
    if (player.paused) {
      try {
        await player.play();
        setSoundEnabled(true);
      } catch {
        setSoundEnabled(false);
      }
    } else {
      player.pause();
      setSoundEnabled(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/invite/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await readGuestResponse<InviteData>(
          response,
          "Your invitation could not be opened just now. Please try your link again in a moment.",
        );
        if (!response.ok)
          throw new Error(
            result.error || "This invitation could not be opened.",
          );
        return result;
      })
      .then((result) => {
        if (cancelled) return;
        setInviteData(result);
        const names = joinGuestNames(
          result.guests.map(
            (guest) => guest.preferred_name || guest.first_name,
          ),
        );
        const phone = splitMobile(
          result.guests.find((guest) => guest.mobile)?.mobile || null,
        );
        const confirmedGuests = result.guests.filter(
          (guest) => guest.rsvp_status === "Confirmed",
        );
        const travelWasAnswered = confirmedGuests.some(
          (guest) => guest.has_submitted,
        );
        const travelling = confirmedGuests.some(
          (guest) =>
            Boolean(guest.transport_required) ||
            Boolean(guest.travel_arrival) ||
            Boolean(guest.travel_departure) ||
            Boolean(guest.accommodation_required) ||
            Boolean(guest.accommodation_name),
        );
        const requestedHyatt = confirmedGuests.some((guest) =>
          Boolean(guest.accommodation_required),
        );
        setRsvp({
          ...initialRsvp,
          guestName: names || result.household.name,
          ...phone,
          attendance: confirmedGuests.length
            ? "yes"
            : result.guests.every((guest) => guest.rsvp_status === "Declined")
              ? "no"
              : null,
          flyingIn: travelWasAnswered ? travelling : null,
          roomAtHyatt: travelWasAnswered && travelling ? requestedHyatt : null,
          arrivalDate:
            confirmedGuests
              .map((guest) => guest.travel_arrival || "")
              .find(Boolean) || "",
          departureDate:
            confirmedGuests
              .map((guest) => guest.travel_departure || "")
              .find(Boolean) || "",
          accommodation:
            confirmedGuests
              .map((guest) => guest.accommodation_name || "")
              .find(Boolean) || "",
          accessibilityNote:
            confirmedGuests
              .map((guest) => guest.accessibility || "")
              .find(Boolean) || "",
          wishes:
            result.guests.map((guest) => guest.wishes || "").find(Boolean) ||
            "",
          advice:
            confirmedGuests
              .map((guest) => guest.marriage_advice || "")
              .find(Boolean) || "",
          bedPreference:
            (confirmedGuests
              .map((guest) => guest.bed_preference || "")
              .find(Boolean) as "King" | "Twin" | undefined) ?? null,
          nights:
            confirmedGuests
              .map((guest) => guest.room_nights)
              .find((value) => typeof value === "number") ?? null,
        });
        setGuestResponses(
          result.guests.map((guest) => ({
            id: guest.id,
            name:
              guest.preferred_name ||
              `${guest.first_name} ${guest.last_name}`.trim(),
            rsvpStatus:
              guest.rsvp_status === "Confirmed" ||
              guest.rsvp_status === "Declined"
                ? guest.rsvp_status
                : "Pending",
            ceremonyAttending: guest.ceremony_invited
              ? guest.rsvp_status !== "Declined"
              : false,
            receptionAttending: guest.reception_invited
              ? guest.rsvp_status !== "Declined"
              : false,
            afterPartyInvited: Boolean(guest.after_party_invited),
            afterPartyAttending:
              guest.after_party_attending === "Yes" ||
              guest.after_party_attending === "No"
                ? guest.after_party_attending
                : "Pending",
            mealSelection:
              guest.meal_selection === "Lamb" ||
              guest.meal_selection === "Salmon"
                ? guest.meal_selection
                : "",
            dietaryRequirements: guest.dietary_requirements || "",
            allergies: guest.allergies || "",
            accessibility: guest.accessibility || "",
            transportRequired: Boolean(guest.transport_required),
            accommodationRequired: Boolean(guest.accommodation_required),
            travelArrival: guest.travel_arrival || "",
            travelDeparture: guest.travel_departure || "",
            accommodationName: guest.accommodation_name || "",
            bedPreference: guest.bed_preference || "",
            tableName: guest.table_name || "",
            roomNights:
              typeof guest.room_nights === "number" ? guest.room_nights : null,
            wishes: guest.wishes || "",
            advice: guest.marriage_advice || "",
            isChild: guest.age_group === "Child",
            childMeal: Boolean(guest.child_meal),
          })),
        );
      })
      .catch((loadError) => {
        if (!cancelled)
          setInviteError(
            loadError instanceof Error
              ? loadError.message
              : "This invitation could not be opened.",
          );
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const hiddenScenes = useMemo(
    () => new Set(siteDesign.hiddenScenes),
    [siteDesign.hiddenScenes],
  );
  const customAfter = useMemo(() => {
    const map = new Map<string, typeof siteDesign.customPages>();
    siteDesign.customPages.forEach((page) =>
      map.set(page.afterScene, [...(map.get(page.afterScene) ?? []), page]),
    );
    return map;
  }, [siteDesign.customPages]);
  const validPhone = () => rsvp.phoneNumber.replace(/\D/g, "").length >= 7;
  const someoneAttending = guestResponses.some(
    (guest) => guest.rsvpStatus === "Confirmed",
  );
  const attendanceComplete =
    personalised &&
    guestResponses.length > 0 &&
    guestResponses.every((guest) => guest.rsvpStatus !== "Pending");
  const rsvpComplete =
    attendanceComplete &&
    // a number is only asked of guests who are coming
    (!someoneAttending || validPhone());
  const anyYes =
    rsvpComplete &&
    guestResponses.some((guest) => guest.rsvpStatus === "Confirmed");
  const allDeclined =
    rsvpComplete &&
    !guestResponses.some((guest) => guest.rsvpStatus === "Confirmed");
  const mealComplete =
    anyYes &&
    guestResponses.every(
      (guest) =>
        guest.rsvpStatus !== "Confirmed" ||
        guest.childMeal ||
        Boolean(guest.mealSelection),
    );
  // When the block is full there is no question left to answer, so the step
  // completes on its own and the guest simply sees the nearby hotels.
  const roomBlockFull = Boolean(inviteData?.roomBlock?.full);
  const roomComplete =
    roomBlockFull && rsvp.roomAtHyatt !== true
      ? true
      : rsvp.roomAtHyatt === true
        ? Boolean(rsvp.bedPreference) &&
          Boolean(rsvp.nights) &&
          Boolean(rsvp.arrivalDate)
        : rsvp.roomAtHyatt === false;
  const travelComplete =
    mealComplete &&
    (hiddenScenes.has("travel") ||
      rsvp.flyingIn === false ||
      (rsvp.flyingIn === true && roomComplete));
  const flyingIn = travelComplete && rsvp.flyingIn === true;
  const journeyDone = travelComplete || allDeclined;
  // The same answer gates still protect the RSVP, but eligible chapters now
  // stay together in one continuous invitation scroll.
  const wizardSteps = useMemo(() => {
    const steps: Array<{
      id: string;
      sections: string[];
      ready: boolean;
      cta: string;
    }> = [
      {
        id: "invitation",
        sections: ["invitation", "table", "schedule"],
        ready: true,
        cta: "Begin",
      },
      { id: "reply", sections: ["rsvp"], ready: rsvpComplete, cta: "Next" },
    ];
    // Each step may only exist while its section is actually on the page —
    // these conditions mirror the render gates below. A step whose section
    // is missing showed an empty screen, and the blank-page safety net then
    // returned the guest to the very beginning. A couple who both declined
    // met exactly that: "venue" never renders for them (it waits for
    // travelComplete), so Next bounced them home instead of onward to the
    // wishes page.
    if (anyYes && !hiddenScenes.has("dress"))
      steps.push({
        id: "dress",
        sections: ["dress"],
        ready: true,
        cta: "Next",
      });
    if (anyYes)
      steps.push({
        id: "meal",
        sections: ["meal"],
        ready: mealComplete,
        cta: "Next",
      });
    if (anyYes && !hiddenScenes.has("travel"))
      steps.push({
        id: "travel",
        sections: ["travel"],
        ready: travelComplete,
        cta: "Next",
      });
    if (flyingIn && !hiddenScenes.has("recommendations"))
      steps.push({
        id: "guide",
        sections: ["recommendations"],
        ready: true,
        cta: "Next",
      });
    if (travelComplete && !hiddenScenes.has("venue"))
      steps.push({
        id: "venue",
        sections: ["venue"],
        ready: true,
        cta: "Next",
      });
    steps.push({
      id: "wishes",
      sections: ["wishes"],
      ready: journeyDone,
      cta: "",
    });
    // The venue was sharing the closing page, and because it sits earlier in
    // the document it appeared above the confirmation — which is what buried
    // the secret chapter. It gets a page of its own.
    steps.push({
      id: "final",
      sections: ["confirmation", "afterparty", "gallery"],
      ready: false,
      cta: "",
    });
    return steps;
  }, [
    anyYes,
    flyingIn,
    rsvpComplete,
    mealComplete,
    travelComplete,
    journeyDone,
    hiddenScenes,
  ]);
  const activeWizardIndex = Math.max(
    0,
    wizardSteps.findIndex((entry) => entry.sections.includes(activeSection)),
  );
  const currentStepId = wizardSteps[activeWizardIndex]?.id ?? "invitation";
  const usesFixedWizardNav = ["reply", "meal", "travel"].includes(
    currentStepId,
  );
  const fixedNextReady =
    currentStepId === "reply" && replyPhase === "attendance"
      ? attendanceComplete
      : wizardSteps[activeWizardIndex]?.ready;
  const pendingTravelQuestion =
    rsvp.flyingIn === null
      ? "journey"
      : rsvp.flyingIn === true && !roomBlockFull && rsvp.roomAtHyatt === null
        ? "room"
        : rsvp.roomAtHyatt === true && !rsvp.bedPreference
          ? "bed"
          : rsvp.roomAtHyatt === true && !rsvp.nights
            ? "nights"
            : rsvp.roomAtHyatt === true && !rsvp.arrivalDate
              ? "arrival"
              : null;
  const travelQuestionTitle =
    pendingTravelQuestion === "journey"
      ? "Are you travelling to Kuala Lumpur?"
      : pendingTravelQuestion === "room"
        ? "Would you like to stay at Grand Hyatt Kuala Lumpur?"
        : pendingTravelQuestion === "bed"
          ? "Which room would you prefer?"
          : pendingTravelQuestion === "nights"
            ? "How long will you stay?"
            : pendingTravelQuestion === "arrival"
              ? "When will you arrive?"
              : "Is there anything you may need on the evening?";

  const revealTravelQuestion = (question: string) => {
    // This is reserved for an explicit press of the fixed Next control. The
    // answer buttons themselves reveal the following question in place; auto
    // scrolling after every answer fought iOS Safari's native date picker and
    // made the page appear to jump.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-travel-question="${question}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  };

  // Next is deterministic: a complete page turns once; an incomplete Travel
  // page carries the guest to the exact answer still needed.
  const advance = () => {
    if (
      currentStepId === "reply" &&
      replyPhase === "attendance" &&
      attendanceComplete &&
      someoneAttending
    ) {
      setReplyPhase("contact");
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => scrollToSection("rsvp")),
      );
      return;
    }
    if (
      wizardSteps[activeWizardIndex].id === "travel" &&
      !travelComplete &&
      pendingTravelQuestion
    ) {
      revealTravelQuestion(pendingTravelQuestion);
      return;
    }
    const next = wizardSteps[activeWizardIndex + 1];
    const target = next?.sections.find((id) => document.getElementById(id));
    if (target) scrollToSection(target);
  };

  const goToSection = (id: string) => {
    window.requestAnimationFrame(() => scrollToSection(id));
  };
  useEffect(() => {
    if (!submitted) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        document
          .getElementById("confirmation")
          ?.scrollIntoView({ behavior: "auto", block: "start" });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [submitted]);
  // Eligible chapters stay mounted in normal document flow. Answers reveal
  // what follows without removing or repositioning the invitation above.
  const seatedGuests = guestResponses.filter(
    (guest) => guest.rsvpStatus === "Confirmed" && guest.tableName,
  );
  const tablesAssigned = seatedGuests.length > 0;
  useEffect(() => {
    if (!rsvpComplete) return;
    const next = anyYes ? "yes" : "no";
    setRsvp((current) =>
      current.attendance === next ? current : { ...current, attendance: next },
    );
  }, [rsvpComplete, anyYes]);
  const sectionIds = useMemo(() => {
    const ids = ["invitation", "schedule", "rsvp"];
    if (tablesAssigned) ids.splice(1, 0, "table");
    if (anyYes) ids.push("dress", "meal");
    if (mealComplete) ids.push("travel");
    if (flyingIn) ids.push("recommendations");
    if (travelComplete) ids.push("venue");
    if (journeyDone) ids.push("wishes");
    if (submitted) ids.push("confirmation");
    // The secret chapter stays sealed until the couple assigns a table —
    // it arrives with the follow-up link that carries the seat allocation.
    if (
      submitted &&
      (previewMode || (inviteData?.afterPartyInvited && tablesAssigned))
    )
      ids.push("afterparty");
    if (submitted && journeyDone) ids.push("gallery");
    // Editor-hidden chapters drop out; editor-added pages slide in after their anchor.
    return ids.flatMap((id) => [
      ...(hiddenScenes.has(id) ? [] : [id]),
      ...(customAfter.get(id) ?? []).map((page) => page.id),
    ]);
  }, [
    anyYes,
    mealComplete,
    travelComplete,
    flyingIn,
    journeyDone,
    submitted,
    tablesAssigned,
    hiddenScenes,
    customAfter,
  ]);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      let nearest = "";
      let best = Infinity;
      document
        .querySelectorAll<HTMLElement>("[data-scene]")
        .forEach((section) => {
          const box = section.getBoundingClientRect();
          if (box.height === 0) return;
          if (box.top < window.innerHeight && box.bottom > 0)
            section.classList.add("is-visible");
          const distance = Math.abs(box.top + box.height / 2 - middle);
          if (distance < best) {
            best = distance;
            nearest = section.id;
          }
        });
      if (nearest) setActiveSection(nearest);
      const scrollable = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollable));
      progressRef.current?.style.setProperty(
        "--invitation-progress",
        String(progress),
      );
      progressRef.current?.setAttribute(
        "aria-valuenow",
        String(Math.round(progress * 100)),
      );
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request, { passive: true });
    read();
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sectionIds]);
  const chapterLabels = useMemo(
    () => ({
      ...sceneLabels,
      ...Object.fromEntries(
        siteDesign.customPages.map((page) => [page.id, page.title]),
      ),
    }),
    [siteDesign.customPages],
  );
  // Text placement and size, as arranged in the website editor.
  const textStyle = (scene: string): CSSProperties => {
    const layout = siteDesign.textLayout?.[scene];
    if (!layout) return {};
    return {
      "--text-x": `${layout.x}%`,
      "--text-y": `${layout.y}%`,
      "--text-size": layout.size,
    } as CSSProperties;
  };

  // A chapter becomes part of the scroll as soon as its factual prerequisites
  // are met; it is never absolutely positioned or treated as a separate page.
  const stepHas = (id: string) => sectionIds.includes(id);

  const renderCustomPages = (anchor: string) =>
    (stepHas(anchor) ? (customAfter.get(anchor) ?? []) : []).map((page) => (
      <section
        key={page.id}
        id={page.id}
        className={`scene scene--custom custom-after-${anchor}`}
        data-scene
        aria-label={page.title}
      >
        <div className="scene-content custom-page-card reveal">
          {page.kicker ? <p className="eyebrow">{page.kicker}</p> : null}
          <h2>{page.title}</h2>
          {page.body
            .split(/\n+/)
            .filter(Boolean)
            .map((line, index) => (
              <p key={index}>{line}</p>
            ))}
        </div>
      </section>
    ));

  // Let the couple see who now knows where they are sitting.
  useEffect(() => {
    if (!tablesAssigned || !token || previewMode) return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/invite/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tableSeen" }),
      }).catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [tablesAssigned, token, previewMode]);

  // The keyboard now overlays the page rather than resizing it, which keeps
  // the layout still — but it also means a field near the bottom can end up
  // behind the keyboard. Bring whatever is focused into view.
  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      // Only fields that raise the keyboard, and only when the keyboard would
      // actually cover them. A native date picker manages its own viewport on
      // iOS; scrolling it here as well makes the calendar feel unresponsive.
      if (
        !target ||
        !target.matches(
          "input:not([type='checkbox']):not([type='radio']):not([type='date']), textarea",
        )
      )
        return;
      window.setTimeout(() => {
        const box = target.getBoundingClientRect();
        const keyboardTop = window.innerHeight * 0.55;
        if (box.bottom > keyboardTop)
          target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 280);
    };
    window.addEventListener("focusin", onFocus);
    return () => window.removeEventListener("focusin", onFocus);
  }, []);

  // A safety net: if any overlay ever leaves the page frozen, release it.
  useEffect(() => {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }, [submitted]);

  const update = <K extends keyof RsvpState>(key: K, value: RsvpState[K]) => {
    submissionId.current = "";
    setRsvp((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const updateGuest = (id: number, patch: Partial<GuestResponse>) => {
    submissionId.current = "";
    setGuestResponses((current) =>
      current.map((guest) =>
        guest.id === id ? { ...guest, ...patch } : guest,
      ),
    );
    setError("");
  };

  const submitRsvp = async () => {
    if (submissionInFlight.current) return;
    if (previewMode) {
      submissionInFlight.current = true;
      setSubmitting(true);
      setError("");
      window.setTimeout(() => {
        setSubmitting(false);
        setSubmitted(true);
        submissionInFlight.current = false;
      }, 900);
      return;
    }
    if (!token) {
      setError("Replies may only be sent through your own invitation link.");
      goToSection("rsvp");
      return;
    }
    if (someoneAttending && !validPhone()) {
      setError("A number to reach you on, and your reply is ready to send.");
      goToSection("rsvp");
      return;
    }
    if (guestResponses.some((guest) => guest.rsvpStatus === "Pending")) {
      setError("A reply is still awaited for one of the names above.");
      goToSection("rsvp");
      return;
    }
    if (
      guestResponses.some(
        (guest) =>
          guest.rsvpStatus === "Confirmed" &&
          !guest.childMeal &&
          !guest.mealSelection,
      )
    ) {
      setError("A main course is still to be chosen for someone joining us.");
      goToSection("meal");
      return;
    }
    if (rsvp.attendance === "yes" && !hiddenScenes.has("travel")) {
      if (rsvp.flyingIn === null) {
        setError("Do let us know whether anyone in your party is flying in.");
        goToSection("travel");
        return;
      }
      // Only ask about a room while there is one to offer. Once the block is
      // full the question is not on the page at all, and demanding an answer
      // to it left flying-in guests unable to send their reply.
      if (rsvp.flyingIn && !roomBlockFull && rsvp.roomAtHyatt === null) {
        setError(
          "Do let us know whether a room at the Grand Hyatt would help.",
        );
        goToSection("travel");
        return;
      }
      if (
        rsvp.flyingIn &&
        rsvp.roomAtHyatt === true &&
        (!rsvp.arrivalDate || !rsvp.nights)
      ) {
        setError(
          "Your check-in date and how many nights, whenever you know them.",
        );
        goToSection("travel");
        return;
      }
    }
    submissionInFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      // Guests type their number the way they say it: "0412 345 678", or
      // sometimes with the country code repeated. Both would be saved as a
      // number nobody can ring.
      const codeDigits = rsvp.countryCode.replace(/\D/g, "");
      let localDigits = rsvp.phoneNumber.replace(/\D/g, "");
      if (
        localDigits.startsWith(codeDigits) &&
        localDigits.length > codeDigits.length + 6
      ) {
        localDigits = localDigits.slice(codeDigits.length); // code typed twice
      }
      localDigits = localDigits.replace(/^0+/, ""); // local trunk zero
      const mobile = localDigits ? `${rsvp.countryCode}${localDigits}` : "";
      // The visible message field is explicitly private. Anchor it to the
      // first named response even when the whole household declines, while
      // preserving any legacy shareable guest-book wish already on a record.
      const firstResponseId = guestResponses[0]?.id;
      const guests = guestResponses.map((guest) => ({
        ...guest,
        ceremonyAttending:
          guest.rsvpStatus === "Confirmed" && guest.ceremonyAttending,
        receptionAttending:
          guest.rsvpStatus === "Confirmed" && guest.receptionAttending,
        travelArrival: guest.rsvpStatus === "Confirmed" ? rsvp.arrivalDate : "",
        travelDeparture:
          guest.rsvpStatus === "Confirmed"
            ? checkOutDate(rsvp.arrivalDate, rsvp.nights)
            : "",
        bedPreference:
          guest.rsvpStatus === "Confirmed" && rsvp.roomAtHyatt === true
            ? (rsvp.bedPreference ?? "")
            : "",
        roomNights:
          guest.rsvpStatus === "Confirmed" && rsvp.roomAtHyatt === true
            ? rsvp.nights
            : null,
        accommodationRequired:
          guest.rsvpStatus === "Confirmed" && rsvp.roomAtHyatt === true,
        accommodationName:
          guest.rsvpStatus === "Confirmed" && rsvp.roomAtHyatt === false
            ? rsvp.accommodation
            : "",
        transportRequired:
          guest.rsvpStatus === "Confirmed" && rsvp.flyingIn === true,
        accessibility:
          guest.rsvpStatus === "Confirmed" ? rsvp.accessibilityNote : "",
        // Preserve any legacy shareable message in its original field. The
        // current private note is written only once per household.
        wishes: guest.wishes,
        advice:
          guest.id === firstResponseId || guestResponses.length === 1
            ? rsvp.advice
            : guest.advice,
      }));
      if (!submissionId.current) {
        submissionId.current =
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      }
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile,
          guests,
          submissionId: submissionId.current,
        }),
      });
      const result = await readGuestResponse<{ ok?: boolean }>(
        response,
        "We couldn’t save your RSVP just now. Please try again in a moment — nothing has been lost.",
      );
      if (!response.ok)
        throw new Error(result.error || "Unable to save your RSVP.");
      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We couldn’t save your RSVP. Please try again.",
      );
    } finally {
      setSubmitting(false);
      submissionInFlight.current = false;
    }
  };

  if (inviteLoading)
    return (
      <main className="invitation-loading">
        <div className="wax-seal">
          E<span>&amp;</span>H
        </div>
        <p>Unfolding your invitation…</p>
        <i />
      </main>
    );
  // Until a token is resolved we show nothing; after that, either the
  // invitation or the locked card. Wedding details never reach the page
  // for a visitor without a personal link.
  if (!previewMode && !inviteLoading && !token) return <LockedInvitation />;

  if (inviteError)
    return (
      <main className="invitation-invalid">
        <span>✦</span>
        <h1>This invitation is resting.</h1>
        <p>{inviteError}</p>
        <a href="/">Return to Elaine &amp; Haykal</a>
      </main>
    );

  const content = siteDesign.content;
  const designClasses = siteDesign.hiddenBuiltIns
    .map((id) => `hide-${id}`)
    .join(" ");
  const selectedFont =
    fontPairs.find((pair) => pair.id === siteDesign.fontPair) ?? fontPairs[0];
  const storedConfirmationCopy =
    inviteData?.settings?.confirmation_message?.trim() || "";
  const confirmationCopy =
    !storedConfirmationCopy ||
    storedConfirmationCopy.includes(
      "hardly wait to celebrate, feast and dance",
    ) ||
    storedConfirmationCopy.includes("Your place at our table is saved")
      ? "We’re delighted you’ll be joining us. We can’t wait to celebrate with you."
      : storedConfirmationCopy;
  const confirmationGuestName =
    invitationCaseName(rsvp.guestName) || "dear guest";
  const deadlineLabel =
    rsvpDeadlineLabel(inviteData?.settings?.rsvp_deadline) ||
    "15 September 2026";
  const typography = {
    "--font-header": selectedFont.headerFamily,
    "--font-body": selectedFont.bodyFamily,
  } as CSSProperties;

  return (
    <main
      className={`wedding-shell wedding-shell--storybook invitation-scroll ${designClasses}${submitted ? " invitation-scroll--confirmed" : ""}`}
      style={typography}
    >
      <DreamBackdrop />

      {personalised && !submitted ? (
        <div
          ref={progressRef}
          className="invitation-progress"
          role="progressbar"
          aria-label="Invitation progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
        >
          <span aria-hidden="true">
            <i />
          </span>
        </div>
      ) : null}

      <EtherealLoader ready={filmReady} />
      {personalised ? (
        <SiteMenu
          links={[
            {
              label: "Invitation",
              onSelect: () => goToSection("invitation"),
            },
            // these move between steps rather than jumping to anchors, which cannot
            // reach a section the wizard is currently holding hidden
            { label: "Your reply", onSelect: () => goToSection("rsvp") },
            ...(submitted
              ? [
                  {
                    label: "Thank you",
                    onSelect: () => goToSection("confirmation"),
                  },
                ]
              : []),
            // The secret chapter is deliberately absent here: it reveals
            // itself on the confirmation page once a table has been
            // assigned, and is never advertised in the menu.
          ]}
        />
      ) : null}
      <Dreamscape onReady={() => setFilmReady(true)} />
      <CinematicMotion confirmed={submitted} />
      <BubbleCursor zIndex={18} />
      <a className="skip-experience" href="#rsvp">
        Skip our story and go to the RSVP
      </a>
      {music.musicUrl ? (
        <>
          {/* The audio itself is the shared player from music.ts — begun at
              the front door and adopted by the effect above. */}
          <button
            type="button"
            className="sound-control"
            onClick={toggleSound}
            aria-pressed={soundEnabled}
            aria-label={
              soundEnabled ? "Pause wedding music" : "Play wedding music"
            }
          >
            <span aria-hidden="true">{soundEnabled ? "❚❚" : "♪"}</span>
          </button>
        </>
      ) : null}
      {stepHas("invitation") ? (
        <section
          id="invitation"
          data-sky="dream-2"
          style={textStyle("invitation")}
          className="scene scene--invitation"
          data-scene
          data-cinematic="invitation"
          data-ripple-zone
        >
          <img
            className="scene-art scene-art--floral"
            src="/wedding/floral-frame.webp"
            alt=""
            loading="lazy"
            aria-hidden="true"
            onError={removeBrokenImage}
          />
          <img
            className="scene-art floating-bloom floating-bloom--left"
            src="/wedding/pearl-floral.webp"
            alt=""
            loading="lazy"
            aria-hidden="true"
            onError={removeBrokenImage}
          />
          <img
            className="scene-art floating-bloom floating-bloom--right"
            src="/wedding/pearl-floral.webp"
            alt=""
            loading="lazy"
            aria-hidden="true"
            onError={removeBrokenImage}
          />
          <div className="scene-content invitation-card reveal">
            <p className="eyebrow">{content.familyLine}</p>
            <h2>
              <span className="ink">
                <span className="script-full-name">
                  <ScriptName name={content.brideName} />
                </span>
                <span className="amp">&amp;</span>{" "}
                <span className="script-full-name">
                  <ScriptName name={content.groomName} />
                </span>
              </span>
            </h2>
            <p className="invitation-line">{content.invitationLine}</p>
            <RibbonDivider />
            <div className="event-details">
              <p>
                <strong>Saturday</strong>
                <span>{content.eventDate}</span>
              </p>
              <p>
                <strong>{content.eventTime.replace(/pm$/i, "")}</strong>
                <span>in the evening</span>
              </p>
              <p>
                <strong>{content.venueName}</strong>
                <span>Grand Hyatt Kuala Lumpur</span>
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {stepHas("table") && tablesAssigned ? (
        <section
          id="table"
          data-sky="dream-3"
          style={textStyle("table")}
          className="scene scene--blush"
          data-scene
        >
          <div className="scene-content table-card reveal">
            <p className="step-label">On the night</p>
            <h2>{seatedGuests.length > 1 ? "Your tables" : "Your table"}</h2>
            <p className="section-intro">
              Come straight up to The Grand Salon — someone will show you the
              rest.
            </p>
            <div className="table-plaques">
              {seatedGuests.map((guest) => (
                <article key={guest.id}>
                  <span>{guest.name}</span>
                  <strong>{guest.tableName}</strong>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {renderCustomPages("table")}

      {renderCustomPages("invitation")}
      {stepHas("schedule") && !hiddenScenes.has("schedule") ? (
        <section
          id="schedule"
          data-sky="dream-1"
          style={textStyle("schedule")}
          className="scene scene--schedule"
          data-scene
          data-cinematic="programme"
        >
          <img
            className="scene-art scene-art--schedule"
            src="/wedding/frame-tall.webp"
            alt=""
            loading="lazy"
            aria-hidden="true"
            onError={removeBrokenImage}
          />
          <div className="scene-content schedule-card reveal">
            <p className="step-label">The programme</p>
            <h2 className="script-heading script-heading--section">
              The evening
            </h2>
            <ol className="evening-timeline">
              {eveningMoments.map((moment, index) => (
                <li
                  key={moment.title}
                  style={{ "--stagger": `${index * 150}ms` } as CSSProperties}
                >
                  <span className="timeline-time">{moment.time}</span>
                  <div>
                    <h3>{moment.title}</h3>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
      {renderCustomPages("schedule")}

      {stepHas("rsvp") ? (
        <section
          id="rsvp"
          data-sky="dream-1"
          style={textStyle("rsvp")}
          className="scene scene--paper"
          data-scene
          data-cinematic="reply"
        >
          <div
            className="chapter-veil chapter-veil--reply"
            aria-hidden="true"
          />
          <img
            className="scene-art scene-art--dinner"
            src="/wedding/dinner-table.webp"
            alt="A hand-drawn wedding reception table"
            loading="lazy"
            onError={removeBrokenImage}
          />
          <div className="scene-content form-card reveal">
            <p className="step-label">Your reply</p>
            {personalised ? (
              <>
                <>
                  <h2 className="script-heading script-heading--long">
                    Will you
                    <br />
                    join us?
                  </h2>
                  <p className="section-intro">
                    We&rsquo;re delighted to celebrate with everyone named on
                    this invitation.
                  </p>
                  <p className="rsvp-deadline-note">
                    Kindly reply by {deadlineLabel}. You may update your
                    response through this link at any time before then.
                  </p>
                  <div className="party-rsvp-list">
                    {guestResponses.map((guest) => (
                      <fieldset key={guest.id}>
                        <legend>{guest.name}</legend>
                        <div className="segmented-control">
                          <button
                            type="button"
                            aria-pressed={guest.rsvpStatus === "Confirmed"}
                            data-ripple
                            className={
                              guest.rsvpStatus === "Confirmed"
                                ? "is-selected"
                                : ""
                            }
                            onClick={() =>
                              updateGuest(guest.id, {
                                rsvpStatus: "Confirmed",
                                receptionAttending: true,
                              })
                            }
                          >
                            Will attend
                          </button>
                          <button
                            type="button"
                            aria-pressed={guest.rsvpStatus === "Declined"}
                            data-ripple
                            className={
                              guest.rsvpStatus === "Declined"
                                ? "is-selected"
                                : ""
                            }
                            onClick={() =>
                              updateGuest(guest.id, {
                                rsvpStatus: "Declined",
                                receptionAttending: false,
                                ceremonyAttending: false,
                                mealSelection: "",
                              })
                            }
                          >
                            Unable to attend
                          </button>
                        </div>
                      </fieldset>
                    ))}
                  </div>
                  {attendanceComplete && someoneAttending ? (
                    <div className="reply-contact slide-open">
                      <h2 className="reply-contact-title">Mobile number</h2>
                      <p className="section-intro">
                        We&rsquo;ll send your table number here via WhatsApp.
                      </p>
                      <div className="field-grid phone-grid">
                        <label className="phone-code">
                          <span className="visually-hidden">Country code</span>
                          <select
                            value={rsvp.countryCode}
                            onChange={(event) =>
                              update("countryCode", event.target.value)
                            }
                            aria-label="Country calling code"
                          >
                            {countryCodes.map(([country, code]) => (
                              <option key={`${country}-${code}`} value={code}>
                                {country === "Other"
                                  ? "Other"
                                  : `${country} ${code}`}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className="visually-hidden">Mobile number</span>
                          <input
                            required
                            value={rsvp.phoneNumber}
                            onChange={(event) =>
                              update("phoneNumber", event.target.value)
                            }
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel-national"
                            placeholder="12 345 6789"
                            maxLength={24}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}
                </>
                {guestResponses.length === 0 ? (
                  <p className="form-error" role="alert">
                    We are unable to find the names attached to this invitation,
                    so the reply buttons are missing. Do let Elaine and Haykal
                    know — nothing entered here can be saved until it is put
                    right.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="invitation-only">
                <span aria-hidden="true">🔐</span>
                <h3>Your invitation is your key</h3>
                <p>
                  Replies are opened only through the personal link Elaine and
                  Haykal have sent you. It carries the names of those they have
                  invited, and cannot be extended to additional guests.
                </p>
                <p className="invitation-only-note">
                  The rest of the evening — the dress code, the menu, and how to
                  find us — opens with that link. This is where the page ends
                  for now.
                </p>
              </div>
            )}
            {error && activeSection === "rsvp" ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {renderCustomPages("rsvp")}
      {stepHas("dress") && anyYes && !hiddenScenes.has("dress") ? (
        <section
          id="dress"
          data-sky="dream-3"
          style={textStyle("dress")}
          className="scene scene--blush"
          data-scene
          data-cinematic="dress"
        >
          <div
            className="chapter-veil chapter-veil--dress"
            aria-hidden="true"
          />
          <img
            className="scene-art scene-art--wide-frame"
            src="/wedding/frame-wide.webp"
            alt=""
            loading="lazy"
            aria-hidden="true"
            onError={removeBrokenImage}
          />
          <div className="scene-content dress-card reveal">
            <p className="step-label">Dress code</p>
            <h2 className="script-heading script-heading--section">
              {content.dressCode}
            </h2>
            <p className="dress-note">
              <DressNote text={content.dressNote} />
            </p>
            <p className="dress-restriction">{content.dressRestriction}</p>
          </div>
        </section>
      ) : null}

      {renderCustomPages("dress")}
      {stepHas("meal") && anyYes ? (
        <section
          id="meal"
          data-sky="dream-1"
          style={textStyle("meal")}
          className="scene scene--paper scene--meal"
          data-scene
          data-cinematic="meal"
        >
          <img
            className="scene-art scene-art--feast"
            src="/wedding/feast-table.webp"
            alt="A hand-drawn candlelit wedding feast"
            loading="lazy"
            onError={removeBrokenImage}
          />
          <div className="scene-content form-card reveal">
            <p className="step-label">At the table</p>
            <h2 className="script-heading script-heading--long">
              Choose your main course
            </h2>
            <div className="guest-meal-list">
              {guestResponses
                .filter((guest) => guest.rsvpStatus === "Confirmed")
                .map((guest) => (
                  <fieldset key={guest.id}>
                    <legend>{guest.name}</legend>
                    {guest.childMeal ? (
                      <p className="section-intro">Children&rsquo;s meal</p>
                    ) : (
                      <div className="choice-grid choice-grid--two meal-choices">
                        <ChoiceButton
                          id={`meal-${guest.id}-salmon`}
                          selected={guest.mealSelection === "Salmon"}
                          title="Seared Alaskan salmon"
                          detail={salmonDescription}
                          detailsOpen={
                            openMealDetail === `meal-${guest.id}-salmon`
                          }
                          onToggleDetails={() =>
                            setOpenMealDetail((current) =>
                              current === `meal-${guest.id}-salmon`
                                ? null
                                : `meal-${guest.id}-salmon`,
                            )
                          }
                          onSelect={() =>
                            updateGuest(guest.id, { mealSelection: "Salmon" })
                          }
                        />
                        <ChoiceButton
                          id={`meal-${guest.id}-lamb`}
                          selected={guest.mealSelection === "Lamb"}
                          title="Almond dukkha-crusted lamb"
                          detail={lambDescription}
                          detailsOpen={
                            openMealDetail === `meal-${guest.id}-lamb`
                          }
                          onToggleDetails={() =>
                            setOpenMealDetail((current) =>
                              current === `meal-${guest.id}-lamb`
                                ? null
                                : `meal-${guest.id}-lamb`,
                            )
                          }
                          onSelect={() =>
                            updateGuest(guest.id, { mealSelection: "Lamb" })
                          }
                        />
                      </div>
                    )}
                    <div className="field-grid field-grid--single">
                      <label>
                        <span>Dietary requirements or allergies</span>
                        <input
                          value={guest.dietaryRequirements}
                          onChange={(event) =>
                            updateGuest(guest.id, {
                              dietaryRequirements: event.target.value,
                            })
                          }
                          placeholder="Vegetarian, no nuts…"
                          maxLength={800}
                        />
                      </label>
                    </div>
                  </fieldset>
                ))}
            </div>
            {error && activeSection === "meal" ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {renderCustomPages("meal")}
      {stepHas("travel") && mealComplete && !hiddenScenes.has("travel") ? (
        <section
          id="travel"
          data-sky="dream-1"
          style={textStyle("travel")}
          className="scene scene--pearl"
          data-scene
          data-cinematic="travel"
        >
          <div className="scene-content form-card form-card--glass reveal">
            <p className="step-label">Travel</p>
            <h2
              className={
                pendingTravelQuestion === "journey" ||
                pendingTravelQuestion === "room"
                  ? "script-heading script-heading--long"
                  : undefined
              }
            >
              {pendingTravelQuestion === "journey" ? (
                <>
                  Are you travelling
                  <br />
                  to Kuala Lumpur?
                </>
              ) : (
                travelQuestionTitle
              )}
            </h2>
            {rsvp.flyingIn !== null && pendingTravelQuestion !== "journey" ? (
              <div className="answer-trail" aria-label="Your travel answers">
                <button
                  type="button"
                  onClick={() => {
                    update("flyingIn", null);
                    update("roomAtHyatt", null);
                    update("bedPreference", null);
                    update("nights", null);
                    update("arrivalDate", "");
                  }}
                >
                  <span>Travelling</span>
                  <strong>{rsvp.flyingIn ? "Yes" : "No"}</strong>
                  <small>Change</small>
                </button>
                {rsvp.flyingIn && rsvp.roomAtHyatt !== null ? (
                  <button
                    type="button"
                    onClick={() => {
                      update("roomAtHyatt", null);
                      update("bedPreference", null);
                      update("nights", null);
                      update("arrivalDate", "");
                    }}
                  >
                    <span>Grand Hyatt</span>
                    <strong>{rsvp.roomAtHyatt ? "Yes" : "No"}</strong>
                    <small>Change</small>
                  </button>
                ) : null}
              </div>
            ) : null}
            {pendingTravelQuestion === "journey" ? (
              <fieldset data-travel-question="journey">
                {/* the heading above already asks; the legend repeats it only
                  for assistive technology */}
                <legend className="visually-hidden">
                  Are you travelling to Kuala Lumpur?
                </legend>
                <div className="segmented-control">
                  <button
                    type="button"
                    aria-pressed={rsvp.flyingIn === true}
                    data-ripple
                    className={rsvp.flyingIn === true ? "is-selected" : ""}
                    onClick={() => {
                      update("flyingIn", true);
                    }}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    aria-pressed={rsvp.flyingIn === false}
                    data-ripple
                    className={rsvp.flyingIn === false ? "is-selected" : ""}
                    onClick={() => {
                      update("flyingIn", false);
                      update("roomAtHyatt", null);
                    }}
                  >
                    No
                  </button>
                </div>
              </fieldset>
            ) : null}
            {rsvp.flyingIn && roomBlockFull ? (
              <div className="slide-open travel-details">
                <p className="room-offer room-offer--full">
                  <strong>Our rooms at the Grand Hyatt are all taken</strong>
                  <span>
                    We are sorry — the last of the rooms we held has gone. A few
                    nearby options are below, and the hotel itself may still
                    have rooms of its own.
                  </span>
                </p>
                <NearbyHotelList />
              </div>
            ) : rsvp.flyingIn ? (
              <div className="slide-open travel-details">
                {pendingTravelQuestion === "room" ? (
                  <div className="room-offer">
                    <strong>Grand Room</strong>
                    <b>RM850++ per night</b>
                    <span>
                      A preferred rate is available for our guests at Grand
                      Hyatt Kuala Lumpur, where the reception will be held.
                    </span>
                  </div>
                ) : null}
                {pendingTravelQuestion === "room" ? (
                  <fieldset data-travel-question="room">
                    <legend className="visually-hidden">
                      Would you like to stay at Grand Hyatt Kuala Lumpur?
                    </legend>
                    <div className="segmented-control">
                      <button
                        type="button"
                        aria-pressed={rsvp.roomAtHyatt === true}
                        data-ripple
                        className={
                          rsvp.roomAtHyatt === true ? "is-selected" : ""
                        }
                        onClick={() => {
                          update("roomAtHyatt", true);
                        }}
                      >
                        Yes, please
                      </button>
                      <button
                        type="button"
                        aria-pressed={rsvp.roomAtHyatt === false}
                        data-ripple
                        className={
                          rsvp.roomAtHyatt === false ? "is-selected" : ""
                        }
                        onClick={() => {
                          update("roomAtHyatt", false);
                          update("bedPreference", null);
                          update("nights", null);
                        }}
                      >
                        No, thank you
                      </button>
                    </div>
                  </fieldset>
                ) : null}
                {rsvp.roomAtHyatt === true && pendingTravelQuestion ? (
                  <div className="slide-open">
                    {pendingTravelQuestion === "bed" ? (
                      <fieldset data-travel-question="bed">
                        <legend className="visually-hidden">
                          Which room would you prefer?
                        </legend>
                        <div className="segmented-control">
                          <button
                            type="button"
                            aria-pressed={rsvp.bedPreference === "King"}
                            data-ripple
                            className={
                              rsvp.bedPreference === "King" ? "is-selected" : ""
                            }
                            onClick={() => {
                              update("bedPreference", "King");
                            }}
                          >
                            One king
                          </button>
                          <button
                            type="button"
                            aria-pressed={rsvp.bedPreference === "Twin"}
                            data-ripple
                            className={
                              rsvp.bedPreference === "Twin" ? "is-selected" : ""
                            }
                            onClick={() => {
                              update("bedPreference", "Twin");
                            }}
                          >
                            Two singles
                          </button>
                        </div>
                      </fieldset>
                    ) : null}
                    {pendingTravelQuestion === "nights" ? (
                      <fieldset data-travel-question="nights">
                        <legend className="visually-hidden">
                          How long will you stay?
                        </legend>
                        <div className="segmented-control">
                          {[1, 2, 3].map((count) => (
                            <button
                              key={count}
                              type="button"
                              aria-pressed={rsvp.nights === count}
                              data-ripple
                              className={
                                rsvp.nights === count ? "is-selected" : ""
                              }
                              onClick={() => {
                                update("nights", count);
                              }}
                            >
                              {count} {count === 1 ? "night" : "nights"}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    ) : null}
                    {pendingTravelQuestion === "arrival" ? (
                      <label
                        className="full-field"
                        data-travel-question="arrival"
                      >
                        <span className="visually-hidden">
                          When will you arrive?
                        </span>
                        <input
                          type="date"
                          value={rsvp.arrivalDate}
                          onChange={(event) =>
                            update("arrivalDate", event.target.value)
                          }
                        />
                      </label>
                    ) : null}
                    {pendingTravelQuestion === "arrival" ? (
                      <p className="help-note">
                        We will pass this to the hotel and be in touch. Nothing
                        is charged here.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {rsvp.roomAtHyatt === false ? (
                  <div className="slide-open">
                    <p className="field-hint">
                      A few nearby options, if you prefer to stay elsewhere.
                    </p>
                    <NearbyHotelList />
                  </div>
                ) : null}
              </div>
            ) : null}
            {travelComplete ? (
              <label className="full-field accessibility-field">
                <span>Is there anything we can arrange for you?</span>
                <input
                  value={rsvp.accessibilityNote}
                  onChange={(event) =>
                    update("accessibilityNote", event.target.value)
                  }
                  placeholder="Step-free access, seating close to the door…"
                  maxLength={800}
                />
              </label>
            ) : null}
            {error && activeSection === "travel" ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {renderCustomPages("travel")}

      {stepHas("recommendations") &&
      flyingIn &&
      !hiddenScenes.has("recommendations") ? (
        <section
          id="recommendations"
          data-sky="dream-2"
          style={textStyle("recommendations")}
          className={`scene scene--recommendations${openGuide ? ` guide-tone--${openGuide}` : ""}`}
          data-scene
          data-cinematic="kl"
          data-ripple-zone
        >
          <div className="kl-arrival-wash" aria-hidden="true" />
          <div className="scene-content reveal">
            <p className="step-label">Kuala Lumpur</p>
            <h2 className="script-heading script-heading--section">
              A few places we love
            </h2>
            <p className="section-intro">When you are in town.</p>
            <div className="guide editorial-guide">
              {guideCategories.map((category) => {
                const isOpen = openGuide === category.id;
                return (
                  <div
                    className={`guide-group editorial-guide__section${isOpen ? " is-open" : ""}`}
                    key={category.id}
                  >
                    <button
                      type="button"
                      className="editorial-guide__heading"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenGuide((current) =>
                          current === category.id ? null : category.id,
                        )
                      }
                    >
                      <span>{category.title}</span>
                      <i aria-hidden="true">{isOpen ? "−" : "+"}</i>
                    </button>
                    {isOpen && "apps" in category ? (
                      <ul>
                        {category.apps.map((app) => (
                          <li key={app.name}>
                            <div className="guide-app">
                              <strong>{app.name}</strong>
                              <span>{app.note}</span>
                              <span className="app-links">
                                <a
                                  href={app.ios}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  App Store ↗
                                </a>
                                <a
                                  href={app.android}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Google Play ↗
                                </a>
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {isOpen && "places" in category ? (
                      <ul>
                        {category.places.map((place) => (
                          <li key={place.name}>
                            <a
                              href={maps(place.name)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <strong>{place.name}</strong>
                              <span>{place.note}</span>
                              <em>
                                {place.detail} <b aria-hidden="true">↗</b>
                              </em>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
      {renderCustomPages("recommendations")}

      {stepHas("venue") && travelComplete && !hiddenScenes.has("venue") ? (
        <section
          id="venue"
          data-sky="dream-3"
          style={textStyle("venue")}
          className="scene scene--venue"
          data-scene
          data-cinematic="salon"
          data-ripple-zone
        >
          <div className="scene-content venue-card reveal">
            <div className="venue-arrival-stage">
              <div className="venue-arrival-anchor">
                <p className="step-label">Getting there</p>
                <h2 className="script-heading script-heading--section">
                  {content.venueName}
                </h2>
              </div>
            </div>
            <div className="venue-practical">
              <p className="venue-address">
                {content.venueAddress.split("\n").map((line, index) => (
                  <span key={line}>
                    {index ? <br /> : null}
                    {line}
                  </span>
                ))}
              </p>
              <p className="help-note venue-note">
                Take the lift or escalator up from the lobby.
              </p>
              <div className="arrival-grid">
                <article>
                  <h3>MRT</h3>
                  <p>
                    Take the Putrajaya Line to Conlay station. Leave via
                    Entrance A and follow Jalan Kia Peng towards the Convention
                    Centre. Grand Hyatt will be on your right.
                  </p>
                </article>
                <article>
                  <h3>Car</h3>
                  <p>
                    Make your way to the hotel entrance on Jalan Pinang, where
                    the doormen will greet you. Guest parking is in the
                    hotel&rsquo;s basement.
                  </p>
                </article>
                <article>
                  <h3>Grab</h3>
                  <p>
                    Set your destination to Grand Hyatt Kuala Lumpur and ask to
                    be dropped at the main lobby.
                  </p>
                </article>
              </div>
              <a
                className="primary-button map-button"
                href="https://www.google.com/maps/dir/?api=1&destination=Grand+Hyatt+Kuala+Lumpur,+12+Jalan+Pinang,+50450+Kuala+Lumpur"
                target="_blank"
                rel="noreferrer"
                data-ripple
              >
                Open directions <span aria-hidden="true">↗</span>
              </a>
              <div
                className="venue-map"
                aria-label="Map showing Grand Hyatt Kuala Lumpur"
              >
                <iframe
                  title="Google Map showing Grand Hyatt Kuala Lumpur"
                  src="https://www.google.com/maps?q=12%20Jalan%20Pinang%2C%2050450%20Kuala%20Lumpur&z=16&output=embed"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {renderCustomPages("venue")}

      {stepHas("wishes") && journeyDone && !hiddenScenes.has("wishes") ? (
        <section
          id="wishes"
          data-sky="dream-2"
          style={textStyle("wishes")}
          className="scene scene--wishes"
          data-scene
          data-cinematic="wishes"
        >
          <div className="scene-content wishes-card reveal">
            <p className="step-label">From the heart</p>
            <h2 className="script-heading script-heading--long">
              {content.wishesHeading}
            </h2>
            {personalised ? (
              <>
                <label className="full-field">
                  <span>Your message</span>
                  <textarea
                    value={rsvp.advice}
                    onChange={(event) => update("advice", event.target.value)}
                    placeholder="A wish, a memory or a little advice…"
                    rows={4}
                    maxLength={1000}
                  />
                </label>
                <p className="help-note">Your note will stay private.</p>
                {error && activeSection === "wishes" ? (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  className="primary-button"
                  type="button"
                  onClick={submitRsvp}
                  disabled={submitting || submitted}
                  data-ripple
                >
                  {submitting
                    ? "Sending…"
                    : submitted
                      ? "RSVP sent"
                      : "Send RSVP"}
                  {!submitting && !submitted ? (
                    <span aria-hidden="true">♡</span>
                  ) : null}
                </button>
                <small className="privacy-note">
                  {previewMode
                    ? "Preview only — no response or personal information will be saved."
                    : "Your details are used only to plan Elaine and Haykal’s celebration."}
                </small>
              </>
            ) : (
              <div className="invitation-only compact">
                <p>
                  Your personal invitation link unlocks the RSVP and wishes
                  form.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : null}
      {renderCustomPages("wishes")}

      {stepHas("confirmation") && submitted ? (
        <section
          id="confirmation"
          data-sky="dream-2"
          style={textStyle("confirmation")}
          className="scene scene--confirmation"
          data-scene
          data-cinematic="confirmation"
        >
          <div className="scene-content confirmation-card reveal">
            <div className="confirmation-pearls" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="wax-seal" aria-hidden="true">
              E<span>&amp;</span>H
            </div>
            <h2 className="script-heading script-heading--long confirmation-script-heading">
              Thank you,
              <br />
              {confirmationGuestName}.
            </h2>
            <p>
              {rsvp.attendance === "yes"
                ? confirmationCopy
                : "We shall miss you dearly on the night, and we are so grateful to carry your love with us from afar."}
            </p>
            {rsvp.attendance === "yes" ? (
              <EveningRecap guests={guestResponses} />
            ) : null}
            <RibbonDivider />
            <div className="confirmation-details">
              <span>7 November 2026</span>
              <span>The Grand Salon · Grand Hyatt Kuala Lumpur</span>
            </div>
            {rsvp.attendance === "yes" ? (
              <>
                <Countdown />
                <div className="confirmation-actions">
                  <a
                    className="calendar-button"
                    href="/elaine-haykal-wedding.ics"
                    download="elaine-haykal-wedding.ics"
                    data-ripple
                  >
                    Add to calendar <span aria-hidden="true">↓</span>
                  </a>
                </div>
              </>
            ) : null}
          </div>
        </section>
      ) : null}
      {stepHas("afterparty") &&
      ((inviteData?.afterPartyInvited && token && tablesAssigned) ||
        previewMode) ? (
        <section
          id="afterparty"
          data-sky="dream-2"
          style={textStyle("afterparty")}
          className="scene scene--afterparty"
          data-scene
        >
          <div className="scene-content reveal">
            <div className="afterparty-arch">
              <p className="step-label">After the last dance</p>
              <h2>The night continues</h2>
              <p className="section-intro">
                There is a little more to the evening waiting for you.
              </p>
              <a
                className="afterparty-enter"
                href={
                  previewMode
                    ? "/after-party?preview=1"
                    : `/after-party?token=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(`/i/${token}`)}`
                }
              >
                See the after-party details{" "}
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>
          </div>
        </section>
      ) : null}

      {stepHas("gallery") && journeyDone ? (
        <section
          id="gallery"
          data-sky="dream-2"
          style={textStyle("gallery")}
          className="scene scene--paper"
          data-scene
          data-cinematic="finale"
          data-ripple-zone
        >
          <div className="scene-content reveal">
            <h2 className="script-heading script-heading--section">
              Until then.
            </h2>
            <div className="photo-reveal-stage">
              <PhotoRail />
            </div>
            <p className="closing-line">See you in Kuala Lumpur.</p>
          </div>
        </section>
      ) : null}
      {stepHas("gallery") && journeyDone ? (
        <p className="return-to-start">
          <button type="button" onClick={() => goToSection("invitation")}>
            Back to the beginning ↑
          </button>
        </p>
      ) : null}
      {submitted ? renderCustomPages("confirmation") : null}
    </main>
  );
}
