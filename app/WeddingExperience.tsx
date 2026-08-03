"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { defaultSiteDesign, fontPairs, normaliseSiteDesign, SiteDesign } from "../lib/site-design";
import { rsvpDeadlineLabel } from "../lib/rsvp-window";
import { StoryPrologue } from "./StoryPrologue";

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
  song_request: string | null;
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
  songRequest: string;
  wishes: string;
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
  arrivalDate: string;
  departureDate: string;
  accommodation: string;
  transportHelp: boolean | null;
  accessibilityNote: string;
  songRequest: string;
  wishes: string;
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
  arrivalDate: "",
  departureDate: "",
  accommodation: "",
  transportHelp: null,
  accessibilityNote: "",
  songRequest: "",
  wishes: "",
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
const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
const ScrollOn = ({ ready = true, hint, label = "Keep scrolling" }: { ready?: boolean; hint?: string; label?: string }) => ready
  ? <p className="scroll-on"><i aria-hidden="true" /> {label}</p>
  : hint ? <p className="gate-hint" role="status">{hint}</p> : null;
const sceneLabels: Record<string, string> = {
  welcome: "Our story", invitation: "The invitation", schedule: "The evening", venue: "The Grand Salon", faq: "Good to know", rsvp: "Your reply", dress: "Dress code", meal: "Dinner", travel: "Your journey", recommendations: "Kuala Lumpur", wishes: "From the heart", confirmation: "Until November",
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

const eveningMoments = [
  { time: "6:00pm", title: "Arrival", note: "Doors open at The Grand Salon. Drinks and canapés are served while everyone gathers." },
  { time: "6:45pm", title: "The celebration begins", note: "Please be seated — the evening opens with the couple\u2019s entrance." },
  { time: "Then", title: "Dinner is served", note: "Your chosen main course arrives at the table, followed by dessert." },
  { time: "Later", title: "Speeches & toasts", note: "A few words from the people who love Elaine and Haykal most." },
  { time: "Until late", title: "Dancing", note: "Shoes made for dancing will earn their keep." },
] as const;

const faqEntries = [
  { question: "What time should we arrive?", answer: "Doors open at 6:00pm with drinks and canapés; the celebration begins at 6:45pm sharp." },
  { question: "Where do we park?", answer: "Guest parking is available in Grand Hyatt\u2019s underground car park — take the lift straight up to the lobby." },
  { question: "Will dietary needs be looked after?", answer: "Yes — every dish is prepared with care, and anything you note in your RSVP goes directly to the kitchen." },
  { question: "May we take photos?", answer: "During the key moments we\u2019d love to see your eyes, not your screens — our photographers will catch everything, and the dance floor is all yours afterwards." },
  { question: "What about gifts?", answer: "Your presence truly is the present. If you\u2019d like to leave a card, a card box will be waiting at the reception." },
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
  const [rsvp, setRsvp] = useState<RsvpState>(() => previewMode ? { ...initialRsvp, guestName: "dear guest", phoneNumber: "12345678" } : initialRsvp);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [guestResponses, setGuestResponses] = useState<GuestResponse[]>(() => previewMode ? [{ id: -1, name: "Your name", rsvpStatus: "Pending", ceremonyAttending: true, receptionAttending: true, afterPartyInvited: false, afterPartyAttending: "Pending", mealSelection: "", dietaryRequirements: "", allergies: "", accessibility: "", transportRequired: false, accommodationRequired: false, travelArrival: "", travelDeparture: "", accommodationName: "", songRequest: "", wishes: "" }] : []);
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
          transportHelp: result.guests.some((guest) => guest.rsvp_status !== "Pending") ? result.guests.some((guest) => Boolean(guest.transport_required)) : current.transportHelp,
          accessibilityNote: result.guests.map((guest) => guest.accessibility || "").find(Boolean) || current.accessibilityNote,
          songRequest: result.guests.map((guest) => guest.song_request || "").find(Boolean) || current.songRequest,
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
          songRequest: guest.song_request || "",
          wishes: guest.wishes || "",
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
  const travelComplete = mealComplete && (hiddenScenes.has("travel") || (rsvp.flyingIn !== null && rsvp.transportHelp !== null && (!rsvp.flyingIn || (rsvp.roomAtHyatt !== null && Boolean(rsvp.arrivalDate) && Boolean(rsvp.departureDate) && (rsvp.roomAtHyatt !== false || Boolean(rsvp.accommodation.trim()))))));
  const journeyDone = travelComplete || allDeclined;
  useEffect(() => {
    if (!rsvpComplete) return;
    const next = anyYes ? "yes" : "no";
    setRsvp((current) => current.attendance === next ? current : { ...current, attendance: next });
  }, [rsvpComplete, anyYes]);
  const sectionIds = useMemo(() => {
    const ids = ["welcome", "invitation", "schedule", "rsvp"];
    if (anyYes) ids.push("dress", "meal");
    if (mealComplete) ids.push("travel");
    if (travelComplete) ids.push("venue", "recommendations", "faq");
    if (journeyDone) ids.push("wishes");
    if (submitted) ids.push("confirmation");
    // Editor-hidden chapters drop out; editor-added pages slide in after their anchor.
    return ids.flatMap((id) => [...(hiddenScenes.has(id) ? [] : [id]), ...(customAfter.get(id) ?? []).map((page) => page.id)]);
  }, [anyYes, mealComplete, travelComplete, journeyDone, submitted, hiddenScenes, customAfter]);
  const chapterLabels = useMemo(() => ({ ...sceneLabels, ...Object.fromEntries(siteDesign.customPages.map((page) => [page.id, page.title])) }), [siteDesign.customPages]);
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
      setError("Please use the personal invitation link sent to you to RSVP.");
      scrollToSection("rsvp");
      return;
    }
    if (!validPhone()) {
      setError("Please add a valid mobile number before sending your RSVP.");
      scrollToSection("rsvp");
      return;
    }
    if (guestResponses.some((guest) => guest.rsvpStatus === "Pending")) {
      setError("Please reply for every named guest in your invitation.");
      scrollToSection("rsvp");
      return;
    }
    if (guestResponses.some((guest) => guest.rsvpStatus === "Confirmed" && !guest.mealSelection)) {
      setError("Please choose a main course for every attending guest.");
      scrollToSection("meal");
      return;
    }
    if (rsvp.attendance === "yes" && !hiddenScenes.has("travel")) {
      if (rsvp.flyingIn === null) {
        setError("Please let us know whether your invitation group is flying in.");
        scrollToSection("travel");
        return;
      }
      if (rsvp.flyingIn && rsvp.roomAtHyatt === null) {
        setError("Please let us know whether you would like a room at Grand Hyatt.");
        scrollToSection("travel");
        return;
      }
      if (rsvp.flyingIn && (!rsvp.arrivalDate || !rsvp.departureDate)) {
        setError("Please add your arrival and departure dates.");
        scrollToSection("travel");
        return;
      }
      if (rsvp.flyingIn && rsvp.roomAtHyatt === false && !rsvp.accommodation.trim()) {
        setError("Please tell us where you will be staying.");
        scrollToSection("travel");
        return;
      }
      if (rsvp.transportHelp === null) {
        setError("Please let us know whether your party needs help with transport on the night.");
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
        travelDeparture: guest.rsvpStatus === "Confirmed" ? rsvp.departureDate : "",
        accommodationRequired: guest.rsvpStatus === "Confirmed" && rsvp.roomAtHyatt === true,
        accommodationName: guest.rsvpStatus === "Confirmed" && rsvp.roomAtHyatt === false ? rsvp.accommodation : "",
        transportRequired: guest.rsvpStatus === "Confirmed" && rsvp.transportHelp === true,
        accessibility: guest.rsvpStatus === "Confirmed" ? rsvp.accessibilityNote : "",
        songRequest: guest.id === firstConfirmedId ? rsvp.songRequest : "",
        wishes: rsvp.wishes || guest.wishes,
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

  return <main className={`wedding-shell wedding-shell--storybook ${designClasses}`} style={typography}>
    <a className="skip-experience" href="#rsvp">Skip our story and go to the RSVP</a>
    {music.musicUrl ? <><audio ref={audioRef} src={music.musicUrl} loop preload="none" onPause={() => setSoundEnabled(false)} onPlay={() => setSoundEnabled(true)} /><button type="button" className="sound-control" onClick={toggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? "Pause wedding music" : "Play wedding music"}><span aria-hidden="true">{soundEnabled ? "❚❚" : "♪"}</span><small>{soundEnabled ? "Pause" : "Play music"}</small>{music.musicTitle ? <em>{music.musicTitle}</em> : null}</button></> : null}
    {activeSection !== "welcome" ? <>
      <div className="scroll-progress" aria-hidden="true"><i style={{ height: `${((sectionIds.indexOf(activeSection) + 1) / sectionIds.length) * 100}%` }} /></div>
      <nav className="scene-nav" aria-label="Invitation sections">{sectionIds.map((id) => <button key={id} type="button" className={activeSection === id ? "is-active" : ""} onClick={() => scrollToSection(id)} aria-label={`Go to ${chapterLabels[id] || id}`} aria-current={activeSection === id ? "step" : undefined}><span /><b>{chapterLabels[id] || id}</b></button>)}</nav>
      <aside className="mobile-chapter-dock" aria-label="Invitation chapter controls"><button type="button" onClick={() => moveChapter(-1)} disabled={activeIndex === 0} aria-label="Previous chapter">←</button><div><small>{String(activeIndex + 1).padStart(2, "0")} / {String(sectionIds.length).padStart(2, "0")}</small><strong>{chapterLabels[activeSection] || activeSection}</strong><i><span style={{ width: `${((activeIndex + 1) / sectionIds.length) * 100}%` }} /></i></div><button type="button" onClick={() => moveChapter(1)} disabled={activeIndex === sectionIds.length - 1} aria-label="Next chapter">→</button></aside>
    </> : null}
    <EditableDecorationOverlay design={siteDesign} activeScene={activeSection} />

    <section id="welcome" className="scene scene--story is-visible" data-scene aria-label="Elaine and Haykal’s story">
      <StoryPrologue guestName={rsvp.guestName} onEnter={() => scrollToSection("invitation")} />
    </section>

    {renderCustomPages("welcome")}
    <section id="invitation" className="scene scene--invitation" data-scene>
      <img className="scene-art scene-art--floral" src="/wedding/floral-frame.webp" alt="" loading="lazy" aria-hidden="true" />
      <img className="scene-art floating-bloom floating-bloom--left" src="/wedding/pearl-floral.webp" alt="" loading="lazy" aria-hidden="true" />
      <img className="scene-art floating-bloom floating-bloom--right" src="/wedding/pearl-floral.webp" alt="" loading="lazy" aria-hidden="true" />
      <div className="scene-content invitation-card reveal">
        <p className="eyebrow">{content.familyLine}</p>
        <p className="invitation-line">{content.invitationLine}</p>
        <h2>{content.brideName} <span>&amp;</span> {content.groomName}</h2>
        <RibbonDivider />
        <div className="event-details"><p><strong>Saturday</strong><span>{content.eventDate}</span></p><p><strong>{content.eventTime.replace(/pm$/i, "")}</strong><span>in the evening</span></p><p><strong>{content.venueName}</strong><span>Grand Hyatt Kuala Lumpur</span></p></div>
        <ScrollOn label="Keep scrolling — the evening unfolds below" />
      </div>
    </section>

    {renderCustomPages("invitation")}
    {!hiddenScenes.has("schedule") ? <section id="schedule" className="scene scene--schedule" data-scene>
      <img className="scene-art scene-art--schedule" src="/wedding/frame-tall.webp" alt="" loading="lazy" aria-hidden="true" />
      <div className="scene-content schedule-card reveal">
        <p className="step-label">The programme</p>
        <h2>The evening unfolds</h2>
        <p className="section-intro">One unhurried evening, from the first hello to the last dance.</p>
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

    <section id="rsvp" className="scene scene--paper" data-scene><img className="scene-art scene-art--dinner" src="/wedding/dinner-table.webp" alt="A hand-drawn wedding reception table" loading="lazy" /><div className="scene-content form-card reveal"><p className="step-label">01 · Your reply</p><h2>Will you join us?</h2>{personalised ? <><p className="section-intro">Only the named adults below may RSVP. No children or additional guests can be added.</p>{rsvpDeadlineLabel(inviteData?.settings?.rsvp_deadline) ? <p className="rsvp-deadline-note">Kindly reply by <strong>{rsvpDeadlineLabel(inviteData?.settings?.rsvp_deadline)}</strong> — you may return to this link to update your reply any time before then.</p> : null}<div className="field-grid phone-grid"><label><span>Country code *</span><select value={rsvp.countryCode} onChange={(event) => update("countryCode", event.target.value)} aria-label="Country calling code">{countryCodes.map(([country, code]) => <option key={`${country}-${code}`} value={code}>{country} ({code})</option>)}</select></label><label><span>Mobile number *</span><input required value={rsvp.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value)} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="12 345 6789" maxLength={24} /></label></div><div className="party-rsvp-list">{guestResponses.map((guest) => <fieldset key={guest.id}><legend>{guest.name}</legend><div className="segmented-control"><button type="button" className={guest.rsvpStatus === "Confirmed" ? "is-selected" : ""} onClick={() => updateGuest(guest.id, { rsvpStatus: "Confirmed", receptionAttending: true })}>Joyfully accepts</button><button type="button" className={guest.rsvpStatus === "Declined" ? "is-selected" : ""} onClick={() => updateGuest(guest.id, { rsvpStatus: "Declined", receptionAttending: false, ceremonyAttending: false, mealSelection: "" })}>Sadly declines</button></div></fieldset>)}</div>{guestResponses.length > 1 ? <p className="help-note couple-note">Each invited partner may respond separately, so a husband or wife may attend the reception on their own.</p> : null}</> : <div className="invitation-only"><span aria-hidden="true">🔐</span><h3>Your personal link is your key</h3><p>RSVPs are available only through the unique invitation link sent by Elaine and Haykal. It shows exactly who is invited and does not allow children, plus-ones or additional guests.</p></div>}{error && activeSection === "rsvp" ? <p className="form-error" role="alert">{error}</p> : null}{personalised ? <ScrollOn ready={rsvpComplete} hint="To continue, reply for every named guest and add your mobile number — both are required." label={anyYes ? "Wonderful — keep scrolling" : "Keep scrolling"} /> : null}</div></section>

    {renderCustomPages("rsvp")}
    {anyYes && !hiddenScenes.has("dress") ? <section id="dress" className="scene scene--blush" data-scene><img className="scene-art scene-art--wide-frame" src="/wedding/frame-wide.webp" alt="" loading="lazy" aria-hidden="true" /><div className="scene-content dress-card reveal"><p className="step-label">02 · Dress code</p><p className="script-kicker">{content.dressKicker}</p><h2>{content.dressCode}</h2><RibbonDivider /><p>{content.dressNote}</p><p className="dress-restriction">{content.dressRestriction}</p><div className="swatches" aria-label="Suggested colour palette"><span style={{ background: "#F1E6DD" }} title="Ivory blush" /><span style={{ background: "#D8C0B4" }} title="Champagne rose" /><span style={{ background: "#C9A8A0" }} title="Rosewood mist" /><span style={{ background: "#AB5369" }} title="Deep rose" /><span style={{ background: "#8E4258" }} title="Rose noir" /></div><small className="palette-note">The palette is inspiration only; every colour beyond the bridal shades is welcome.</small><ScrollOn label="Keep scrolling to choose your dinner" /></div></section> : null}

    {renderCustomPages("dress")}
    {anyYes ? <section id="meal" className="scene scene--paper scene--meal" data-scene><img className="scene-art scene-art--feast" src="/wedding/feast-table.webp" alt="A hand-drawn candlelit wedding feast" loading="lazy" /><div className="scene-content form-card reveal"><p className="step-label">03 · At the table</p><h2>Choose your main</h2><p className="section-intro">One delicious decision before the dancing begins.</p><div className="guest-meal-list">{guestResponses.filter((guest) => guest.rsvpStatus === "Confirmed").map((guest) => <fieldset key={guest.id}><legend>{guest.name}</legend><div className="choice-grid choice-grid--two meal-choices"><ChoiceButton selected={guest.mealSelection === "Salmon"} title="Seared Alaskan salmon" detail={salmonDescription} onClick={() => updateGuest(guest.id, { mealSelection: "Salmon" })} /><ChoiceButton selected={guest.mealSelection === "Lamb"} title="Almond dukkha-crusted lamb" detail={lambDescription} onClick={() => updateGuest(guest.id, { mealSelection: "Lamb" })} /></div><div className="field-grid"><label><span>Dietary requirements</span><input value={guest.dietaryRequirements} onChange={(event) => updateGuest(guest.id, { dietaryRequirements: event.target.value })} placeholder="Vegetarian, no shellfish…" maxLength={800} /></label><label><span>Allergies</span><input value={guest.allergies} onChange={(event) => updateGuest(guest.id, { allergies: event.target.value })} placeholder={`Anything ${guest.name} must avoid?`} maxLength={800} /></label></div></fieldset>)}</div>{error && activeSection === "meal" ? <p className="form-error" role="alert">{error}</p> : null}<ScrollOn ready={mealComplete} hint="Choose salmon or lamb for every attending guest — a main course is required to continue." /></div></section> : null}

    {renderCustomPages("meal")}
    {mealComplete && !hiddenScenes.has("travel") ? <section id="travel" className="scene scene--pearl" data-scene><img className="scene-art scene-art--pearl" src="/wedding/pearl-floral.webp" alt="" loading="lazy" aria-hidden="true" /><div className="scene-content form-card form-card--glass reveal"><p className="step-label">04 · Your journey</p><h2>Coming from afar?</h2><p className="section-intro">A few details to help us look after your invited party in Kuala Lumpur.</p><fieldset><legend>Is anyone in this invitation flying in?</legend><div className="segmented-control"><button type="button" className={rsvp.flyingIn === true ? "is-selected" : ""} onClick={() => update("flyingIn", true)}>Yes</button><button type="button" className={rsvp.flyingIn === false ? "is-selected" : ""} onClick={() => { update("flyingIn", false); update("roomAtHyatt", null); }}>No</button></div></fieldset>{rsvp.flyingIn ? <div className="slide-open travel-details"><fieldset><legend>Would your party like a room at Grand Hyatt?</legend><div className="segmented-control"><button type="button" className={rsvp.roomAtHyatt === true ? "is-selected" : ""} onClick={() => update("roomAtHyatt", true)}>Yes, please</button><button type="button" className={rsvp.roomAtHyatt === false ? "is-selected" : ""} onClick={() => update("roomAtHyatt", false)}>No, thank you</button></div></fieldset><div className="field-grid"><label><span>Arrival date</span><input type="date" value={rsvp.arrivalDate} onChange={(event) => update("arrivalDate", event.target.value)} /></label><label><span>Departure date</span><input type="date" value={rsvp.departureDate} onChange={(event) => update("departureDate", event.target.value)} /></label></div>{rsvp.roomAtHyatt === false ? <label className="full-field slide-open"><span>Where will you be staying?</span><input value={rsvp.accommodation} onChange={(event) => update("accommodation", event.target.value)} placeholder="Hotel or neighbourhood" maxLength={240} /></label> : null}{rsvp.roomAtHyatt === true ? <p className="help-note slide-open">We’ll use these dates to coordinate room availability and follow up by phone.</p> : null}</div> : null}<fieldset><legend>Would your party like help with transport on the night?</legend><div className="segmented-control"><button type="button" className={rsvp.transportHelp === true ? "is-selected" : ""} onClick={() => update("transportHelp", true)}>Yes, please</button><button type="button" className={rsvp.transportHelp === false ? "is-selected" : ""} onClick={() => update("transportHelp", false)}>We&rsquo;ll make our own way</button></div></fieldset><label className="full-field"><span>Anything that would make the evening easier for you? (optional)</span><input value={rsvp.accessibilityNote} onChange={(event) => update("accessibilityNote", event.target.value)} placeholder="Step-free access, seating close to the door…" maxLength={800} /></label>{error && activeSection === "travel" ? <p className="form-error" role="alert">{error}</p> : null}<ScrollOn ready={travelComplete} hint="Answer the flying and transport questions above to continue." /></div></section> : null}

    {renderCustomPages("travel")}
    {travelComplete && !hiddenScenes.has("venue") ? <section id="venue" className="scene scene--venue" data-scene><div className="venue-map" aria-label="Map showing Grand Hyatt Kuala Lumpur"><iframe title="Map to Grand Hyatt Kuala Lumpur" src="https://www.google.com/maps?q=Grand+Hyatt+Kuala+Lumpur,+12+Jalan+Pinang,+Kuala+Lumpur&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div><div className="scene-content venue-card reveal"><p className="step-label">Ways to reach Grand Hyatt</p><h2>{content.venueName}</h2><p className="venue-address">{content.venueAddress.split("\n").map((line, index) => <span key={line}>{index ? <br /> : null}{line}</span>)}</p><div className="arrival-grid"><article><span>01</span><h3>By MRT</h3><p>Take the Putrajaya Line to Conlay MRT. Use Entrance A and continue along Jalan Kia Peng toward the KL Convention Centre and hotel.</p></article><article><span>02</span><h3>By car</h3><p>Drive to the Grand Hyatt entrance on Jalan Pinang. Guest parking is available in the hotel’s underground parking.</p></article><article><span>03</span><h3>By Grab</h3><p>Set your destination to “Grand Hyatt Kuala Lumpur” and ask to be dropped at the main hotel lobby.</p></article></div><a className="primary-button map-button" href="https://www.google.com/maps/dir/?api=1&destination=Grand+Hyatt+Kuala+Lumpur,+12+Jalan+Pinang,+50450+Kuala+Lumpur" target="_blank" rel="noreferrer">Open directions <span aria-hidden="true">↗</span></a><ScrollOn /></div></section> : null}
    {renderCustomPages("venue")}


    {travelComplete && !hiddenScenes.has("recommendations") ? <section id="recommendations" className="scene scene--recommendations" data-scene><div className="recommendation-glow" aria-hidden="true" /><div className="scene-content recommendations-card reveal"><p className="step-label">Elaine &amp; Haykal’s KL favourites</p><h2>Three delicious detours</h2><p className="section-intro">If you have time around the celebration, these are the flavours we would send you to first.</p><div className="recommendation-grid"><a href="https://www.google.com/maps/search/?api=1&query=Village+Park+Restaurant+Damansara+Utama" target="_blank" rel="noreferrer"><span>Haykal’s favourite</span><h3>Village Park Nasi Lemak</h3><p>Crisp ayam goreng, fragrant coconut rice and sambal worth the journey.</p><i>Open in Maps ↗</i></a><a href="https://www.google.com/maps/search/?api=1&query=Nyonya+Colors+Kuala+Lumpur" target="_blank" rel="noreferrer"><span>Local kueh</span><h3>Nyonya Colors</h3><p>A colourful stop for traditional kuih, comforting noodles and Malaysian sweets.</p><i>Open in Maps ↗</i></a><a href="https://www.google.com/maps/search/?api=1&query=Super+Kitchen+Chilli+Pan+Mee+Kuala+Lumpur" target="_blank" rel="noreferrer"><span>Elaine’s favourite</span><h3>Super Kitchen Chilli Pan Mee</h3><p>Springy noodles, poached egg and a fiery chilli mix—stir everything together.</p><i>Open in Maps ↗</i></a></div><ScrollOn /></div></section> : null}
    {renderCustomPages("recommendations")}

    {travelComplete && !hiddenScenes.has("faq") ? <section id="faq" className="scene scene--faq" data-scene>
      <div className="scene-content faq-card reveal">
        <p className="step-label">Good to know</p>
        <h2>A few gentle answers</h2>
        <dl className="faq-list">
          {faqEntries.map((entry) => <div key={entry.question}><dt>{entry.question}</dt><dd>{entry.answer}</dd></div>)}
        </dl>
        <ScrollOn label="One last thing — keep scrolling" />
      </div>
    </section> : null}
    {renderCustomPages("faq")}

    {journeyDone && !hiddenScenes.has("wishes") ? <section id="wishes" className="scene scene--wishes" data-scene><img className="scene-art scene-art--wishes-lace" src="/wedding/decor/lace-tape-white.webp" alt="" loading="lazy" aria-hidden="true" /><div className="scene-content wishes-card reveal"><p className="step-label">{rsvp.attendance === "yes" ? "05" : "02"} · From the heart</p><p className="script-kicker">{content.wishesKicker}</p><h2>{content.wishesHeading}</h2>{personalised ? <>{rsvp.attendance !== "no" ? <label className="full-field song-field"><span>What song would get you on the dance floor? (optional)</span><input value={rsvp.songRequest} onChange={(event) => update("songRequest", event.target.value)} placeholder="Artist — song title" maxLength={240} /></label> : null}<label><span className="sr-only">Your wishes or marriage advice</span><textarea value={rsvp.wishes} onChange={(event) => update("wishes", event.target.value)} placeholder="Leave us a wish, a story, or your best piece of advice…" rows={6} maxLength={1500} /></label>{error && activeSection === "wishes" ? <p className="form-error" role="alert">{error}</p> : null}<button className="primary-button" type="button" onClick={submitRsvp} disabled={submitting || submitted}>{submitting ? "Sending with love…" : submitted ? "RSVP sent" : previewMode ? "Preview confirmation" : "Send our RSVP"}{!submitting && !submitted ? <span aria-hidden="true">♡</span> : null}</button><small className="privacy-note">{previewMode ? "Preview only — no response or personal information will be saved." : "Your details are used only to plan Elaine and Haykal’s celebration."}</small></> : <div className="invitation-only compact"><p>Your personal invitation link unlocks the RSVP and wishes form.</p></div>}</div></section> : null}
    {renderCustomPages("wishes")}

    {submitted ? <section id="confirmation" className="scene scene--confirmation" data-scene><Sparkles /><div className="scene-content confirmation-card reveal"><p className="eyebrow">It’s official</p><div className="wax-seal" aria-hidden="true">E<span>&amp;</span>H</div><h2>Thank you,<br />{rsvp.guestName || "dear guest"}.</h2><p>{rsvp.attendance === "yes" ? (inviteData?.settings?.confirmation_message || "Your place is saved. We can’t wait to celebrate, feast, and dance with you.") : "We’ll miss you on the night, and we’re grateful to have your love with us from afar."}</p><RibbonDivider /><div className="confirmation-details"><span>7 November 2026</span><span>The Grand Salon · Grand Hyatt Kuala Lumpur</span></div>{rsvp.attendance === "yes" ? <><Countdown /><div className="confirmation-actions"><button className="calendar-button" type="button" onClick={downloadCalendarInvite}>Add to calendar <span aria-hidden="true">↓</span></button><a className="calendar-button" href="https://www.google.com/maps/dir/?api=1&destination=Grand+Hyatt+Kuala+Lumpur,+12+Jalan+Pinang,+50450+Kuala+Lumpur" target="_blank" rel="noreferrer">Directions <span aria-hidden="true">↗</span></a></div></> : null}{inviteData?.afterPartyInvited && invitationToken ? <a className="after-party-reveal" href={`/after-party?token=${encodeURIComponent(invitationToken)}`}>A secret chapter awaits ✦</a> : null}<button className="text-button" type="button" onClick={() => scrollToSection("welcome")}>Return to the beginning ↑</button></div></section> : null}
    {submitted ? renderCustomPages("confirmation") : null}
  </main>;
}
