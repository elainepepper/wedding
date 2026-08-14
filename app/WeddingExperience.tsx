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
import BubbleCursor from "./BubbleCursor";
import { EtherealLoader } from "./EtherealLoader";
import { SiteMenu } from "./SiteMenu";
import { LockedInvitation } from "./LockedInvitation";
import { readToken } from "./invite-token";
import { musicElement } from "./music";
import { PhotoRail } from "./PhotoRail";
import { DreamBackdrop } from "./DreamBackdrop";
import { removeBrokenImage } from "./image-fallback";

type Attendance = "yes" | "no" | null;
type Meal = "lamb" | "salmon" | null;
type InvitedGuest = {
  id: number;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  rsvp_status: string;
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
const ScrollOn = ({
  ready = true,
  hint,
  label = "Please continue below",
}: {
  ready?: boolean;
  hint?: string;
  label?: string;
}) =>
  ready ? (
    <p className="scroll-on">
      <i aria-hidden="true" /> {label}
    </p>
  ) : hint ? (
    <p className="gate-hint" role="status">
      {hint}
    </p>
  ) : null;
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
// "Mr & Mrs Lim". Any other pair of names keeps the plain "A & B" form.
function joinGuestNames(names: Array<string | null | undefined>) {
  const clean = names.map((name) => (name || "").trim()).filter(Boolean);
  if (clean.length === 2) {
    const titled = clean.map((name) => name.match(/^(Mr|Mrs)\.?\s+(.+)$/i));
    if (titled[0] && titled[1] && titled[0][2].toLowerCase() === titled[1][2].toLowerCase() && titled[0][1].toLowerCase() !== titled[1][1].toLowerCase()) {
      const surname = titled.find((match) => match![1].toLowerCase() === "mr")![2];
      return `Mr & Mrs ${surname}`;
    }
  }
  return clean.join(" & ");
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

function Sparkles() {
  return (
    <div className="sparkles" aria-hidden="true">
      <span className="sparkle sparkle--one">✦</span>
      <span className="sparkle sparkle--two">✧</span>
      <span className="sparkle sparkle--three">✦</span>
      <span className="sparkle sparkle--four">✧</span>
      <span className="orbit" />
    </div>
  );
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
    note: "A Kuala Lumpur favourite for nasi lemak, crisp chicken and fragrant coconut rice.",
    detail: "20 minutes by Grab",
    score: "Beloved local classic",
  },
  {
    name: "Super Kitchen Chilli Pan Mee",
    note: "Springy noodles, punchy chilli and a poached egg — stir everything together before the first bite.",
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
    note: "The famous night food street — satay, grilled seafood and noodles under the lanterns, from dusk till very late.",
    detail: "10 minutes by Grab",
    score: "Night-market institution",
  },
  {
    name: "Lot 10 Hutong",
    note: "Kuala Lumpur's legendary hawker names gathered in one food court beneath Lot 10.",
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
    note: "Four star and kinder on the purse, with generous family rooms.",
    walk: "20 minutes",
    score: "4.3 · 23,000 reviews",
  },
] as const;

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
  { time: "6:00pm", title: "Arrival, canapés and drinks" },
  { time: "7:00pm", title: "The celebration begins" },
] as const;

const WEDDING_START_UTC = "20261107T100000Z"; // 6:00pm in Kuala Lumpur
const WEDDING_END_UTC = "20261107T160000Z"; // midnight in Kuala Lumpur

function downloadCalendarInvite() {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Elaine & Haykal//Wedding//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:elaine-haykal-2026@haykalelaine.com",
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
    `DTSTART:${WEDDING_START_UTC}`,
    `DTEND:${WEDDING_END_UTC}`,
    "SUMMARY:Elaine & Haykal — Wedding Reception",
    "DESCRIPTION:Arrive from 6:00pm for drinks and canapés\\; the celebration begins at 7:00pm.",
    "LOCATION:The Grand Salon\\, Grand Hyatt Kuala Lumpur\\, 12 Jalan Pinang\\, 50450 Kuala Lumpur",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([ics], { type: "text/calendar;charset=utf-8" }),
  );
  link.download = "elaine-haykal-wedding.ics";
  link.click();
  URL.revokeObjectURL(link.href);
}

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

function EditableDecorationOverlay({
  design,
  activeScene,
}: {
  design: SiteDesign;
  activeScene: string;
}) {
  return (
    <div className="editable-decoration-overlay" aria-hidden="true">
      {design.decorations.map((item) => {
        const active = item.visible && item.scene === activeScene;
        // Pointer drift: depth-based parallax obeys the editor's master cursor
        // toggle; the "cursor" preset adds a stronger, per-element follow.
        const drift =
          (design.cursorMotion ? item.depth * 9 : 0) +
          (item.motion === "cursor" ? 26 * item.motionStrength : 0);
        const motionVars = {
          "--m-amp": `${(4 + item.motionStrength * 14).toFixed(1)}px`,
          "--m-deg": `${(1.5 + item.motionStrength * 5).toFixed(1)}deg`,
          "--m-dur": `${(11 - item.motionStrength * 6).toFixed(1)}s`,
        } as CSSProperties;
        return (
          <span
            key={item.id}
            className={`deco-wrap${active ? " is-active" : ""}`}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              width: `${item.width}%`,
              opacity: active ? item.opacity : 0,
              zIndex: item.depth + 4,
              transform: `translate3d(calc(-50% + var(--pointer-x) * ${drift}px), calc(-50% + var(--pointer-y) * ${drift * 0.7}px), 0) rotate(${item.rotation}deg)`,
            }}
          >
            <img
              src={item.src}
              alt=""
              className={
                item.motion !== "none" && item.motion !== "cursor"
                  ? `deco-anim deco-anim--${item.motion}`
                  : undefined
              }
              style={motionVars}
              onError={removeBrokenImage}
            />
          </span>
        );
      })}
    </div>
  );
}

