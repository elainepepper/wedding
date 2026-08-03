"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { defaultSiteDesign, fontPairs, normaliseSiteDesign, SiteDesign } from "../lib/site-design";
import { rsvpDeadlineLabel } from "../lib/rsvp-window";
import { StoryPrologue } from "./StoryPrologue";
import { Dreamscape } from "./Dreamscape";
import BubbleCursor from "./BubbleCursor";
import { TwirlLoader, TwirlDivider } from "./Twirl";
import { DreamBackdrop } from "./DreamBackdrop";

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
  settings: { rsvp_deadline?: string; confirmation_message?: string; music_url?: string | null; music_title?: string | null } | null;
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

const countryCodes = [
  ["Malaysia", "+60"],
  ["Australia", "+61"],
  ["Singapore", "+65"],
  ["Indonesia", "+62"],
  ["United Kingdom", "+44"],
  ["United States / Canada", "+1"],
  ["New Zealand", "+64"],
  ["Other", "+"],
] as const;

const salmonDescription = "Seared Alaskan salmon with Peruvian asparagus, heirloom baby carrot, avruga caviar, celeriac mash and citrus fennel beurre blanc.";
const lambDescription = "Almond dukkha-crusted lamb with potato pavé, smoked eggplant purée, tomato on vines confit and balsamic rosemary reduction.";
const checkOutDate = (checkIn: string, nights: number | null) => {
  if (!checkIn || !nights) return "";
  const date = new Date(`${checkIn}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + nights);
  return date.toISOString().slice(0, 10);
};
const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
const ScrollOn = ({ ready = true, hint, label = "Please continue below" }: { ready?: boolean; hint?: string; label?: string }) => ready
  ? <p className="scroll-on"><i aria-hidden="true" /> {label}</p>
  : hint ? <p className="gate-hint" role="status">{hint}</p> : null;
const sceneLabels: Record<string, string> = {
  welcome: "Our story", invitation: "The invitation", table: "Your table", schedule: "The evening", venue: "The Grand Salon", faq: "Good to know", rsvp: "Your reply", dress: "Dress code", meal: "Dinner", travel: "Your journey", airport: "From the airport", apps: "Before you fly", sightseeing: "Worth seeing", shopping: "Shopping", pamper: "Before the evening", recommendations: "Kuala Lumpur", wishes: "From the heart", confirmation: "Until November",
};

function splitMobile(mobile: string | null) {
  if (!mobile) return { countryCode: "+60", phoneNumber: "" };
  const compact = mobile.replace(/[\s()-]/g, "");
  const known = ["+60", "+61", "+65", "+62", "+44", "+64", "+1"].find((code) => compact.startsWith(code));
  return known ? { countryCode: known, phoneNumber: compact.slice(known.length) } : { countryCode: "+60", phoneNumber: compact.replace(/^\+/, "") };
}

function Sparkles() {
  return <div className="sparkles" aria-hidden="true"><span className="sparkle sparkle--one">✦</span><span className="sparkle sparkle--two">✧</span><span className="sparkle sparkle--three">✦</span><span className="sparkle sparkle--four">✧</span><span className="orbit" /></div>;
}

function RibbonDivider() {
  return <div className="ribbon-divider" aria-hidden="true"><span /><b>❦</b><span /></div>;
}

const maps = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const foodPlaces = [
  { name: "White & Black Kampong Kuala Lumpur", note: "Kampung cooking done beautifully — sambal petai, asam pedas, rendang.", detail: "10 minutes by Grab", score: "4.8 · 5,400 reviews" },
  { name: "Pokok KLCC Lot 91", note: "A leafy all-day place tucked beneath Permata Sapura.", detail: "5 minutes", score: "4.7 · 1,700 reviews" },
  { name: "The Oriental Park KLCC", note: "Tables beside the fountains. Ask to sit outside at dusk.", detail: "6 minutes", score: "4.5 · 920 reviews" },
  { name: "Cili Kampung Suria KLCC", note: "Honest Malay food inside Suria, and quick before the shops.", detail: "5 minutes", score: "4.4 · 1,400 reviews" },
] as const;

const nearbyHotels = [
  { name: "Four Seasons Hotel Kuala Lumpur", note: "Five star, beside the towers on Jalan Ampang.", walk: "8 minutes", score: "4.6 · 5,600 reviews" },
  { name: "Banyan Tree Kuala Lumpur", note: "Five star, rooms from the 54th floor on Jalan Conlay.", walk: "6 minutes", score: "4.7 · 2,900 reviews" },
  { name: "Grand Millennium Kuala Lumpur", note: "Five star, on Bukit Bintang beside Pavilion.", walk: "12 minutes", score: "4.5 · 8,800 reviews" },
  { name: "Pavilion Hotel Kuala Lumpur Managed By Banyan Tree", note: "Five star, attached to Pavilion itself.", walk: "12 minutes", score: "4.5 · 1,900 reviews" },
  { name: "Berjaya Times Square Hotel Kuala Lumpur", note: "Four star and kinder on the purse, with generous family rooms.", walk: "20 minutes", score: "4.3 · 23,000 reviews" },
] as const;

const pamperPlaces = [
  { name: "V Spa Bukit Bintang", note: "Calm rooms, gentle prices, open until late.", detail: "10 minutes", score: "4.8 · 780 reviews" },
  { name: "Health World Spa and Massage Bukit Bintang", note: "Deep tissue and foot massage, open very late indeed.", detail: "10 minutes", score: "4.7 · 670 reviews" },
  { name: "Thai Paradise Spa Kuala Lumpur", note: "Thai massage and aromatherapy, a few streets away.", detail: "5 minutes", score: "4.4 · 760 reviews" },
  { name: "Hair Quarters Pavilion Kuala Lumpur", note: "Wash, blow-dry and styling before the evening.", detail: "Pavilion, 12 minutes", score: "4.9 · 2,300 reviews" },
  { name: "Alice Hair Wonderland Pavilion Kuala Lumpur", note: "Cut and colour, much loved by regulars.", detail: "Pavilion, 12 minutes", score: "4.8 · 530 reviews" },
] as const;

const sightseeingPlaces = [
  { name: "Petronas Twin Towers", note: "The skybridge and the deck on the 86th floor. Book ahead.", detail: "5 minutes", score: "4.7 · 103,000 reviews" },
  { name: "KLCC Park Kuala Lumpur", note: "The park behind the towers. Come at dusk, when the fountains begin.", detail: "6 minutes", score: "4.6 · 63,000 reviews" },
  { name: "Aquaria KLCC", note: "A walk-through aquarium beneath the convention centre, next door.", detail: "3 minutes", score: "4.3 · 40,000 reviews" },
  { name: "Menara Kuala Lumpur KL Tower", note: "The one view the towers cannot give you — the towers themselves.", detail: "10 minutes", score: "4.5 · 42,000 reviews" },
  { name: "Islamic Arts Museum Malaysia", note: "Quiet, beautiful, and the loveliest small museum in the city.", detail: "15 minutes", score: "4.7 · 5,900 reviews" },
] as const;

const shoppingPlaces = [
  { name: "Suria KLCC", note: "At the foot of the towers. Everything, under one roof.", detail: "5 minutes", score: "4.6 · 75,000 reviews" },
  { name: "Pavilion Kuala Lumpur", note: "Reached by the covered walkway, without stepping into the sun.", detail: "12 minutes on foot", score: "4.6 · 63,000 reviews" },
  { name: "Central Market Kuala Lumpur", note: "Batik, pewter and craft — the place for something to carry home.", detail: "15 minutes by Grab", score: "4.3 · 61,000 reviews" },
  { name: "Isetan The Japan Store Kuala Lumpur", note: "Four floors of Japanese food, homeware and beauty at Lot 10.", detail: "15 minutes", score: "4.3 · 1,400 reviews" },
] as const;

const eveningMoments = [
  { time: "6:00pm", title: "Arrival", note: "The Grand Salon opens, with drinks and canapés." },
  { time: "6:45pm", title: "The celebration begins", note: "Please take your seats for the couple\u2019s entrance." },
  { time: "Then", title: "Dinner is served", note: "Your chosen main course, then something sweet." },
  { time: "Later", title: "Speeches & toasts", note: "A few words from those who love them best." },
  { time: "Until late", title: "Dancing", note: "Shoes made for dancing will earn their keep." },
] as const;

const faqEntries = [
  { question: "What time should we arrive?", answer: "Doors at 6:00pm for drinks and canapés. The celebration begins at 6:45pm." },
  { question: "Where do we park?", answer: "Beneath the hotel. The lift brings you straight to the lobby." },
  { question: "Will dietary needs be looked after?", answer: "Yes — whatever you note in your reply goes straight to the kitchen." },
  { question: "May we take photographs?", answer: "During the key moments, we would love your eyes rather than your screens. Our photographers have the rest." },
  { question: "What about gifts?", answer: "Your presence is the gift. A card box will be waiting, should you wish." },
] as const;

const WEDDING_START_UTC = "20261107T100000Z"; // 6:00pm in Kuala Lumpur
const WEDDING_END_UTC = "20261107T160000Z"; // midnight in Kuala Lumpur

function downloadCalendarInvite() {
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Elaine & Haykal//Wedding//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:elaine-haykal-2026@haykalelaine.com",
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART:${WEDDING_START_UTC}`,
    `DTEND:${WEDDING_END_UTC}`,
    "SUMMARY:Elaine & Haykal — Wedding Reception",
    "DESCRIPTION:Arrive from 6:00pm for drinks and canapés\\; the celebration begins at 6:45pm.",
    "LOCATION:The Grand Salon\\, Grand Hyatt Kuala Lumpur\\, 12 Jalan Pinang\\, 50450 Kuala Lumpur",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  link.download = "elaine-haykal-wedding.ics";
  link.click();
  URL.revokeObjectURL(link.href);
}

function Countdown() {
  const target = useMemo(() => new Date("2026-11-07T18:00:00+08:00").getTime(), []);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = target - now;
  if (remaining <= 0) return <p className="countdown-live">Today, we celebrate. ✦</p>;
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return <div className="countdown" role="timer" aria-label={`${days} days, ${hours} hours and ${minutes} minutes until the wedding`}>
    <div><strong>{days}</strong><span>days</span></div>
    <div><strong>{hours}</strong><span>hours</span></div>
    <div><strong>{minutes}</strong><span>minutes</span></div>
  </div>;
}

function EditableDecorationOverlay({ design, activeScene }: { design: SiteDesign; activeScene: string }) {
  return <div className="editable-decoration-overlay" aria-hidden="true">{design.decorations.map((item) => {
    const active = item.visible && item.scene === activeScene;
    // Pointer drift: depth-based parallax obeys the editor's master cursor
    // toggle; the "cursor" preset adds a stronger, per-element follow.
    const drift = (design.cursorMotion ? item.depth * 9 : 0) + (item.motion === "cursor" ? 26 * item.motionStrength : 0);
    const motionVars = {
      "--m-amp": `${(4 + item.motionStrength * 14).toFixed(1)}px`,
      "--m-deg": `${(1.5 + item.motionStrength * 5).toFixed(1)}deg`,
      "--m-dur": `${(11 - item.motionStrength * 6).toFixed(1)}s`,
    } as CSSProperties;
    return <span key={item.id} className={`deco-wrap${active ? " is-active" : ""}`} style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.width}%`, opacity: active ? item.opacity : 0, zIndex: item.depth + 4, transform: `translate3d(calc(-50% + var(--pointer-x) * ${drift}px), calc(-50% + var(--pointer-y) * ${drift * .7}px), 0) rotate(${item.rotation}deg)` }}>
      <img src={item.src} alt="" className={item.motion !== "none" && item.motion !== "cursor" ? `deco-anim deco-anim--${item.motion}` : undefined} style={motionVars} />
    </span>;
  })}</div>;
}

function ChoiceButton({ selected, title, detail, onClick }: { selected: boolean; title: string; detail?: string; onClick: () => void }) {
  return <button type="button" className={`choice-card${selected ? " is-selected" : ""}`} aria-pressed={selected} onClick={onClick}><span className="choice-mark">{selected ? "✓" : ""}</span><strong>{title}</strong>{detail ? <small>{detail}</small> : null}</button>;
}

export function WeddingExperience({ invitationToken, previewMode = false }: { invitationToken?: string; previewMode?: boolean }) {
  const personalised = Boolean(invitationToken) || previewMode;
  // Anyone arriving without their own invitation link meets the photograph
  // first. They may step past it and look around, but the RSVP stays closed.
  const [photoGate, setPhotoGate] = useState(!personalised);
  const [rsvp, setRsvp] = useState<RsvpState>(() => previewMode ? { ...initialRsvp, guestName: "dear guest", phoneNumber: "12345678" } : initialRsvp);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [guestResponses, setGuestResponses] = useState<GuestResponse[]>(() => previewMode ? [{ id: -1, name: "Your name", rsvpStatus: "Pending", ceremonyAttending: true, receptionAttending: true, afterPartyInvited: false, afterPartyAttending: "Pending", mealSelection: "", dietaryRequirements: "", allergies: "", accessibility: "", transportRequired: false, accommodationRequired: false, travelArrival: "", travelDeparture: "", accommodationName: "", bedPreference: "", roomNights: null, tableName: "", wishes: "", advice: "" }] : []);
  const [inviteLoading, setInviteLoading] = useState(Boolean(invitationToken));
  const [inviteError, setInviteError] = useState("");
  const [activeSection, setActiveSection] = useState("welcome");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [music, setMusic] = useState<MusicSettings>({ musicUrl: null, musicTitle: null });
  const [siteDesign, setSiteDesign] = useState<SiteDesign>(defaultSiteDesign);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site-settings", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<PublicSiteSettings> : { musicUrl: null, musicTitle: null, siteDesign: null })
      .then((result) => { if (!cancelled) { setMusic({ musicUrl: result.musicUrl, musicTitle: result.musicTitle }); setSiteDesign(normaliseSiteDesign(result.siteDesign)); } })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const toggleSound = async () => {
    const player = audioRef.current;
    if (!player) return;
    if (player.paused) {
      try { await player.play(); setSoundEnabled(true); } catch { setSoundEnabled(false); }
    } else {
      player.pause();
      setSoundEnabled(false);
    }
  };

  useEffect(() => {
    if (!invitationToken) return;
    let cancelled = false;
    fetch(`/api/invite/${encodeURIComponent(invitationToken)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as InviteData & { error?: string };
        if (!response.ok) throw new Error(result.error || "This invitation could not be opened.");
        return result;
      })
      .then((result) => {
        if (cancelled) return;
        setInviteData(result);
        const names = result.guests.map((guest) => guest.preferred_name || guest.first_name).join(" & ");
        const phone = splitMobile(result.guests.find((guest) => guest.mobile)?.mobile || null);
        setRsvp((current) => ({
          ...current,
          guestName: names || result.household.name,
          ...phone,
          accessibilityNote: result.guests.map((guest) => guest.accessibility || "").find(Boolean) || current.accessibilityNote,
          wishes: result.guests.map((guest) => guest.wishes || "").find(Boolean) || current.wishes,
          advice: result.guests.map((guest) => guest.marriage_advice || "").find(Boolean) || current.advice,
          bedPreference: (result.guests.map((guest) => guest.bed_preference || "").find(Boolean) as "King" | "Twin" | undefined) ?? current.bedPreference,
          nights: result.guests.map((guest) => guest.room_nights).find((value) => typeof value === "number") ?? current.nights,
        }));
        setGuestResponses(result.guests.map((guest) => ({
          id: guest.id,
          name: guest.preferred_name || `${guest.first_name} ${guest.last_name}`.trim(),
          rsvpStatus: guest.rsvp_status === "Confirmed" || guest.rsvp_status === "Declined" ? guest.rsvp_status : "Pending",
          ceremonyAttending: guest.ceremony_invited ? guest.rsvp_status !== "Declined" : false,
          receptionAttending: guest.reception_invited ? guest.rsvp_status !== "Declined" : false,
          afterPartyInvited: Boolean(guest.after_party_invited),
          afterPartyAttending: guest.after_party_attending === "Yes" || guest.after_party_attending === "No" ? guest.after_party_attending : "Pending",
          mealSelection: guest.meal_selection === "Lamb" || guest.meal_selection === "Salmon" ? guest.meal_selection : "",
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
          roomNights: typeof guest.room_nights === "number" ? guest.room_nights : null,
          wishes: guest.wishes || "",
          advice: guest.marriage_advice || "",
        })));
      })
      .catch((loadError) => { if (!cancelled) setInviteError(loadError instanceof Error ? loadError.message : "This invitation could not be opened."); })
      .finally(() => { if (!cancelled) setInviteLoading(false); });
    return () => { cancelled = true; };
  }, [invitationToken]);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"));
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        setActiveSection(entry.target.id);
      }
    }), { threshold: 0.36 });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [rsvp.attendance, submitted, inviteLoading]);

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
      const scrollAlpha = reduceMotion.matches ? 1 : 1 - Math.pow(1 - siteDesign.motionDamping, elapsed / 16.667);
      const pointerAlpha = reduceMotion.matches ? 1 : 1 - Math.pow(.93, elapsed / 16.667);
      const viewport = window.innerHeight || 1;
      let sceneIsMoving = false;
      document.querySelectorAll<HTMLElement>("[data-scene]").forEach((scene) => {
        const rect = scene.getBoundingClientRect();
        const scrollRange = Math.max(1, rect.height - viewport);
        const target = rect.height > viewport * 1.05
          ? Math.max(0, Math.min(1, -rect.top / scrollRange))
          : Math.max(0, Math.min(1, (viewport - rect.top) / (viewport + rect.height)));
        const previous = sceneProgress.get(scene) ?? target;
        const progress = previous + (target - previous) * scrollAlpha;
        sceneProgress.set(scene, progress);
        scene.style.setProperty("--scene-progress", progress.toFixed(4));
        if (scene.id === "welcome") {
          scene.style.setProperty("--welcome-intro", (1 - smoothstep(0.1, 0.3, progress)).toFixed(4));
          scene.style.setProperty("--welcome-names", (smoothstep(0.2, 0.38, progress) * (1 - smoothstep(0.53, 0.7, progress))).toFixed(4));
          scene.style.setProperty("--welcome-date", smoothstep(0.6, 0.8, progress).toFixed(4));
          scene.style.setProperty("--welcome-portal", smoothstep(0.16, 0.88, progress).toFixed(4));
        }
        if (Math.abs(target - progress) > 0.001) sceneIsMoving = true;
      });
      pointerX += (targetX - pointerX) * pointerAlpha;
      pointerY += (targetY - pointerY) * pointerAlpha;
      document.documentElement.style.setProperty("--pointer-x", pointerX.toFixed(3));
      document.documentElement.style.setProperty("--pointer-y", pointerY.toFixed(3));
      if (sceneIsMoving || Math.abs(targetX - pointerX) > 0.002 || Math.abs(targetY - pointerY) > 0.002) frame = requestAnimationFrame(render);
    };
    const requestRender = () => { if (!frame) frame = requestAnimationFrame(render); };
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

  const hiddenScenes = useMemo(() => new Set(siteDesign.hiddenScenes), [siteDesign.hiddenScenes]);
  const customAfter = useMemo(() => {
    const map = new Map<string, typeof siteDesign.customPages>();
    siteDesign.customPages.forEach((page) => map.set(page.afterScene, [...(map.get(page.afterScene) ?? []), page]));
    return map;
  }, [siteDesign.customPages]);
  const validPhone = () => rsvp.phoneNumber.replace(/\D/g, "").length >= 7;
  const rsvpComplete = personalised && guestResponses.length > 0 && guestResponses.every((guest) => guest.rsvpStatus !== "Pending") && validPhone();
  const anyYes = rsvpComplete && guestResponses.some((guest) => guest.rsvpStatus === "Confirmed");
  const allDeclined = rsvpComplete && !guestResponses.some((guest) => guest.rsvpStatus === "Confirmed");
  const mealComplete = anyYes && guestResponses.every((guest) => guest.rsvpStatus !== "Confirmed" || Boolean(guest.mealSelection));
  const roomComplete = rsvp.roomAtHyatt === true
    ? Boolean(rsvp.bedPreference) && Boolean(rsvp.nights) && Boolean(rsvp.arrivalDate)
    : rsvp.roomAtHyatt === false ? Boolean(rsvp.accommodation.trim()) : false;
  const travelComplete = mealComplete && (hiddenScenes.has("travel") || (rsvp.flyingIn === false || (rsvp.flyingIn === true && roomComplete)));
  const flyingIn = travelComplete && rsvp.flyingIn === true;
  const journeyDone = travelComplete || allDeclined;
  const attendingCount = guestResponses.filter((guest) => guest.rsvpStatus === "Confirmed").length;
  const seatedGuests = guestResponses.filter((guest) => guest.rsvpStatus === "Confirmed" && guest.tableName);
  const tablesAssigned = seatedGuests.length > 0;
  useEffect(() => {
    if (!rsvpComplete) return;
    const next = anyYes ? "yes" : "no";
    setRsvp((current) => current.attendance === next ? current : { ...current, attendance: next });
  }, [rsvpComplete, anyYes]);
  const sectionIds = useMemo(() => {
    const ids = ["welcome", "invitation", "schedule", "rsvp"];
    if (tablesAssigned) ids.splice(2, 0, "table");
    if (anyYes) ids.push("dress", "meal");
    if (mealComplete) ids.push("travel");
    if (flyingIn) ids.push("airport", "apps", "recommendations", "sightseeing", "shopping", "pamper");
    if (travelComplete) ids.push("venue", "faq");
    if (journeyDone) ids.push("wishes");
    if (submitted) ids.push("confirmation");
    // Editor-hidden chapters drop out; editor-added pages slide in after their anchor.
    return ids.flatMap((id) => [...(hiddenScenes.has(id) ? [] : [id]), ...(customAfter.get(id) ?? []).map((page) => page.id)]);
  }, [anyYes, mealComplete, travelComplete, flyingIn, journeyDone, submitted, tablesAssigned, hiddenScenes, customAfter]);
  const chapterLabels = useMemo(() => ({ ...sceneLabels, ...Object.fromEntries(siteDesign.customPages.map((page) => [page.id, page.title])) }), [siteDesign.customPages]);
  // Text placement and size, as arranged in the website editor.
  const textStyle = (scene: string): CSSProperties => {
    const layout = siteDesign.textLayout?.[scene];
    if (!layout) return {};
    return { "--text-x": `${layout.x}%`, "--text-y": `${layout.y}%`, "--text-size": layout.size } as CSSProperties;
  };

  const renderCustomPages = (anchor: string) => (customAfter.get(anchor) ?? []).map((page) => (
    <section key={page.id} id={page.id} className="scene scene--custom" data-scene aria-label={page.title}>
      <div className="scene-content custom-page-card reveal">
        {page.kicker ? <p className="eyebrow">{page.kicker}</p> : null}
        <h2>{page.title}</h2>
        {page.body.split(/\n+/).filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}
      </div>
    </section>
  ));
  const activeIndex = Math.max(0, sectionIds.indexOf(activeSection));
  const moveChapter = (direction: -1 | 1) => {
    const target = sectionIds[Math.max(0, Math.min(sectionIds.length - 1, activeIndex + direction))];
    if (target) scrollToSection(target);
  };

  // Let the couple see who now knows where they are sitting.
  useEffect(() => {
    if (!tablesAssigned || !invitationToken || previewMode) return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/invite/${encodeURIComponent(invitationToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tableSeen" }),
      }).catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [tablesAssigned, invitationToken, previewMode]);

  useEffect(() => {
    if (!photoGate) return;
    // Locking body alone is not enough — Safari keeps scrolling the root
    // element, so both are held while the photograph is up.
    const previousBody = document.body.style.overflow;
    const previousRoot = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = previousBody;
      document.documentElement.style.overflow = previousRoot;
    };
  }, [photoGate]);

  const update = <K extends keyof RsvpState>(key: K, value: RsvpState[K]) => {
    setRsvp((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const updateGuest = (id: number, patch: Partial<GuestResponse>) => {
    setGuestResponses((current) => current.map((guest) => guest.id === id ? { ...guest, ...patch } : guest));
    setError("");
  };

  const submitRsvp = async () => {
    if (previewMode) {
      setSubmitted(true);
      window.setTimeout(() => scrollToSection("confirmation"), 80);
      return;
    }
    if (!invitationToken) {
      setError("Replies may only be sent through your own invitation link.");
      scrollToSection("rsvp");
      return;
    }
    if (!validPhone()) {
      setError("A number to reach you on, and your reply is ready to send.");
      scrollToSection("rsvp");
      return;
    }
    if (guestResponses.some((guest) => guest.rsvpStatus === "Pending")) {
      setError("A reply is still awaited for one of the names above.");
      scrollToSection("rsvp");
      return;
    }
    if (guestResponses.some((guest) => guest.rsvpStatus === "Confirmed" && !guest.mealSelection)) {
      setError("A main course is still to be chosen for someone joining us.");
      scrollToSection("meal");
      return;
    }
    if (rsvp.attendance === "yes" && !hiddenScenes.has("travel")) {
      if (rsvp.flyingIn === null) {
        setError("Do let us know whether anyone in your party is flying in.");
        scrollToSection("travel");
        return;
      }
      if (rsvp.flyingIn && rsvp.roomAtHyatt === null) {
        setError("Do let us know whether a room at the Grand Hyatt would help.");
        scrollToSection("travel");
        return;
      }
      if (rsvp.flyingIn && (!rsvp.arrivalDate || !rsvp.departureDate)) {
        setError("Your arrival and departure dates, whenever you know them.");
        scrollToSection("travel");
        return;
      }
      if (rsvp.flyingIn && rsvp.roomAtHyatt === false && !rsvp.accommodation.trim()) {
        setError("Do tell us where you will be staying.");
        scrollToSection("travel");
        return;
      }
    }
    setSubmitting(true);
    setError("");
    try {
      const mobile = `${rsvp.countryCode}${rsvp.phoneNumber.replace(/\D/g, "")}`;
      const firstConfirmedId = guestResponses.find((guest) => guest.rsvpStatus === "Confirmed")?.id;
      const guests = guestResponses.map((guest) => ({
        ...guest,
        ceremonyAttending: guest.rsvpStatus === "Confirmed" && guest.ceremonyAttending,
        receptionAttending: guest.rsvpStatus === "Confirmed" && guest.receptionAttending,
        travelArrival: guest.rsvpStatus === "Confirmed" ? rsvp.arrivalDate : "",
        travelDeparture: guest.rsvpStatus === "Confirmed" ? checkOutDate(rsvp.arrivalDate, rsvp.nights) : "",
        bedPreference: guest.rsvpStatus === "Confirmed" && rsvp.roomAtHyatt === true ? (rsvp.bedPreference ?? "") : "",
        roomNights: guest.rsvpStatus === "Confirmed" && rsvp.roomAtHyatt === true ? rsvp.nights : null,
        accommodationRequired: guest.rsvpStatus === "Confirmed" && rsvp.roomAtHyatt === true,
        accommodationName: guest.rsvpStatus === "Confirmed" && rsvp.roomAtHyatt === false ? rsvp.accommodation : "",
        transportRequired: false,
        accessibility: guest.rsvpStatus === "Confirmed" ? rsvp.accessibilityNote : "",
        wishes: rsvp.wishes || guest.wishes,
        advice: guest.id === firstConfirmedId || guestResponses.length === 1 ? rsvp.advice : "",
      }));
      const response = await fetch(`/api/invite/${encodeURIComponent(invitationToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, guests }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save your RSVP.");
      setSubmitted(true);
      window.setTimeout(() => scrollToSection("confirmation"), 80);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "We couldn’t save your RSVP. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (inviteLoading) return <main className="invitation-loading"><div className="wax-seal">E<span>&amp;</span>H</div><p>Unfolding your invitation…</p><i /></main>;
  if (inviteError) return <main className="invitation-invalid"><span>✦</span><h1>This invitation is resting.</h1><p>{inviteError}</p><a href="/">Return to Elaine &amp; Haykal</a></main>;

  const content = siteDesign.content;
  const designClasses = siteDesign.hiddenBuiltIns.map((id) => `hide-${id}`).join(" ");
  const selectedFont = fontPairs.find((pair) => pair.id === siteDesign.fontPair) ?? fontPairs[0];
  const typography = { "--font-header": selectedFont.headerFamily, "--font-body": selectedFont.bodyFamily } as CSSProperties;

  return <main className={`wedding-shell wedding-shell--storybook ${designClasses}${photoGate ? " is-gated" : ""}`} style={typography}>
    <DreamBackdrop />
    {photoGate ? <div className="photo-gate" role="dialog" aria-label="Elaine and Haykal" onClick={() => setPhotoGate(false)} onWheel={() => setPhotoGate(false)} onTouchMove={() => setPhotoGate(false)}>
      <picture>
        <source media="(max-width: 640px)" srcSet="/wedding/hero-portrait-small.webp" />
        <img src="/wedding/hero-portrait.webp" alt="Elaine and Haykal, forehead to forehead" fetchPriority="high" />
      </picture>
      <div className="photo-gate-veil" aria-hidden="true" />
      <div className="photo-gate-words">
        <p className="overline">{content.eventDate}</p>
        <h1>{content.brideName}<span>&amp;</span>{content.groomName}</h1>
        <p className="line">{content.venueName}</p>
      </div>
      <button type="button" className="photo-gate-enter" onClick={() => setPhotoGate(false)}>
        Look inside <span aria-hidden="true">↓</span>
      </button>
      <p className="photo-gate-note">Replies are by personal invitation only.</p>
    </div> : null}
    <TwirlLoader />
    <Dreamscape />
    <BubbleCursor zIndex={95} />
    <a className="skip-experience" href="#rsvp">Skip our story and go to the RSVP</a>
    {music.musicUrl ? <><audio ref={audioRef} src={music.musicUrl} loop preload="none" onPause={() => setSoundEnabled(false)} onPlay={() => setSoundEnabled(true)} /><button type="button" className="sound-control" onClick={toggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? "Pause wedding music" : "Play wedding music"}><span aria-hidden="true">{soundEnabled ? "❚❚" : "♪"}</span><small>{soundEnabled ? "Pause" : "Play music"}</small>{music.musicTitle ? <em>{music.musicTitle}</em> : null}</button></> : null}
    {activeSection !== "welcome" ? <>
      <div className="scroll-progress" aria-hidden="true"><i style={{ height: `${((sectionIds.indexOf(activeSection) + 1) / sectionIds.length) * 100}%` }} /></div>
      <nav className="scene-nav" aria-label="Invitation sections">{sectionIds.map((id) => <button key={id} type="button" className={activeSection === id ? "is-active" : ""} onClick={() => scrollToSection(id)} aria-label={`Go to ${chapterLabels[id] || id}`} aria-current={activeSection === id ? "step" : undefined}><span /><b>{chapterLabels[id] || id}</b></button>)}</nav>
      <aside className="mobile-chapter-dock" aria-label="Invitation chapter controls"><button type="button" onClick={() => moveChapter(-1)} disabled={activeIndex === 0} aria-label="Previous chapter">←</button><div><small>{String(activeIndex + 1).padStart(2, "0")} / {String(sectionIds.length).padStart(2, "0")}</small><strong>{chapterLabels[activeSection] || activeSection}</strong><i><span style={{ width: `${((activeIndex + 1) / sectionIds.length) * 100}%` }} /></i></div><button type="button" onClick={() => moveChapter(1)} disabled={activeIndex === sectionIds.length - 1} aria-label="Next chapter">→</button></aside>
    </> : null}
    <EditableDecorationOverlay design={siteDesign} activeScene={activeSection} />

    <section id="welcome" style={textStyle("welcome")} className="scene scene--story is-visible" data-scene aria-label="Elaine and Haykal’s story">
      <StoryPrologue guestName={rsvp.guestName} onEnter={() => scrollToSection("invitation")} />
    </section>

    <TwirlDivider />
    {renderCustomPages("welcome")}
    <section id="invitation" data-sky="dream-2" style={textStyle("invitation")} className="scene scene--invitation" data-scene>
      <img className="scene-art scene-art--floral" src="/wedding/floral-frame.webp" alt="" loading="lazy" aria-hidden="true" />
      <img className="scene-art floating-bloom floating-bloom--left" src="/wedding/pearl-floral.webp" alt="" loading="lazy" aria-hidden="true" />
      <img className="scene-art floating-bloom floating-bloom--right" src="/wedding/pearl-floral.webp" alt="" loading="lazy" aria-hidden="true" />
      <div className="scene-content invitation-card reveal">
        <p className="eyebrow">{content.familyLine}</p>
        <p className="invitation-line">{content.invitationLine}</p>
        <h2>{content.brideName} <span>&amp;</span> {content.groomName}</h2>
        <RibbonDivider />
        <div className="event-details"><p><strong>Saturday</strong><span>{content.eventDate}</span></p><p><strong>{content.eventTime.replace(/pm$/i, "")}</strong><span>in the evening</span></p><p><strong>{content.venueName}</strong><span>Grand Hyatt Kuala Lumpur</span></p></div>
        <ScrollOn label="The evening unfolds below" />
      </div>
    </section>

    {tablesAssigned ? <section id="table" data-sky="dream-3" style={textStyle("table")} className="scene scene--blush" data-scene>
      <div className="scene-content table-card reveal">
        <p className="step-label">On the night</p>
        <h2>{seatedGuests.length > 1 ? "Your tables" : "Your table"}</h2>
        <p className="section-intro">Come straight up to The Grand Salon — someone will show you the rest.</p>
        <div className="table-plaques">{seatedGuests.map((guest) => <article key={guest.id}><span>{guest.name}</span><strong>{guest.tableName}</strong></article>)}</div>
        <ScrollOn />
      </div>
    </section> : null}
    {renderCustomPages("table")}

    {renderCustomPages("invitation")}
    {!hiddenScenes.has("schedule") ? <section id="schedule" data-sky="dream-1" style={textStyle("schedule")} className="scene scene--schedule" data-scene>
      <img className="scene-art scene-art--schedule" src="/wedding/frame-tall.webp" alt="" loading="lazy" aria-hidden="true" />
      <div className="scene-content schedule-card reveal">
        <p className="step-label">The programme</p>
        <h2>The evening unfolds</h2>
        <p className="section-intro">From the first hello to the last dance.</p>
        <ol className="evening-timeline">
          {eveningMoments.map((moment, index) => <li key={moment.title} style={{ "--stagger": `${index * 150}ms` } as CSSProperties}>
            <span className="timeline-time">{moment.time}</span>
            <div><h3>{moment.title}</h3><p>{moment.note}</p></div>
          </li>)}
        </ol>
        <ScrollOn />
      </div>
    </section> : null}
    {renderCustomPages("schedule")}

    <section id="rsvp" data-sky="dream-2" style={textStyle("rsvp")} className="scene scene--paper" data-scene><img className="scene-art scene-art--dinner" src="/wedding/dinner-table.webp" alt="A hand-drawn wedding reception table" loading="lazy" /><div className="scene-content form-card reveal"><p className="step-label">01 · Your reply</p><h2>Will you join us?</h2>{personalised ? <><p className="section-intro">Written for the names below. We are unable to welcome additional guests or children.</p>{rsvpDeadlineLabel(inviteData?.settings?.rsvp_deadline) ? <p className="rsvp-deadline-note">Kindly reply by <strong>{rsvpDeadlineLabel(inviteData?.settings?.rsvp_deadline)}</strong> — you may return to this link to update your reply any time before then.</p> : null}<p className="help-note phone-note">One number per household — whoever is easiest to reach.</p><div className="field-grid phone-grid"><label><span>Country code</span><select value={rsvp.countryCode} onChange={(event) => update("countryCode", event.target.value)} aria-label="Country calling code">{countryCodes.map(([country, code]) => <option key={`${country}-${code}`} value={code}>{country} ({code})</option>)}</select></label><label><span>Mobile number</span><input required value={rsvp.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value)} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="12 345 6789" maxLength={24} /></label></div><div className="party-rsvp-list">{guestResponses.map((guest) => <fieldset key={guest.id}><legend>{guest.name}</legend><div className="segmented-control"><button type="button" className={guest.rsvpStatus === "Confirmed" ? "is-selected" : ""} onClick={() => updateGuest(guest.id, { rsvpStatus: "Confirmed", receptionAttending: true })}>Joyfully accepts</button><button type="button" className={guest.rsvpStatus === "Declined" ? "is-selected" : ""} onClick={() => updateGuest(guest.id, { rsvpStatus: "Declined", receptionAttending: false, ceremonyAttending: false, mealSelection: "" })}>Regretfully declines</button></div></fieldset>)}</div>{guestResponses.length > 1 ? <p className="help-note couple-note">You may each reply in your own right — if one of you can join us and the other cannot, that is perfectly all right.</p> : null}{guestResponses.length === 0 ? <p className="form-error" role="alert">We are unable to find the names attached to this invitation, so the reply buttons are missing. Do let Elaine and Haykal know — nothing entered here can be saved until it is put right.</p> : null}</> : <div className="invitation-only"><span aria-hidden="true">🔐</span><h3>Your invitation is your key</h3><p>Replies are opened only through the personal link Elaine and Haykal have sent you. It carries the names of those they have invited, and cannot be extended to additional guests.</p><p className="invitation-only-note">The rest of the evening — the dress code, the menu, and how to find us — opens with that link. This is where the page ends for now.</p></div>}{error && activeSection === "rsvp" ? <p className="form-error" role="alert">{error}</p> : null}{personalised && guestResponses.length > 0 ? <ScrollOn ready={rsvpComplete} hint={!validPhone() && guestResponses.some((guest) => guest.rsvpStatus === "Pending") ? "Reply for everyone above and add a number." : !validPhone() ? "Add a number we can reach you on." : "A reply is still awaited above."} label="Thank you — please continue below" /> : null}</div></section>

    {renderCustomPages("rsvp")}
    {anyYes && !hiddenScenes.has("dress") ? <section id="dress" data-sky="dream-3" style={textStyle("dress")} className="scene scene--blush" data-scene><img className="scene-art scene-art--wide-frame" src="/wedding/frame-wide.webp" alt="" loading="lazy" aria-hidden="true" /><div className="scene-content dress-card reveal"><p className="step-label">02 · Dress code</p><p className="script-kicker">{content.dressKicker}</p><h2>{content.dressCode}</h2><RibbonDivider /><p>{content.dressNote}</p><p className="dress-restriction">{content.dressRestriction}</p><div className="swatches" aria-label="Suggested colour palette"><span style={{ background: "#F1E6DD" }} title="Ivory blush" /><span style={{ background: "#D8C0B4" }} title="Champagne rose" /><span style={{ background: "#C9A8A0" }} title="Rosewood mist" /><span style={{ background: "#AB5369" }} title="Deep rose" /><span style={{ background: "#8E4258" }} title="Rose noir" /></div><small className="palette-note">The palette is inspiration only; every colour beyond the bridal shades is welcome.</small><ScrollOn label="Your table awaits below" /></div></section> : null}

    {renderCustomPages("dress")}
    {anyYes ? <section id="meal" data-sky="dream-1" style={textStyle("meal")} className="scene scene--paper scene--meal" data-scene><img className="scene-art scene-art--feast" src="/wedding/feast-table.webp" alt="A hand-drawn candlelit wedding feast" loading="lazy" /><div className="scene-content form-card reveal"><p className="step-label">03 · At the table</p><h2>Choose your main course</h2><p className="section-intro">One happy decision before the dancing.</p><div className="guest-meal-list">{guestResponses.filter((guest) => guest.rsvpStatus === "Confirmed").map((guest) => <fieldset key={guest.id}><legend>{guest.name}</legend><div className="choice-grid choice-grid--two meal-choices"><ChoiceButton selected={guest.mealSelection === "Salmon"} title="Seared Alaskan salmon" detail={salmonDescription} onClick={() => updateGuest(guest.id, { mealSelection: "Salmon" })} /><ChoiceButton selected={guest.mealSelection === "Lamb"} title="Almond dukkha-crusted lamb" detail={lambDescription} onClick={() => updateGuest(guest.id, { mealSelection: "Lamb" })} /></div><div className="field-grid"><label><span>Dietary requirements (if any)</span><input value={guest.dietaryRequirements} onChange={(event) => updateGuest(guest.id, { dietaryRequirements: event.target.value })} placeholder="Vegetarian, no shellfish…" maxLength={800} /></label><label><span>Allergies (if any)</span><input value={guest.allergies} onChange={(event) => updateGuest(guest.id, { allergies: event.target.value })} placeholder={`Anything ${guest.name} should avoid`} maxLength={800} /></label></div></fieldset>)}</div>{error && activeSection === "meal" ? <p className="form-error" role="alert">{error}</p> : null}<ScrollOn ready={mealComplete} hint="Choose a main course for everyone joining us." /></div></section> : null}

    {renderCustomPages("meal")}
    {mealComplete && !hiddenScenes.has("travel") ? <section id="travel" data-sky="dream-2" style={textStyle("travel")} className="scene scene--pearl" data-scene><img className="scene-art scene-art--pearl" src="/wedding/pearl-floral.webp" alt="" loading="lazy" aria-hidden="true" /><div className="scene-content form-card form-card--glass reveal"><p className="step-label">04 · Your journey</p><h2>Coming from afar?</h2><p className="section-intro">Only if you are travelling to us.</p><fieldset><legend>{attendingCount > 1 ? "Are you all flying in?" : "Are you flying in?"}</legend><div className="segmented-control"><button type="button" className={rsvp.flyingIn === true ? "is-selected" : ""} onClick={() => update("flyingIn", true)}>Yes</button><button type="button" className={rsvp.flyingIn === false ? "is-selected" : ""} onClick={() => { update("flyingIn", false); update("roomAtHyatt", null); }}>No</button></div></fieldset>{rsvp.flyingIn ? <div className="slide-open travel-details">
      <p className="room-offer"><strong>The Grand Room · RM850++ a night</strong><span>A rate held for our guests at the Grand Hyatt, in the same building as the celebration.</span></p>
      <fieldset><legend>Would you like a room?</legend><div className="segmented-control"><button type="button" className={rsvp.roomAtHyatt === true ? "is-selected" : ""} onClick={() => update("roomAtHyatt", true)}>Yes, please</button><button type="button" className={rsvp.roomAtHyatt === false ? "is-selected" : ""} onClick={() => { update("roomAtHyatt", false); update("bedPreference", null); update("nights", null); }}>No, thank you</button></div></fieldset>
      {rsvp.roomAtHyatt === true ? <div className="slide-open">
        <fieldset><legend>Bed</legend><div className="segmented-control"><button type="button" className={rsvp.bedPreference === "King" ? "is-selected" : ""} onClick={() => update("bedPreference", "King")}>One king</button><button type="button" className={rsvp.bedPreference === "Twin" ? "is-selected" : ""} onClick={() => update("bedPreference", "Twin")}>Two singles</button></div></fieldset>
        <fieldset><legend>Nights</legend><div className="segmented-control">{[1, 2, 3].map((count) => <button key={count} type="button" className={rsvp.nights === count ? "is-selected" : ""} onClick={() => update("nights", count)}>{count} {count === 1 ? "night" : "nights"}</button>)}</div></fieldset>
        <label className="full-field"><span>Checking in</span><input type="date" value={rsvp.arrivalDate} onChange={(event) => update("arrivalDate", event.target.value)} /></label>
        <p className="help-note">We will pass this to the hotel and be in touch. Nothing is charged here.</p>
      </div> : null}
      {rsvp.roomAtHyatt === false ? <div className="slide-open">
        <p className="help-note">A few good places within a short walk, should you still be deciding.</p>
        <ul className="hotel-list">{nearbyHotels.map((hotel) => <li key={hotel.name}><a href={maps(`${hotel.name} Kuala Lumpur`)} target="_blank" rel="noreferrer"><strong>{hotel.name}</strong><span>{hotel.note}</span><em className="place-score">★ {hotel.score}</em><i>{hotel.walk} away ↗</i></a></li>)}</ul>
        <label className="full-field"><span>Where are you staying?</span><input value={rsvp.accommodation} onChange={(event) => update("accommodation", event.target.value)} placeholder="Hotel or neighbourhood" maxLength={240} /></label>
      </div> : null}
    </div> : null}<label className="full-field"><span>Anything that would make the evening easier? (optional)</span><input value={rsvp.accessibilityNote} onChange={(event) => update("accessibilityNote", event.target.value)} placeholder="Step-free access, seating close to the door…" maxLength={800} /></label>{error && activeSection === "travel" ? <p className="form-error" role="alert">{error}</p> : null}<ScrollOn ready={travelComplete} hint={rsvp.flyingIn === null ? "Answer the question above to continue." : rsvp.roomAtHyatt === null ? "Let us know about a room to continue." : "A few details above are still to be filled in."} /></div></section> : null}

    {renderCustomPages("travel")}
    


    {flyingIn ? <section id="airport" data-sky="dream-3" style={textStyle("airport")} className="scene scene--pearl" data-scene>
      <div className="scene-content venue-card reveal">
        <p className="step-label">Landing in Kuala Lumpur</p>
        <h2>From the airport</h2>
        <p className="section-intro">KLIA to the city centre, about an hour.</p>
        <div className="arrival-grid">
          <article><span>01</span><h3>KLIA Express</h3><p>Every half hour to KL Sentral, 28 minutes. Then a short Grab to the hotel.</p></article>
          <article><span>02</span><h3>Grab</h3><p>Book in the arrivals hall. Around RM75–110 to the Grand Hyatt, depending on traffic.</p></article>
          <article><span>03</span><h3>Airport taxi</h3><p>Buy a coupon at the counter before you leave the terminal, and pay a fixed fare.</p></article>
        </div>
        <ScrollOn />
      </div>
    </section> : null}
    {renderCustomPages("airport")}

    {flyingIn ? <section id="apps" data-sky="dream-1" style={textStyle("apps")} className="scene scene--paper" data-scene>
      <div className="scene-content venue-card reveal">
        <p className="step-label">Before you fly</p>
        <h2>Three apps worth downloading</h2>
        <p className="section-intro">They make Kuala Lumpur far easier.</p>
        <div className="arrival-grid">
          <article><span>01</span><h3>Grab</h3><p>Rides and food delivery. The way most people move around the city.</p></article>
          <article><span>02</span><h3>Touch &rsquo;n Go eWallet</h3><p>Pays for trains, parking and much else. Set it up before you arrive.</p></article>
          <article><span>03</span><h3>Google Maps</h3><p>Download the Kuala Lumpur map offline, and you will never be lost.</p></article>
        </div>
        <ScrollOn />
      </div>
    </section> : null}
    {renderCustomPages("apps")}

    {flyingIn && !hiddenScenes.has("recommendations") ? <section id="recommendations" data-sky="dream-2" style={textStyle("recommendations")} className="scene scene--recommendations" data-scene><div className="recommendation-glow" aria-hidden="true" /><div className="scene-content recommendations-card reveal"><p className="step-label">Elaine &amp; Haykal&rsquo;s Kuala Lumpur</p><h2>While you are here</h2><p className="section-intro">Everything below is within twenty minutes of the hotel.</p><h3 className="rec-group">To eat</h3><div className="recommendation-grid">{foodPlaces.map((place) => <a key={place.name} href={maps(place.name)} target="_blank" rel="noreferrer"><span>{place.detail}</span><h3>{place.name}</h3><p>{place.note}</p><em className="place-score">★ {place.score}</em><i>Open in Maps ↗</i></a>)}</div><h3 className="rec-group">To be pampered</h3><div className="recommendation-grid"><a href="https://www.google.com/maps/search/?api=1&query=ESSA+Spa+Grand+Hyatt+Kuala+Lumpur" target="_blank" rel="noreferrer"><span>In the hotel</span><h3>ESSA Spa</h3><p>On the doorstep — massages and facials without leaving the building.</p><i>Open in Maps ↗</i></a><a href="https://www.google.com/maps/search/?api=1&query=A-Saloon+Prestige+Suria+KLCC" target="_blank" rel="noreferrer"><span>Hair &amp; nails</span><h3>A-Saloon Prestige, Suria KLCC</h3><p>A short walk through KLCC. Good for the morning of the wedding.</p><i>Open in Maps ↗</i></a><a href="https://www.google.com/maps/search/?api=1&query=COCOdry+KLCC+Isetan" target="_blank" rel="noreferrer"><span>Blow-dry</span><h3>COCOdry, Isetan KLCC</h3><p>A blow-dry bar for anyone who wants their hair done before the evening.</p><i>Open in Maps ↗</i></a></div><h3 className="rec-group">To see</h3><div className="recommendation-grid"><a href="https://www.google.com/maps/search/?api=1&query=KLCC+Park+Kuala+Lumpur" target="_blank" rel="noreferrer"><span>Ten minutes on foot</span><h3>KLCC Park &amp; the Twin Towers</h3><p>The lake fountains play through the evening. Best just before dusk.</p><i>Open in Maps ↗</i></a><a href="https://www.google.com/maps/search/?api=1&query=Sky+Deck+KL+Tower" target="_blank" rel="noreferrer"><span>Above the city</span><h3>KL Tower Sky Deck</h3><p>An open-air deck with the whole skyline beneath you.</p><i>Open in Maps ↗</i></a><a href="https://www.google.com/maps/search/?api=1&query=Masjid+Jamek+Lookout+Point+River+of+Life" target="_blank" rel="noreferrer"><span>Old Kuala Lumpur</span><h3>Masjid Jamek &amp; River of Life</h3><p>Where the two rivers meet and the city began. Lovely after dark.</p><i>Open in Maps ↗</i></a></div><h3 className="rec-group">To shop</h3><div className="recommendation-grid"><a href="https://www.google.com/maps/search/?api=1&query=Suria+KLCC" target="_blank" rel="noreferrer"><span>Next door</span><h3>Suria KLCC</h3><p>Beneath the Twin Towers. Everything from batik to the grand names.</p><i>Open in Maps ↗</i></a><a href="https://www.google.com/maps/search/?api=1&query=The+Exchange+TRX+Kuala+Lumpur" target="_blank" rel="noreferrer"><span>Newest</span><h3>The Exchange TRX</h3><p>A ten-minute drive, with a rooftop park worth the lift ride.</p><i>Open in Maps ↗</i></a><a href="https://www.google.com/maps/search/?api=1&query=Central+Market+Kuala+Lumpur" target="_blank" rel="noreferrer"><span>For gifts home</span><h3>Central Market</h3><p>Batik, pewter and handicraft under a 1937 art deco roof.</p><i>Open in Maps ↗</i></a></div><ScrollOn /></div></section> : null}
    {renderCustomPages("recommendations")}

    {flyingIn ? <section id="sightseeing" data-sky="dream-3" style={textStyle("sightseeing")} className="scene scene--recommendations" data-scene>
      <div className="recommendation-glow" aria-hidden="true" />
      <div className="scene-content recommendations-card reveal">
        <p className="step-label">Close to the hotel</p>
        <h2>Worth seeing</h2>
        <p className="section-intro">All within twenty minutes of the door.</p>
        <div className="recommendation-grid">{sightseeingPlaces.map((place) => <a key={place.name} href={maps(place.name)} target="_blank" rel="noreferrer"><span>{place.detail}</span><h3>{place.name}</h3><p>{place.note}</p><em className="place-score">★ {place.score}</em><i>Open in Maps ↗</i></a>)}</div>
        <ScrollOn />
      </div>
    </section> : null}
    {renderCustomPages("sightseeing")}

    {flyingIn ? <section id="shopping" data-sky="dream-1" style={textStyle("shopping")} className="scene scene--paper" data-scene>
      <div className="scene-content recommendations-card reveal">
        <p className="step-label">Something to carry home</p>
        <h2>Shopping</h2>
        <p className="section-intro">Two of these are reachable without stepping outside.</p>
        <div className="recommendation-grid">{shoppingPlaces.map((place) => <a key={place.name} href={maps(place.name)} target="_blank" rel="noreferrer"><span>{place.detail}</span><h3>{place.name}</h3><p>{place.note}</p><em className="place-score">★ {place.score}</em><i>Open in Maps ↗</i></a>)}</div>
        <ScrollOn />
      </div>
    </section> : null}
    {renderCustomPages("shopping")}

    {flyingIn ? <section id="pamper" data-sky="dream-2" style={textStyle("pamper")} className="scene scene--blush" data-scene>
      <div className="scene-content recommendations-card reveal">
        <p className="step-label">Before the evening</p>
        <h2>Spa, massage &amp; hair</h2>
        <p className="section-intro">For the afternoon of the wedding, or the morning after it.</p>
        <div className="recommendation-grid">{pamperPlaces.map((place) => <a key={place.name} href={maps(place.name)} target="_blank" rel="noreferrer"><span>{place.detail}</span><h3>{place.name}</h3><p>{place.note}</p><em className="place-score">★ {place.score}</em><i>Open in Maps ↗</i></a>)}</div>
        <ScrollOn />
      </div>
    </section> : null}
    {renderCustomPages("pamper")}



    {travelComplete && !hiddenScenes.has("venue") ? <section id="venue" data-sky="dream-3" style={textStyle("venue")} className="scene scene--venue" data-scene><div className="venue-map" aria-label="Map showing Grand Hyatt Kuala Lumpur"><iframe title="Map to Grand Hyatt Kuala Lumpur" src="https://www.google.com/maps?q=Grand+Hyatt+Kuala+Lumpur,+12+Jalan+Pinang,+Kuala+Lumpur&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div><div className="scene-content venue-card reveal"><p className="step-label">Finding your way to us</p><h2>{content.venueName}</h2><p className="venue-address">{content.venueAddress.split("\n").map((line, index) => <span key={line}>{index ? <br /> : null}{line}</span>)}</p><p className="help-note venue-note">The Grand Salon is on Level 1 — take the lift or escalator up from the lobby.</p><div className="arrival-grid"><article><span>01</span><h3>By MRT</h3><p>Take the Putrajaya Line to Conlay station, leave by Entrance A, and follow Jalan Kia Peng towards the Convention Centre — the hotel appears on your right.</p></article><article><span>02</span><h3>By car</h3><p>Make your way to the hotel entrance on Jalan Pinang, where the doormen will greet you. Guest parking sits in the hotel’s own basement.</p></article><article><span>03</span><h3>By Grab</h3><p>Simply set your destination to “Grand Hyatt Kuala Lumpur” and ask to be set down at the main lobby.</p></article></div><a className="primary-button map-button" href="https://www.google.com/maps/dir/?api=1&destination=Grand+Hyatt+Kuala+Lumpur,+12+Jalan+Pinang,+50450+Kuala+Lumpur" target="_blank" rel="noreferrer">Open directions <span aria-hidden="true">↗</span></a><ScrollOn /></div></section> : null}
    {renderCustomPages("venue")}

    {travelComplete && !hiddenScenes.has("faq") ? <section id="faq" data-sky="dream-1" style={textStyle("faq")} className="scene scene--faq" data-scene>
      <div className="scene-content faq-card reveal">
        <p className="step-label">Good to know</p>
        <h2>A few gentle answers</h2>
        <dl className="faq-list">
          {faqEntries.map((entry) => <div key={entry.question}><dt>{entry.question}</dt><dd>{entry.answer}</dd></div>)}
        </dl>
        <ScrollOn label="One last thing, just below" />
      </div>
    </section> : null}
    {renderCustomPages("faq")}

    {journeyDone && !hiddenScenes.has("wishes") ? <section id="wishes" data-sky="dream-2" style={textStyle("wishes")} className="scene scene--wishes" data-scene><img className="scene-art scene-art--wishes-lace" src="/wedding/decor/lace-tape-white.webp" alt="" loading="lazy" aria-hidden="true" /><div className="scene-content wishes-card reveal"><p className="step-label">{rsvp.attendance === "yes" ? "05" : "02"} · From the heart</p><p className="script-kicker">{content.wishesKicker}</p><h2>{content.wishesHeading}</h2>{personalised ? <><label className="full-field"><span>A warm wish for the two of us</span><textarea value={rsvp.wishes} onChange={(event) => update("wishes", event.target.value)} placeholder="A blessing, a memory, a line we can keep…" rows={4} maxLength={1000} /></label>
      <p className="help-note">We may share a few of these with everyone on the night.</p>
      <label className="full-field"><span>And a little marriage advice, just for us</span><textarea value={rsvp.advice} onChange={(event) => update("advice", event.target.value)} placeholder="Something you have learned, or wish someone had told you…" rows={4} maxLength={1500} /></label>
      <p className="help-note private-note">Only Elaine and Haykal will ever read this one.</p>{error && activeSection === "wishes" ? <p className="form-error" role="alert">{error}</p> : null}<button className="primary-button" type="button" onClick={submitRsvp} disabled={submitting || submitted}>{submitting ? "Sending with love…" : submitted ? "RSVP sent" : previewMode ? "Preview confirmation" : "Send our RSVP"}{!submitting && !submitted ? <span aria-hidden="true">♡</span> : null}</button><small className="privacy-note">{previewMode ? "Preview only — no response or personal information will be saved." : "Your details are used only to plan Elaine and Haykal’s celebration."}</small></> : <div className="invitation-only compact"><p>Your personal invitation link unlocks the RSVP and wishes form.</p></div>}</div></section> : null}
    {renderCustomPages("wishes")}

    {submitted ? <section id="confirmation" data-sky="dream-3" style={textStyle("confirmation")} className="scene scene--confirmation" data-scene><Sparkles /><div className="scene-content confirmation-card reveal"><p className="eyebrow">With all our hearts</p><div className="wax-seal" aria-hidden="true">E<span>&amp;</span>H</div><h2>Thank you,<br />{rsvp.guestName || "dear guest"}.</h2><p>{rsvp.attendance === "yes" ? (inviteData?.settings?.confirmation_message || "Your place at our table is saved. We can hardly wait to celebrate, feast and dance with you.") : "We shall miss you dearly on the night, and we are so grateful to carry your love with us from afar."}</p>{rsvp.wishes.trim() ? <blockquote className="shared-wish"><p>&ldquo;{rsvp.wishes.trim()}&rdquo;</p><cite>your words, kept for the night</cite></blockquote> : null}<RibbonDivider /><div className="confirmation-details"><span>7 November 2026</span><span>The Grand Salon · Grand Hyatt Kuala Lumpur</span></div>{rsvp.attendance === "yes" ? <><Countdown /><div className="confirmation-actions"><button className="calendar-button" type="button" onClick={downloadCalendarInvite}>Add to calendar <span aria-hidden="true">↓</span></button><a className="calendar-button" href="https://www.google.com/maps/dir/?api=1&destination=Grand+Hyatt+Kuala+Lumpur,+12+Jalan+Pinang,+50450+Kuala+Lumpur" target="_blank" rel="noreferrer">Directions <span aria-hidden="true">↗</span></a></div></> : null}{inviteData?.afterPartyInvited && invitationToken ? <a className="after-party-reveal" href={`/after-party?token=${encodeURIComponent(invitationToken)}`}>A secret chapter awaits ✦</a> : null}<button className="text-button" type="button" onClick={() => scrollToSection("welcome")}>Return to the beginning ↑</button></div></section> : null}
    {submitted ? renderCustomPages("confirmation") : null}
  </main>;
}
