"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
type GuestResponse = {
  id: number;
  name: string;
  rsvpStatus: "Confirmed" | "Declined" | "Pending";
  ceremonyAttending: boolean;
  receptionAttending: boolean;
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

function ChoiceButton({ selected, title, detail, onClick }: { selected: boolean; title: string; detail?: string; onClick: () => void }) {
  return <button type="button" className={`choice-card${selected ? " is-selected" : ""}`} aria-pressed={selected} onClick={onClick}><span className="choice-mark">{selected ? "✓" : ""}</span><strong>{title}</strong>{detail ? <small>{detail}</small> : null}</button>;
}

export function WeddingExperience({ invitationToken }: { invitationToken?: string }) {
  const [rsvp, setRsvp] = useState<RsvpState>(initialRsvp);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [guestResponses, setGuestResponses] = useState<GuestResponse[]>([]);
  const [inviteLoading, setInviteLoading] = useState(Boolean(invitationToken));
  const [inviteError, setInviteError] = useState("");
  const [activeSection, setActiveSection] = useState("welcome");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [music, setMusic] = useState<MusicSettings>({ musicUrl: null, musicTitle: null });
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site-settings", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<MusicSettings> : { musicUrl: null, musicTitle: null })
      .then((result) => { if (!cancelled) setMusic(result); })
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
        setRsvp((current) => ({ ...current, guestName: names || result.household.name, ...phone }));
        setGuestResponses(result.guests.map((guest) => ({
          id: guest.id,
          name: guest.preferred_name || `${guest.first_name} ${guest.last_name}`.trim(),
          rsvpStatus: guest.rsvp_status === "Confirmed" || guest.rsvp_status === "Declined" ? guest.rsvp_status : "Pending",
          ceremonyAttending: guest.ceremony_invited ? guest.rsvp_status !== "Declined" : false,
          receptionAttending: guest.reception_invited ? guest.rsvp_status !== "Declined" : false,
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
    const render = () => {
      frame = 0;
      const viewport = window.innerHeight || 1;
      let sceneIsMoving = false;
      document.querySelectorAll<HTMLElement>("[data-scene]").forEach((scene) => {
        const rect = scene.getBoundingClientRect();
        const scrollRange = Math.max(1, rect.height - viewport);
        const target = rect.height > viewport * 1.05
          ? Math.max(0, Math.min(1, -rect.top / scrollRange))
          : Math.max(0, Math.min(1, (viewport - rect.top) / (viewport + rect.height)));
        const previous = sceneProgress.get(scene) ?? target;
        const progress = reduceMotion.matches ? target : previous + (target - previous) * 0.16;
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
      pointerX += (targetX - pointerX) * (reduceMotion.matches ? 1 : 0.08);
      pointerY += (targetY - pointerY) * (reduceMotion.matches ? 1 : 0.08);
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
  }, [rsvp.attendance, submitted, inviteLoading]);

  const sectionIds = useMemo(() => {
    const ids = ["welcome", "invitation", "venue", "rsvp"];
    if (rsvp.attendance === "yes") ids.push("dress", "meal", "travel");
    ids.push("recommendations", "wishes");
    if (submitted) ids.push("confirmation");
    return ids;
  }, [rsvp.attendance, submitted]);

  const update = <K extends keyof RsvpState>(key: K, value: RsvpState[K]) => {
    setRsvp((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const updateGuest = (id: number, patch: Partial<GuestResponse>) => {
    setGuestResponses((current) => current.map((guest) => guest.id === id ? { ...guest, ...patch } : guest));
    setError("");
  };

  const validPhone = () => rsvp.phoneNumber.replace(/\D/g, "").length >= 7;

  const continueFromRsvp = () => {
    if (!invitationToken) return;
    if (!validPhone()) {
      setError("Please enter a valid mobile number so we can contact your invitation group.");
      return;
    }
    if (guestResponses.some((guest) => guest.rsvpStatus === "Pending")) {
      setError("Please reply for every named guest in this invitation.");
      return;
    }
    const anyConfirmed = guestResponses.some((guest) => guest.rsvpStatus === "Confirmed");
    update("attendance", anyConfirmed ? "yes" : "no");
    window.setTimeout(() => scrollToSection(anyConfirmed ? "dress" : "recommendations"), 80);
  };

  const continueFromMeal = () => {
    if (guestResponses.some((guest) => guest.rsvpStatus === "Confirmed" && !guest.mealSelection)) {
      setError("Please choose lamb or salmon for every attending guest.");
      return;
    }
    scrollToSection("travel");
  };

  const submitRsvp = async () => {
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
    if (rsvp.attendance === "yes") {
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
    }
    setSubmitting(true);
    setError("");
    try {
      const mobile = `${rsvp.countryCode}${rsvp.phoneNumber.replace(/\D/g, "")}`;
      const guests = guestResponses.map((guest) => ({
        ...guest,
        ceremonyAttending: guest.rsvpStatus === "Confirmed" && guest.ceremonyAttending,
        receptionAttending: guest.rsvpStatus === "Confirmed" && guest.receptionAttending,
        travelArrival: guest.rsvpStatus === "Confirmed" ? rsvp.arrivalDate : "",
        travelDeparture: guest.rsvpStatus === "Confirmed" ? rsvp.departureDate : "",
        accommodationRequired: guest.rsvpStatus === "Confirmed" && rsvp.roomAtHyatt === true,
        accommodationName: guest.rsvpStatus === "Confirmed" && rsvp.roomAtHyatt === false ? rsvp.accommodation : "",
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

  return <main className="wedding-shell wedding-shell--storybook">
    <a className="skip-experience" href="#rsvp">Skip the cinematic introduction</a>
    {music.musicUrl ? <><audio ref={audioRef} src={music.musicUrl} loop preload="none" onPause={() => setSoundEnabled(false)} onPlay={() => setSoundEnabled(true)} /><button type="button" className="sound-control" onClick={toggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? "Pause wedding music" : "Play wedding music"}><span aria-hidden="true">{soundEnabled ? "❚❚" : "♪"}</span><small>{soundEnabled ? "Pause" : "Play music"}</small>{music.musicTitle ? <em>{music.musicTitle}</em> : null}</button></> : null}
    <div className="scroll-progress" aria-hidden="true"><i style={{ height: `${((sectionIds.indexOf(activeSection) + 1) / sectionIds.length) * 100}%` }} /></div>
    <nav className="scene-nav" aria-label="Invitation sections">{sectionIds.map((id) => <button key={id} type="button" className={activeSection === id ? "is-active" : ""} onClick={() => scrollToSection(id)} aria-label={`Go to ${id}`} aria-current={activeSection === id ? "step" : undefined}><span /></button>)}</nav>

    <section id="welcome" className="scene scene--welcome scene--cinematic is-visible" data-scene aria-label="Wedding invitation introduction">
      <div className="cinematic-stage">
        <div className="cinematic-film-wash" aria-hidden="true" />
        <img className="cinematic-layer cinematic-layer--far" src="/wedding/decor/lace-ribbon-white.webp" alt="" aria-hidden="true" />
        <img className="cinematic-layer cinematic-layer--mid" src="/wedding/decor/lace-tape-white.webp" alt="" aria-hidden="true" />
        <img className="cinematic-layer cinematic-layer--left" src="/wedding/decor/ribbon-pink-sheer.webp" alt="" aria-hidden="true" />
        <img className="cinematic-layer cinematic-layer--right" src="/wedding/decor/lace-bow-white.webp" alt="" aria-hidden="true" />
        <div className="cinematic-portal" aria-hidden="true"><span /></div>
        <div className="cinematic-copy cinematic-copy--intro">
          <p className="eyebrow">Elaine &amp; Haykal &middot; 07.11.26</p>
          <h1>Hello,</h1>
          <div className="guest-name-label"><strong>{rsvp.guestName}</strong><em>!</em></div>
          <p>{inviteData ? `We would love for ${inviteData.household.name} to celebrate with us.` : "A celebration has been written in the stars."}</p>
        </div>
        <div className="cinematic-copy cinematic-copy--names" aria-hidden="true">
          <p className="eyebrow">Together with their families</p>
          <h2>Elaine <span>&amp;</span> Haykal</h2>
          <p>invite you into their next chapter</p>
        </div>
        <div className="cinematic-copy cinematic-copy--date">
          <p className="eyebrow">The wedding reception</p>
          <h2>7 November<br />2026</h2>
          <p>The Grand Salon &middot; Grand Hyatt Kuala Lumpur &middot; 6:30pm</p>
          <button className="primary-button" type="button" onClick={() => scrollToSection("invitation")}>Open the invitation <span aria-hidden="true">&darr;</span></button>
        </div>
        <p className="scroll-cue" aria-hidden="true"><span /> Scroll to enter the story</p>
      </div>
      <Sparkles /><div className="storybook-canopy" aria-hidden="true" /><div className="lantern lantern--one" aria-hidden="true">✦</div><div className="lantern lantern--two" aria-hidden="true">✦</div>
      <div className="corner-flourish corner-flourish--left" aria-hidden="true" /><div className="corner-flourish corner-flourish--right" aria-hidden="true" />
      <div className="depth-layer depth-layer--far" aria-hidden="true" /><div className="depth-layer depth-layer--mid" aria-hidden="true" /><div className="depth-layer depth-layer--front" aria-hidden="true" />
      <div className="scene-content hero-content reveal"><p className="eyebrow">Elaine &amp; Haykal · 07.11.26</p><div className="crescent" aria-hidden="true">☾</div><h1>Hello,</h1><div className="guest-name-label"><strong>{rsvp.guestName}</strong><em>!</em></div><p className="hero-note">{inviteData ? `We would love for ${inviteData.household.name} to celebrate with us.` : "A celebration has been written in the stars."}</p><button className="primary-button" type="button" onClick={() => scrollToSection("invitation")}>Enter the celebration <span aria-hidden="true">↓</span></button></div><p className="scroll-cue" aria-hidden="true">Scroll to unfold</p>
    </section>

    <section id="invitation" className="scene scene--invitation" data-scene><img className="scene-art scene-art--floral" src="/wedding/floral-frame.png" alt="" loading="lazy" aria-hidden="true" /><img className="scene-art floating-bloom floating-bloom--left" src="/wedding/pearl-floral.png" alt="" loading="lazy" aria-hidden="true" /><img className="scene-art floating-bloom floating-bloom--right" src="/wedding/pearl-floral.png" alt="" loading="lazy" aria-hidden="true" /><div className="scene-content invitation-card reveal"><p className="eyebrow">Together with their families</p><p className="invitation-line">You are joyfully invited to the wedding reception of</p><h2>Elaine <span>&amp;</span> Haykal</h2><RibbonDivider /><div className="event-details"><p><strong>Saturday</strong><span>7 November 2026</span></p><p><strong>6:30</strong><span>in the evening</span></p><p><strong>The Grand Salon</strong><span>Grand Hyatt Kuala Lumpur</span></p></div><button className="primary-button" type="button" onClick={() => scrollToSection("venue")}>Plan your journey <span aria-hidden="true">↓</span></button></div></section>

    <section id="venue" className="scene scene--venue" data-scene><div className="venue-map" aria-label="Map showing Grand Hyatt Kuala Lumpur"><iframe title="Map to Grand Hyatt Kuala Lumpur" src="https://www.google.com/maps?q=Grand+Hyatt+Kuala+Lumpur,+12+Jalan+Pinang,+Kuala+Lumpur&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div><div className="scene-content venue-card reveal"><p className="step-label">The destination</p><h2>The Grand Salon</h2><p className="venue-address">Level 1, Grand Hyatt Kuala Lumpur<br />12 Jalan Pinang, 50450 Kuala Lumpur</p><div className="arrival-grid"><article><span>01</span><h3>By MRT</h3><p>Take the Putrajaya Line to Conlay MRT. Use Entrance A and continue along Jalan Kia Peng toward the KL Convention Centre and hotel.</p></article><article><span>02</span><h3>By car</h3><p>Drive to the Grand Hyatt entrance on Jalan Pinang. Guest parking is available in the hotel’s underground parking.</p></article><article><span>03</span><h3>By Grab</h3><p>Set your destination to “Grand Hyatt Kuala Lumpur” and ask to be dropped at the main hotel lobby.</p></article></div><a className="primary-button map-button" href="https://www.google.com/maps/dir/?api=1&destination=Grand+Hyatt+Kuala+Lumpur,+12+Jalan+Pinang,+50450+Kuala+Lumpur" target="_blank" rel="noreferrer">Open directions <span aria-hidden="true">↗</span></a><button className="text-button" type="button" onClick={() => scrollToSection("rsvp")}>Continue to RSVP ↓</button></div></section>

    <section id="rsvp" className="scene scene--paper" data-scene><img className="scene-art scene-art--dinner" src="/wedding/dinner-table.png" alt="A hand-drawn wedding reception table" loading="lazy" /><div className="scene-content form-card reveal"><p className="step-label">01 · Your reply</p><h2>Will you join us?</h2>{invitationToken ? <><p className="section-intro">Only the named adults below may RSVP. No children or additional guests can be added.</p><div className="field-grid phone-grid"><label><span>Country code *</span><select value={rsvp.countryCode} onChange={(event) => update("countryCode", event.target.value)} aria-label="Country calling code">{countryCodes.map(([country, code]) => <option key={`${country}-${code}`} value={code}>{country} ({code})</option>)}</select></label><label><span>Mobile number *</span><input required value={rsvp.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value)} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="12 345 6789" maxLength={24} /></label></div><div className="party-rsvp-list">{guestResponses.map((guest) => <fieldset key={guest.id}><legend>{guest.name}</legend><div className="segmented-control"><button type="button" className={guest.rsvpStatus === "Confirmed" ? "is-selected" : ""} onClick={() => updateGuest(guest.id, { rsvpStatus: "Confirmed", receptionAttending: true })}>Joyfully accepts</button><button type="button" className={guest.rsvpStatus === "Declined" ? "is-selected" : ""} onClick={() => updateGuest(guest.id, { rsvpStatus: "Declined", receptionAttending: false, ceremonyAttending: false, mealSelection: "" })}>Sadly declines</button></div></fieldset>)}</div>{guestResponses.length > 1 ? <p className="help-note couple-note">Each invited partner may respond separately, so a husband or wife may attend the reception on their own.</p> : null}</> : <div className="invitation-only"><span aria-hidden="true">🔐</span><h3>Your personal link is your key</h3><p>RSVPs are available only through the unique invitation link sent by Elaine and Haykal. It shows exactly who is invited and does not allow children, plus-ones or additional guests.</p></div>}{error && activeSection === "rsvp" ? <p className="form-error" role="alert">{error}</p> : null}{invitationToken ? <button className="primary-button" type="button" onClick={continueFromRsvp}>Continue <span aria-hidden="true">→</span></button> : <button className="primary-button" type="button" onClick={() => scrollToSection("recommendations")}>Explore Kuala Lumpur <span aria-hidden="true">↓</span></button>}</div></section>

    {rsvp.attendance === "yes" ? <section id="dress" className="scene scene--blush" data-scene><img className="scene-art scene-art--wide-frame" src="/wedding/frame-wide.png" alt="" loading="lazy" aria-hidden="true" /><div className="scene-content dress-card reveal"><p className="step-label">02 · Dress code</p><p className="script-kicker">Dress for the moonlight</p><h2>Black tie</h2><RibbonDivider /><p>Formal evening wear, with a little shimmer if the mood takes you. Think romantic silhouettes, polished tailoring, and dancing shoes.</p><div className="swatches" aria-label="Suggested colour palette"><span style={{ background: "#efd3cb" }} title="Fairy pink" /><span style={{ background: "#dda8a5" }} title="Pastel pink" /><span style={{ background: "#dc9d96" }} title="Rhapsodic" /><span style={{ background: "#c07a86" }} title="Japanese coral" /><span style={{ background: "#38533d" }} title="Enchanted green" /></div><small className="palette-note">Pink is our mood, not a guest requirement.</small><button className="primary-button" type="button" onClick={() => scrollToSection("meal")}>Choose dinner <span aria-hidden="true">↓</span></button></div></section> : null}

    {rsvp.attendance === "yes" ? <section id="meal" className="scene scene--paper scene--meal" data-scene><img className="scene-art scene-art--feast" src="/wedding/feast-table.png" alt="A hand-drawn candlelit wedding feast" loading="lazy" /><div className="scene-content form-card reveal"><p className="step-label">03 · At the table</p><h2>Choose your main</h2><p className="section-intro">One delicious decision before the dancing begins.</p><div className="guest-meal-list">{guestResponses.filter((guest) => guest.rsvpStatus === "Confirmed").map((guest) => <fieldset key={guest.id}><legend>{guest.name}</legend><div className="choice-grid choice-grid--two meal-choices"><ChoiceButton selected={guest.mealSelection === "Salmon"} title="Seared Alaskan salmon" detail={salmonDescription} onClick={() => updateGuest(guest.id, { mealSelection: "Salmon" })} /><ChoiceButton selected={guest.mealSelection === "Lamb"} title="Almond dukkha-crusted lamb" detail={lambDescription} onClick={() => updateGuest(guest.id, { mealSelection: "Lamb" })} /></div><label className="full-field"><span>Dietary requirements or allergies</span><textarea value={[guest.dietaryRequirements, guest.allergies].filter(Boolean).join(" · ")} onChange={(event) => updateGuest(guest.id, { dietaryRequirements: event.target.value, allergies: "" })} placeholder={`Anything our kitchen should know for ${guest.name}?`} rows={2} maxLength={800} /></label></fieldset>)}</div>{error && activeSection === "meal" ? <p className="form-error" role="alert">{error}</p> : null}<button className="primary-button" type="button" onClick={continueFromMeal}>Continue <span aria-hidden="true">→</span></button></div></section> : null}

    {rsvp.attendance === "yes" ? <section id="travel" className="scene scene--pearl" data-scene><img className="scene-art scene-art--pearl" src="/wedding/pearl-floral.png" alt="" loading="lazy" aria-hidden="true" /><div className="scene-content form-card form-card--glass reveal"><p className="step-label">04 · Your journey</p><h2>Coming from afar?</h2><p className="section-intro">A few details to help us look after your invited party in Kuala Lumpur.</p><fieldset><legend>Is anyone in this invitation flying in?</legend><div className="segmented-control"><button type="button" className={rsvp.flyingIn === true ? "is-selected" : ""} onClick={() => update("flyingIn", true)}>Yes</button><button type="button" className={rsvp.flyingIn === false ? "is-selected" : ""} onClick={() => { update("flyingIn", false); update("roomAtHyatt", null); }}>No</button></div></fieldset>{rsvp.flyingIn ? <div className="slide-open travel-details"><fieldset><legend>Would your party like a room at Grand Hyatt?</legend><div className="segmented-control"><button type="button" className={rsvp.roomAtHyatt === true ? "is-selected" : ""} onClick={() => update("roomAtHyatt", true)}>Yes, please</button><button type="button" className={rsvp.roomAtHyatt === false ? "is-selected" : ""} onClick={() => update("roomAtHyatt", false)}>No, thank you</button></div></fieldset><div className="field-grid"><label><span>Arrival date</span><input type="date" value={rsvp.arrivalDate} onChange={(event) => update("arrivalDate", event.target.value)} /></label><label><span>Departure date</span><input type="date" value={rsvp.departureDate} onChange={(event) => update("departureDate", event.target.value)} /></label></div>{rsvp.roomAtHyatt === false ? <label className="full-field slide-open"><span>Where will you be staying?</span><input value={rsvp.accommodation} onChange={(event) => update("accommodation", event.target.value)} placeholder="Hotel or neighbourhood" maxLength={240} /></label> : null}{rsvp.roomAtHyatt === true ? <p className="help-note slide-open">We’ll use these dates to coordinate room availability and follow up by phone.</p> : null}</div> : null}{error && activeSection === "travel" ? <p className="form-error" role="alert">{error}</p> : null}<button className="primary-button" type="button" onClick={() => scrollToSection("recommendations")}>Taste Kuala Lumpur <span aria-hidden="true">↓</span></button></div></section> : null}

    <section id="recommendations" className="scene scene--recommendations" data-scene><div className="recommendation-glow" aria-hidden="true" /><div className="scene-content recommendations-card reveal"><p className="step-label">Elaine &amp; Haykal’s KL favourites</p><h2>Three delicious detours</h2><p className="section-intro">If you have time around the celebration, these are the flavours we would send you to first.</p><div className="recommendation-grid"><a href="https://www.google.com/maps/search/?api=1&query=Village+Park+Restaurant+Damansara+Utama" target="_blank" rel="noreferrer"><span>Haykal’s favourite</span><h3>Village Park Nasi Lemak</h3><p>Crisp ayam goreng, fragrant coconut rice and sambal worth the journey.</p><i>Open in Maps ↗</i></a><a href="https://www.google.com/maps/search/?api=1&query=Nyonya+Colors+Kuala+Lumpur" target="_blank" rel="noreferrer"><span>Local kueh</span><h3>Nyonya Colors</h3><p>A colourful stop for traditional kuih, comforting noodles and Malaysian sweets.</p><i>Open in Maps ↗</i></a><a href="https://www.google.com/maps/search/?api=1&query=Super+Kitchen+Chilli+Pan+Mee+Kuala+Lumpur" target="_blank" rel="noreferrer"><span>Elaine’s favourite</span><h3>Super Kitchen Chilli Pan Mee</h3><p>Springy noodles, poached egg and a fiery chilli mix—stir everything together.</p><i>Open in Maps ↗</i></a></div><button className="primary-button" type="button" onClick={() => scrollToSection("wishes")}>Leave a little wisdom <span aria-hidden="true">↓</span></button></div></section>

    <section id="wishes" className="scene scene--wishes" data-scene><img className="scene-art scene-art--tall-frame" src="/wedding/frame-tall.png" alt="" loading="lazy" aria-hidden="true" /><div className="scene-content wishes-card reveal"><p className="step-label">{rsvp.attendance === "yes" ? "05" : "02"} · From the heart</p><p className="script-kicker">A note for our next chapter</p><h2>Warm wishes &amp;<br />marriage advice</h2>{invitationToken ? <><label><span className="sr-only">Your wishes or marriage advice</span><textarea value={rsvp.wishes} onChange={(event) => update("wishes", event.target.value)} placeholder="Leave us a wish, a story, or your best piece of advice…" rows={6} maxLength={1500} /></label>{error && activeSection === "wishes" ? <p className="form-error" role="alert">{error}</p> : null}<button className="primary-button" type="button" onClick={submitRsvp} disabled={submitting || submitted}>{submitting ? "Sending with love…" : submitted ? "RSVP sent" : "Send our RSVP"}{!submitting && !submitted ? <span aria-hidden="true">♡</span> : null}</button><small className="privacy-note">Your details are used only to plan Elaine and Haykal’s celebration.</small></> : <div className="invitation-only compact"><p>Your personal invitation link unlocks the RSVP and wishes form.</p></div>}</div></section>

    {submitted ? <section id="confirmation" className="scene scene--confirmation" data-scene><Sparkles /><div className="scene-content confirmation-card reveal"><p className="eyebrow">It’s official</p><div className="wax-seal" aria-hidden="true">E<span>&amp;</span>H</div><h2>Thank you,<br />{rsvp.guestName || "dear guest"}.</h2><p>{rsvp.attendance === "yes" ? "Your place is saved. We can’t wait to celebrate, feast, and dance with you." : "We’ll miss you on the night, and we’re grateful to have your love with us from afar."}</p><RibbonDivider /><div className="confirmation-details"><span>7 November 2026</span><span>The Grand Salon · Grand Hyatt Kuala Lumpur</span></div>{inviteData?.afterPartyInvited && invitationToken ? <a className="after-party-reveal" href={`/after-party?token=${encodeURIComponent(invitationToken)}`}>A secret chapter awaits ✦</a> : null}<button className="text-button" type="button" onClick={() => scrollToSection("welcome")}>Return to the beginning ↑</button></div></section> : null}
  </main>;
}