function ChoiceButton({
  selected,
  title,
  detail,
  onClick,
}: {
  selected: boolean;
  title: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`choice-card${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="choice-mark">{selected ? "✓" : ""}</span>
      <strong>{title}</strong>
      {detail ? <small>{detail}</small> : null}
    </button>
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
  const [token, setToken] = useState(invitationToken ?? "");
  useEffect(() => {
    const resolved = readToken(invitationToken); // always runs, always remembers
    if (resolved) setToken(resolved);
  }, [invitationToken]);
  const personalised = Boolean(token) || previewMode;
  // Anyone arriving without their own invitation link meets the photograph
  // first. They may step past it and look around, but the RSVP stays closed.
  const [filmReady, setFilmReady] = useState(false);
  const [openGuide, setOpenGuide] = useState("");
  const [rsvp, setRsvp] = useState<RsvpState>(() =>
    previewMode
      ? { ...initialRsvp, guestName: "dear guest", phoneNumber: "12345678" }
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
            afterPartyInvited: false,
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
      if (!player.paused || player.currentTime > 0) { detach(); return; }
      player.play().then(detach).catch(() => undefined);
    };
    const detach = () => {
      events.forEach((name) => window.removeEventListener(name, start));
    };
    start();
    events.forEach((name) => window.addEventListener(name, start, { passive: true }));
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
          result.guests.map((guest) => guest.preferred_name || guest.first_name),
        );
        const phone = splitMobile(
          result.guests.find((guest) => guest.mobile)?.mobile || null,
        );
        setRsvp((current) => ({
          ...current,
          guestName: names || result.household.name,
          ...phone,
          accessibilityNote:
            result.guests
              .map((guest) => guest.accessibility || "")
              .find(Boolean) || current.accessibilityNote,
          wishes:
            result.guests.map((guest) => guest.wishes || "").find(Boolean) ||
            current.wishes,
          advice:
            result.guests
              .map((guest) => guest.marriage_advice || "")
              .find(Boolean) || current.advice,
          bedPreference:
            (result.guests
              .map((guest) => guest.bed_preference || "")
              .find(Boolean) as "King" | "Twin" | undefined) ??
            current.bedPreference,
          nights:
            result.guests
              .map((guest) => guest.room_nights)
              .find((value) => typeof value === "number") ?? current.nights,
        }));
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

  useEffect(() => {
    let frame = 0;
    let lastTime = performance.now();
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    const sceneProgress = new WeakMap<HTMLElement, number>();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const smoothstep = (edge0: number, edge1: number, value: number) => {
      const x = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
      return x * x * (3 - 2 * x);
    };
    const render = (time = performance.now()) => {
      frame = 0;
      const elapsed = Math.max(1, Math.min(50, time - lastTime));
      lastTime = time;
      const scrollAlpha = reduceMotion.matches
        ? 1
        : 1 - Math.pow(1 - siteDesign.motionDamping, elapsed / 16.667);
      const pointerAlpha = reduceMotion.matches
        ? 1
        : 1 - Math.pow(0.93, elapsed / 16.667);
      const viewport = window.innerHeight || 1;
      let sceneIsMoving = false;
      document
        .querySelectorAll<HTMLElement>("[data-scene]")
        .forEach((scene) => {
          const rect = scene.getBoundingClientRect();
          const scrollRange = Math.max(1, rect.height - viewport);
          const target =
            rect.height > viewport * 1.05
              ? Math.max(0, Math.min(1, -rect.top / scrollRange))
              : Math.max(
                  0,
                  Math.min(1, (viewport - rect.top) / (viewport + rect.height)),
                );
          const previous = sceneProgress.get(scene) ?? target;
          const progress = previous + (target - previous) * scrollAlpha;
          sceneProgress.set(scene, progress);
          scene.style.setProperty("--scene-progress", progress.toFixed(4));
          if (scene.id === "welcome") {
            scene.style.setProperty(
              "--welcome-intro",
              (1 - smoothstep(0.1, 0.3, progress)).toFixed(4),
            );
            scene.style.setProperty(
              "--welcome-names",
              (
                smoothstep(0.2, 0.38, progress) *
                (1 - smoothstep(0.53, 0.7, progress))
              ).toFixed(4),
            );
            scene.style.setProperty(
              "--welcome-date",
              smoothstep(0.6, 0.8, progress).toFixed(4),
            );
            scene.style.setProperty(
              "--welcome-portal",
              smoothstep(0.16, 0.88, progress).toFixed(4),
            );
          }
          if (Math.abs(target - progress) > 0.001) sceneIsMoving = true;
        });
      pointerX += (targetX - pointerX) * pointerAlpha;
      pointerY += (targetY - pointerY) * pointerAlpha;
      document.documentElement.style.setProperty(
        "--pointer-x",
        pointerX.toFixed(3),
      );
      document.documentElement.style.setProperty(
        "--pointer-y",
        pointerY.toFixed(3),
      );
      if (
        sceneIsMoving ||
        Math.abs(targetX - pointerX) > 0.002 ||
        Math.abs(targetY - pointerY) > 0.002
      )
        frame = requestAnimationFrame(render);
    };
    const requestRender = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;
      requestRender();
    };
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender);
    window.addEventListener("pointermove", pointer, { passive: true });
    requestRender();
    return () => {
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      window.removeEventListener("pointermove", pointer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rsvp.attendance, submitted, inviteLoading, siteDesign.motionDamping]);

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
  const rsvpComplete =
    personalised &&
    guestResponses.length > 0 &&
    guestResponses.every((guest) => guest.rsvpStatus !== "Pending") &&
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
        guest.rsvpStatus !== "Confirmed" || Boolean(guest.mealSelection),
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
  const attendingCount = guestResponses.filter(
    (guest) => guest.rsvpStatus === "Confirmed",
  ).length;

  // THE WIZARD — the journey as a handful of full-screen pages rather than
  // one long scroll. Each step shows one or two sections; Continue is enabled
  // by the same gates that used to unlock scrolling. All state, validation
  // and the backend remain untouched.
  const [step, setStep] = useState(0);
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
      { id: "reply", sections: ["rsvp"], ready: rsvpComplete, cta: "Continue" },
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
        cta: "Continue",
      });
    if (anyYes)
      steps.push({
        id: "meal",
        sections: ["meal"],
        ready: mealComplete,
        cta: "Continue",
      });
    if (anyYes && !hiddenScenes.has("travel"))
      steps.push({
        id: "travel",
        sections: ["travel"],
        ready: travelComplete,
        cta: "Continue",
      });
    if (flyingIn && !hiddenScenes.has("recommendations"))
      steps.push({
        id: "guide",
        sections: ["recommendations"],
        ready: true,
        cta: "Continue",
      });
    if (travelComplete && !hiddenScenes.has("venue"))
      steps.push({
        id: "venue",
        sections: ["venue"],
        ready: true,
        cta: "Continue",
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
  const stepIndex = Math.min(step, wizardSteps.length - 1);
  // If part of this page is still below the fold, carry the guest there
  // rather than turning the page out from under them.
  const advance = () => {
    const shell = document.querySelector<HTMLElement>(".wedding-shell");
    if (shell) {
      const questions = Array.from(
        shell.querySelectorAll<HTMLElement>(
          "[data-scene]:not([hidden]) fieldset, [data-scene]:not([hidden]) label",
        ),
      );
      const below = questions.find((element) => {
        const box = element.getBoundingClientRect();
        return box.top > window.innerHeight * 0.72;
      });
      if (below) {
        below.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    setStep((value) => Math.min(wizardSteps.length - 1, value + 1));
  };

  const goToSection = (id: string) => {
    // Steps now exist in the list only when their pages can render, so the
    // list itself is the authority. (The old check asked the document, but
    // with strict isolation other steps' pages are never in the document.)
    const index = wizardSteps.findIndex((entry) => entry.sections.includes(id));
    if (index < 0) return;
    setStep(index);
  };
  useEffect(() => {
    if (submitted) setStep(wizardSteps.length - 1);
  }, [submitted, wizardSteps.length]);
  // A last resort: if the current step somehow has nothing on it, step BACK
  // one page rather than to the very beginning. This used to reset the whole
  // journey to the invitation — a guest mid-form who tripped it lost their
  // place entirely. The step they were on is never reset by an answer or a
  // validation message; only a page with literally nothing to show retreats,
  // and only by one step at a time.
  useEffect(() => {
    if (inviteLoading || !personalised) return;
    const present = wizardSteps[stepIndex].sections.some((section) =>
      document.getElementById(section),
    );
    if (!present && stepIndex !== 0) {
      setStep((value) => Math.max(0, value - 1));
    }
  }, [stepIndex, wizardSteps, inviteLoading, personalised]);

  useEffect(() => {
    const active = new Set(wizardSteps[stepIndex].sections);
    const extras = new Set<string>();
    active.forEach((id) =>
      (customAfter.get(id) ?? []).forEach((page) => extras.add(page.id)),
    );
    // An answer can reveal or hide part of the page — a room offer, say. That
    // changes the page's height, and the browser shifts the scroll to
    // compensate, which reads as a jump. Hold the position across the change.
    const held = window.scrollY;
    document.querySelectorAll<HTMLElement>("[data-scene]").forEach((el) => {
      el.hidden = !(active.has(el.id) || extras.has(el.id));
    });
    if (
      shownStep.current === stepIndex &&
      Math.abs(window.scrollY - held) > 1
    ) {
      window.scrollTo({ top: held, behavior: "instant" as ScrollBehavior });
    }
  }, [stepIndex, wizardSteps, customAfter, submitted]);

  // Turning to a new page: only here does the view move. Keeping this apart
  // from the effect above is what stops the page jumping to the top each time
  // a guest taps an answer.
  const shownStep = useRef(-1);
  useEffect(() => {
    if (shownStep.current === stepIndex) return;
    const first = shownStep.current === -1;
    shownStep.current = stepIndex;
    const shell = document.querySelector<HTMLElement>(".wedding-shell");
    // The page leaves before the next one arrives, so the viewport never
    // shows a bare frame between steps.
    const arrive = () => {
      window.scrollTo(0, 0);
      if (shell) {
        shell.classList.remove("is-leaving", "step-enter");
        void shell.offsetWidth; // restart the animation
        shell.classList.add("step-enter");
      }
      window.dispatchEvent(new Event("scroll")); // wake the reveal tracker
    };
    if (first || !shell) {
      arrive();
      return;
    }
    shell.classList.add("is-leaving");
    const timer = window.setTimeout(arrive, 240);
    return () => window.clearTimeout(timer);
  }, [stepIndex]);
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
    if (travelComplete) ids.push("venue");
    if (flyingIn) ids.push("recommendations");
    if (journeyDone) ids.push("wishes");
    if (submitted) ids.push("confirmation");
    // The secret chapter stays sealed until the couple assigns a table —
    // it arrives with the follow-up link that carries the seat allocation.
    if (inviteData?.afterPartyInvited && tablesAssigned) ids.push("afterparty");
    if (journeyDone) ids.push("gallery");
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

  // STRICT VIEW ISOLATION — a page's markup exists only while the wizard is
  // on the step that shows it. Nothing from another step is in the document,
  // so no amount of scrolling can ever reach it. (The hidden-attribute pass
  // and its CSS remain as a second line of defence.)
  const stepHas = (id: string) =>
    wizardSteps[stepIndex].sections.includes(id);

  const renderCustomPages = (anchor: string) =>
    (stepHas(anchor) ? (customAfter.get(anchor) ?? []) : []).map((page) => (
      <section
        key={page.id}
        id={page.id}
        className="scene scene--custom"
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
      // actually cover them. Scrolling on every focus — a country-code menu,
      // say — made the page jump for no reason.
      if (
        !target ||
        !target.matches(
          "input:not([type='checkbox']):not([type='radio']), textarea",
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
    setRsvp((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const updateGuest = (id: number, patch: Partial<GuestResponse>) => {
    setGuestResponses((current) =>
      current.map((guest) =>
        guest.id === id ? { ...guest, ...patch } : guest,
      ),
    );
    setError("");
  };

  const submitRsvp = async () => {
    if (previewMode) {
      setSubmitted(true);
      window.setTimeout(() => goToSection("confirmation"), 80);
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
        (guest) => guest.rsvpStatus === "Confirmed" && !guest.mealSelection,
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
      if (rsvp.flyingIn && rsvp.roomAtHyatt === null) {
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
      const mobile = `${rsvp.countryCode}${localDigits}`;
      const firstConfirmedId = guestResponses.find(
        (guest) => guest.rsvpStatus === "Confirmed",
      )?.id;
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
        transportRequired: false,
        accessibility:
          guest.rsvpStatus === "Confirmed" ? rsvp.accessibilityNote : "",
        wishes: rsvp.wishes || guest.wishes,
        advice:
          guest.id === firstConfirmedId || guestResponses.length === 1
            ? rsvp.advice
            : "",
      }));
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, guests }),
      });
      const result = await readGuestResponse<{ ok?: boolean }>(
        response,
        "We couldn’t save your RSVP just now. Please try again in a moment — nothing has been lost.",
      );
      if (!response.ok)
        throw new Error(result.error || "Unable to save your RSVP.");
      setSubmitted(true);
      window.setTimeout(() => goToSection("confirmation"), 80);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We couldn’t save your RSVP. Please try again.",
      );
    } finally {
      setSubmitting(false);
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
  const typography = {
    "--font-header": selectedFont.headerFamily,
    "--font-body": selectedFont.bodyFamily,
  } as CSSProperties;

  return (
    <main
      className={`wedding-shell wedding-shell--storybook wizard ${designClasses}`}
      style={typography}
    >
      <DreamBackdrop />

      <EtherealLoader ready={filmReady} />
      {personalised && stepIndex > 0 ? (
        <SiteMenu
          links={[
            {
              label: "Your invitation",
              onSelect: () => goToSection("invitation"),
            },
            // these move between steps rather than jumping to anchors, which cannot
            // reach a section the wizard is currently holding hidden
            { label: "RSVP", onSelect: () => goToSection("rsvp") },
            ...(submitted
              ? [
                  {
                    label: "Confirmation page",
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
      <BubbleCursor zIndex={9998} />
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
            <small>{soundEnabled ? "Pause" : "Play music"}</small>
            {music.musicTitle ? <em>{music.musicTitle}</em> : null}
          </button>
        </>
      ) : null}
      {activeSection !== "welcome" ? (
        <>
          <div className="scroll-progress" aria-hidden="true">
            <i
              style={{
                height: `${((sectionIds.indexOf(activeSection) + 1) / sectionIds.length) * 100}%`,
              }}
            />
          </div>
          <nav className="scene-nav" aria-label="Your progress">
            {wizardSteps.slice(0, -1).map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                className={index === stepIndex ? "is-active" : ""}
                onClick={() => {
                  if (index <= stepIndex) setStep(index);
                }}
                aria-label={`Step ${index + 1} of ${wizardSteps.length - 1}`}
                aria-current={index === stepIndex ? "step" : undefined}
              >
                <span />
                <b>
                  {entry.cta === "Begin"
                    ? "The invitation"
                    : entry.id === "reply"
                      ? "Your reply"
                      : entry.id === "dress"
                        ? "Dress code"
                        : entry.id === "meal"
                          ? "Dinner"
                          : entry.id === "travel"
                            ? "Travel"
                            : entry.id === "guide"
                              ? "Kuala Lumpur"
                              : entry.id === "venue"
                                ? "The Grand Salon"
                                : "Wishes"}
                </b>
              </button>
            ))}
          </nav>
        </>
      ) : null}
      <EditableDecorationOverlay
        design={siteDesign}
        activeScene={activeSection}
      />

      {stepHas("invitation") ? (
      <section
        id="invitation"
        data-sky="dream-2"
        style={textStyle("invitation")}
        className="scene scene--invitation"
        data-scene
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
          <p className="invitation-line">{content.invitationLine}</p>
          <h2>
            {content.brideName} <span>&amp;</span> {content.groomName}
          </h2>
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
          <ScrollOn label="The evening unfolds below" />
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
            <ScrollOn />
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
            <h2>The evening unfolds</h2>
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
            {stepIndex === 0 ? (
              <button type="button" className="rsvp-trigger" onClick={advance}>
                RSVP
              </button>
            ) : (
              <ScrollOn />
            )}
          </div>
        </section>
      ) : null}
      {renderCustomPages("schedule")}

      {stepHas("rsvp") ? (
      <section
        id="rsvp"
        data-sky="dream-2"
        style={textStyle("rsvp")}
        className="scene scene--paper"
        data-scene
      >
        <img
          className="scene-art scene-art--dinner"
          src="/wedding/dinner-table.webp"
          alt="A hand-drawn wedding reception table"
          loading="lazy"
          onError={removeBrokenImage}
        />
        <div className="scene-content form-card reveal">
          <p className="step-label">01 · Your reply</p>
          <h2>Will you join us?</h2>
          {personalised ? (
            <>
              <p className="section-intro">
                Written for the names below. We are unable to welcome additional
                guests or children.
              </p>
              {rsvpDeadlineLabel(inviteData?.settings?.rsvp_deadline) ? (
                <p className="rsvp-deadline-note">
                  Kindly reply by{" "}
                  <strong>
                    {rsvpDeadlineLabel(inviteData?.settings?.rsvp_deadline)}
                  </strong>{" "}
                  — you may return to this link to update your reply any time
                  before then.
                </p>
              ) : null}
              <div className="party-rsvp-list">
                {guestResponses.map((guest) => (
                  <fieldset key={guest.id}>
                    {guestResponses.length > 1 ? (
                      <legend>{guest.name}</legend>
                    ) : (
                      <legend className="is-quiet">
                        Will you be joining us?
                      </legend>
                    )}
                    <div className="segmented-control">
                      <button
                        type="button"
                        className={
                          guest.rsvpStatus === "Confirmed" ? "is-selected" : ""
                        }
                        onClick={() =>
                          updateGuest(guest.id, {
                            rsvpStatus: "Confirmed",
                            receptionAttending: true,
                          })
                        }
                      >
                        Joyfully accept
                      </button>
                      <button
                        type="button"
                        className={
                          guest.rsvpStatus === "Declined" ? "is-selected" : ""
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
                        Regretfully decline
                      </button>
                    </div>
                  </fieldset>
                ))}
              </div>
              {someoneAttending ? (
                <>
                  <p className="help-note phone-note">
                    One number per household — whoever is easiest to reach on
                    WhatsApp.
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
                      <span>My WhatsApp number is</span>
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
                </>
              ) : null}
              {guestResponses.length > 1 ? (
                <p className="help-note couple-note">
                  You may each reply in your own right — if one of you can join
                  us and the other cannot, that is perfectly all right.
                </p>
              ) : null}
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
                find us — opens with that link. This is where the page ends for
                now.
              </p>
            </div>
          )}
          {error && activeSection === "rsvp" ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {personalised && guestResponses.length > 0 ? (
            <ScrollOn
              ready={rsvpComplete}
              hint={
                guestResponses.some((guest) => guest.rsvpStatus === "Pending")
                  ? "A reply is still awaited above."
                  : "Add a number we can reach you on."
              }
              label="Thank you — please continue below"
            />
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
        >
          <img
            className="scene-art scene-art--wide-frame"
            src="/wedding/frame-wide.webp"
            alt=""
            loading="lazy"
            aria-hidden="true"
            onError={removeBrokenImage}
          />
          <div className="scene-content dress-card reveal">
            <p className="step-label">02 · Dress code</p>
            <p className="script-kicker">{content.dressKicker}</p>
            <h2>{content.dressCode}</h2>
            <RibbonDivider />
            <p>{content.dressNote}</p>
            <p className="dress-restriction">{content.dressRestriction}</p>
            <ScrollOn label="Keep scrolling to choose your dinner" />
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
        >
          <img
            className="scene-art scene-art--feast"
            src="/wedding/feast-table.webp"
            alt="A hand-drawn candlelit wedding feast"
            loading="lazy"
            onError={removeBrokenImage}
          />
          <div className="scene-content form-card reveal">
            <p className="step-label">03 · At the table</p>
            <h2>Choose your main course</h2>
            <p className="section-intro">
              One happy decision before the dancing.
            </p>
            <div className="guest-meal-list">
              {guestResponses
                .filter((guest) => guest.rsvpStatus === "Confirmed")
                .map((guest) => (
                  <fieldset key={guest.id}>
                    {attendingCount > 1 ? <legend>{guest.name}</legend> : null}
                    <div className="choice-grid choice-grid--two meal-choices">
                      <ChoiceButton
                        selected={guest.mealSelection === "Salmon"}
                        title="Seared Alaskan salmon"
                        detail={salmonDescription}
                        onClick={() =>
                          updateGuest(guest.id, { mealSelection: "Salmon" })
                        }
                      />
                      <ChoiceButton
                        selected={guest.mealSelection === "Lamb"}
                        title="Almond dukkha-crusted lamb"
                        detail={lambDescription}
                        onClick={() =>
                          updateGuest(guest.id, { mealSelection: "Lamb" })
                        }
                      />
                    </div>
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
            <ScrollOn
              ready={mealComplete}
              hint="Choose a main course for everyone joining us."
            />
          </div>
        </section>
      ) : null}

      {renderCustomPages("meal")}
      {stepHas("travel") && mealComplete && !hiddenScenes.has("travel") ? (
        <section
          id="travel"
          data-sky="dream-2"
          style={textStyle("travel")}
          className="scene scene--pearl"
          data-scene
        >
          <img
            className="scene-art scene-art--pearl"
            src="/wedding/pearl-floral.webp"
            alt=""
            loading="lazy"
            aria-hidden="true"
            onError={removeBrokenImage}
          />
          <div className="scene-content form-card form-card--glass reveal">
            <p className="step-label">04 · Your journey</p>
            <h2>Coming from afar?</h2>
            <p className="section-intro">Only if you are travelling to us.</p>
            <fieldset>
              <legend>
                {attendingCount > 1 ? "We are flying in" : "I am flying in"}
              </legend>
              <div className="segmented-control">
                <button
                  type="button"
                  className={rsvp.flyingIn === true ? "is-selected" : ""}
                  onClick={() => update("flyingIn", true)}
                >
                  Yes
                </button>
                <button
                  type="button"
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
            {rsvp.flyingIn && roomBlockFull ? (
              <div className="slide-open travel-details">
                <p className="room-offer room-offer--full">
                  <strong>Our rooms at the Grand Hyatt are all taken</strong>
                  <span>
                    We are sorry — the last of the rooms we held has gone. A few
                    good places within a short walk are below, and the hotel
                    itself may still have rooms of its own.
                  </span>
                </p>
                <ul className="hotel-list">
                  {nearbyHotels.map((hotel) => (
                    <li key={hotel.name}>
                      <a
                        href={maps(`${hotel.name} Kuala Lumpur`)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <strong>{hotel.name}</strong>
                        <span>{hotel.note}</span>
                        <em className="place-score">★ {hotel.score}</em>
                        <i>{hotel.walk} away ↗</i>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : rsvp.flyingIn ? (
              <div className="slide-open travel-details">
                <p className="room-offer">
                  <strong>The Grand Room · RM850++ a night</strong>
                  <span>
                    A rate held for our guests at the Grand Hyatt, in the same
                    building as the celebration.
                  </span>
                </p>
                <fieldset>
                  <legend>A room at the Grand Hyatt</legend>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={rsvp.roomAtHyatt === true ? "is-selected" : ""}
                      onClick={() => update("roomAtHyatt", true)}
                    >
                      Yes, please
                    </button>
                    <button
                      type="button"
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
                {rsvp.roomAtHyatt === true ? (
                  <div className="slide-open">
                    <fieldset>
                      <legend>We would like</legend>
                      <div className="segmented-control">
                        <button
                          type="button"
                          className={
                            rsvp.bedPreference === "King" ? "is-selected" : ""
                          }
                          onClick={() => update("bedPreference", "King")}
                        >
                          One king
                        </button>
                        <button
                          type="button"
                          className={
                            rsvp.bedPreference === "Twin" ? "is-selected" : ""
                          }
                          onClick={() => update("bedPreference", "Twin")}
                        >
                          Two singles
                        </button>
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend>Staying for</legend>
                      <div className="segmented-control">
                        {[1, 2, 3].map((count) => (
                          <button
                            key={count}
                            type="button"
                            className={
                              rsvp.nights === count ? "is-selected" : ""
                            }
                            onClick={() => update("nights", count)}
                          >
                            {count} {count === 1 ? "night" : "nights"}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <label className="full-field">
                      <span>We arrive on</span>
                      <input
                        type="date"
                        value={rsvp.arrivalDate}
                        onChange={(event) =>
                          update("arrivalDate", event.target.value)
                        }
                      />
                    </label>
                    <p className="help-note">
                      We will pass this to the hotel and be in touch. Nothing is
                      charged here.
                    </p>
                  </div>
                ) : null}
                {rsvp.roomAtHyatt === false ? (
                  <div className="slide-open">
                    <p className="help-note">
                      A few good places within a short walk, should you still be
                      deciding.
                    </p>
                    <ul className="hotel-list">
                      {nearbyHotels.map((hotel) => (
                        <li key={hotel.name}>
                          <a
                            href={maps(`${hotel.name} Kuala Lumpur`)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <strong>{hotel.name}</strong>
                            <span>{hotel.note}</span>
                            <em className="place-score">★ {hotel.score}</em>
                            <i>{hotel.walk} away ↗</i>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            <label className="full-field">
              <span>It would help us if</span>
              <input
                value={rsvp.accessibilityNote}
                onChange={(event) =>
                  update("accessibilityNote", event.target.value)
                }
                placeholder="Step-free access, seating close to the door…"
                maxLength={800}
              />
            </label>
            {error && activeSection === "travel" ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <ScrollOn
              ready={travelComplete}
              hint={
                rsvp.flyingIn === null
                  ? "Answer the question above to continue."
                  : rsvp.roomAtHyatt === null
                    ? "Let us know about a room to continue."
                    : "A few details above are still to be filled in."
              }
            />
          </div>
        </section>
      ) : null}

      {renderCustomPages("travel")}

      {stepHas("venue") && travelComplete && !hiddenScenes.has("venue") ? (
        <section
          id="venue"
          data-sky="dream-3"
          style={textStyle("venue")}
          className="scene scene--venue"
          data-scene
        >
          <div className="scene-content venue-card reveal">
            <p className="step-label">Finding your way to us</p>
            <h2>{content.venueName}</h2>
            <p className="venue-address">
              {content.venueAddress.split("\n").map((line, index) => (
                <span key={line}>
                  {index ? <br /> : null}
                  {line}
                </span>
              ))}
            </p>
            <p className="help-note venue-note">
              The Grand Salon is on Level 1 — take the lift or escalator up from
              the lobby.
            </p>
            <div className="arrival-grid">
              <article>
                <span>01</span>
                <h3>By MRT</h3>
                <p>
                  Take the Putrajaya Line to Conlay station, leave by Entrance
                  A, and follow Jalan Kia Peng towards the Convention Centre —
                  the hotel appears on your right.
                </p>
              </article>
              <article>
                <span>02</span>
                <h3>By car</h3>
                <p>
                  Make your way to the hotel entrance on Jalan Pinang, where the
                  doormen will greet you. Guest parking sits in the hotel’s own
                  basement.
                </p>
              </article>
              <article>
                <span>03</span>
                <h3>By Grab</h3>
                <p>
                  Simply set your destination to “Grand Hyatt Kuala Lumpur” and
                  ask to be set down at the main lobby.
                </p>
              </article>
            </div>
            <a
              className="primary-button map-button"
              href="https://www.google.com/maps/dir/?api=1&destination=Grand+Hyatt+Kuala+Lumpur,+12+Jalan+Pinang,+50450+Kuala+Lumpur"
              target="_blank"
              rel="noreferrer"
            >
              Open directions <span aria-hidden="true">↗</span>
            </a>
            {/* The map closes the page: everyone reads the address and the
                three ways of arriving first, then sees where it all is. */}
            <div
              className="venue-map"
              aria-label="Map showing Grand Hyatt Kuala Lumpur"
            >
              <iframe
                title="Map to Grand Hyatt Kuala Lumpur"
                src="https://www.google.com/maps?q=Grand+Hyatt+Kuala+Lumpur,+12+Jalan+Pinang,+Kuala+Lumpur&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <ScrollOn />
          </div>
        </section>
      ) : null}
      {renderCustomPages("venue")}

      {stepHas("recommendations") &&
      flyingIn &&
      !hiddenScenes.has("recommendations") ? (
        <section
          id="recommendations"
          data-sky="dream-2"
          style={textStyle("recommendations")}
          className="scene scene--recommendations"
          data-scene
        >
          <div className="scene-content reveal">
            <p className="step-label">While you are here</p>
            <h2>Kuala Lumpur</h2>
            <p className="section-intro">
              Places within twenty minutes, and the apps worth having. Tap to
              open.
            </p>
            <div className="guide">
              {guideCategories.map((category) => {
                const open = openGuide === category.id;
                return (
                  <div
                    className={`guide-group${open ? " is-open" : ""}`}
                    key={category.id}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenGuide(open ? "" : category.id)}
                      aria-expanded={open}
                    >
                      <span>{category.title}</span>
                      <i aria-hidden="true">{open ? "−" : "+"}</i>
                    </button>
                    {"apps" in category ? (
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
                    {"places" in category ? (
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
                                {place.detail} · ★ {place.score}
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
            <ScrollOn />
          </div>
        </section>
      ) : null}
      {renderCustomPages("recommendations")}

      {stepHas("wishes") && journeyDone && !hiddenScenes.has("wishes") ? (
        <section
          id="wishes"
          data-sky="dream-2"
          style={textStyle("wishes")}
          className="scene scene--wishes"
          data-scene
        >
          <img
            className="scene-art scene-art--wishes-lace"
            src="/wedding/decor/lace-tape-white.webp"
            alt=""
            loading="lazy"
            aria-hidden="true"
            onError={removeBrokenImage}
          />
          <div className="scene-content wishes-card reveal">
            <p className="step-label">
              {rsvp.attendance === "yes" ? "05" : "02"} · From the heart
            </p>
            <p className="script-kicker">{content.wishesKicker}</p>
            <h2>{content.wishesHeading}</h2>
            {personalised ? (
              <>
                <label className="full-field">
                  <span>My wish for you both is</span>
                  <textarea
                    value={rsvp.wishes}
                    onChange={(event) => update("wishes", event.target.value)}
                    placeholder="A blessing, a memory, a line we can keep…"
                    rows={4}
                    maxLength={1000}
                  />
                </label>
                <p className="help-note">
                  We may share a few of these with everyone on the night.
                </p>
                <label className="full-field">
                  <span>And a little advice</span>
                  <textarea
                    value={rsvp.advice}
                    onChange={(event) => update("advice", event.target.value)}
                    placeholder="Something you have learned, or wish someone had told you…"
                    rows={4}
                    maxLength={1500}
                  />
                </label>
                <p className="help-note private-note">
                  Only Elaine and Haykal will ever read this one.
                </p>
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
                >
                  {submitting
                    ? "Sending with love…"
                    : submitted
                      ? "RSVP sent"
                      : previewMode
                        ? "Preview confirmation"
                        : "Send our RSVP"}
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
          data-sky="dream-3"
          style={textStyle("confirmation")}
          className="scene scene--confirmation"
          data-scene
        >
          <Sparkles />
          <div className="scene-content confirmation-card reveal">
            <p className="eyebrow">With all our hearts</p>
            <div className="wax-seal" aria-hidden="true">
              E<span>&amp;</span>H
            </div>
            <h2>
              Thank you,
              <br />
              {rsvp.guestName || "dear guest"}.
            </h2>
            <p>
              {rsvp.attendance === "yes"
                ? inviteData?.settings?.confirmation_message ||
                  "Your place at our table is saved. We can hardly wait to celebrate, feast and dance with you."
                : "We shall miss you dearly on the night, and we are so grateful to carry your love with us from afar."}
            </p>
            {rsvp.wishes.trim() ? (
              <blockquote className="shared-wish">
                <p>&ldquo;{rsvp.wishes.trim()}&rdquo;</p>
                <cite>your words, kept for the night</cite>
              </blockquote>
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
                  <button
                    className="calendar-button"
                    type="button"
                    onClick={downloadCalendarInvite}
                  >
                    Add to calendar <span aria-hidden="true">↓</span>
                  </button>
                  <a
                    className="calendar-button"
                    href="https://www.google.com/maps/dir/?api=1&destination=Grand+Hyatt+Kuala+Lumpur,+12+Jalan+Pinang,+50450+Kuala+Lumpur"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Directions <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </>
            ) : null}
          </div>
        </section>
      ) : null}
      {stepHas("afterparty") &&
      inviteData?.afterPartyInvited &&
      token &&
      tablesAssigned ? (
        <section
          id="afterparty"
          data-sky="dream-3"
          style={textStyle("afterparty")}
          className="scene scene--afterparty"
          data-scene
        >
          <div className="scene-content reveal">
            <div className="afterparty-arch">
              <p className="step-label">Only for a chosen few</p>
              <h2>A secret chapter</h2>
              <p className="section-intro">
                When the last dance is done, a few of you are invited to carry
                the night a little further.
              </p>
              <a
                className="afterparty-enter"
                href={`/after-party?token=${encodeURIComponent(token)}`}
              >
                Open your invitation
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
        >
          <div className="scene-content reveal">
            <p className="step-label">The two of us</p>
            <h2>Before we go</h2>
            <PhotoRail />
          </div>
        </section>
      ) : null}
      {stepHas("gallery") && journeyDone ? (
        <p className="return-to-start">
          <button type="button" onClick={() => goToSection("invitation")}>
            Return to the beginning ↑
          </button>
        </p>
      ) : null}
      {submitted ? renderCustomPages("confirmation") : null}
      {personalised && stepIndex > 0 ? (
        <div className="wizard-nav" aria-label="Continue">
          {stepIndex > 0 && !submitted ? (
            <button
              type="button"
              className="wizard-back"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {wizardSteps[stepIndex].cta ? (
            <button
              type="button"
              className="wizard-next"
              disabled={!wizardSteps[stepIndex].ready}
              onClick={advance}
            >
              {wizardSteps[stepIndex].cta === "Begin" ? "Begin" : "Next"}
            </button>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </main>
  );
}
