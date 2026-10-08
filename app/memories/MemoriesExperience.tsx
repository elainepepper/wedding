"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { memoryPrompts } from "../../lib/memories";
import { readToken } from "../invite-token";

type Prompt = { id: string; label: string };
type Memory = {
  id: string; guestName: string; promptId: string; prompt: string; resourceType: "image" | "video";
  url: string; previewUrl: string; width: number; height: number; duration: number; favouriteCount: number; createdAt: string | null;
};
type GalleryResponse = { uploadOpen: boolean; uploadConfigured: boolean; uploadCloseLabel: string; prompts: Prompt[]; memories: Memory[] };

const visitorStorageKey = "eh-memories-visitor";
const favouritesStorageKey = "eh-memories-favourites";
const fallbackPrompts: Prompt[] = memoryPrompts.map(({ id, label }) => ({ id, label }));

function readStorage(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* Safari private mode can deny storage. */ }
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 30);
}

function cloudinaryDownload(url: string) {
  return url.includes("/upload/") ? url.replace("/upload/", "/upload/fl_attachment/") : url;
}

function relativeTime(value: string | null) {
  if (!value) return "Just now";
  const date = new Date(value.replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? "" : "Z"));
  if (Number.isNaN(date.getTime())) return "Recently";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(date);
}

function uploadCloudinary(url: string, body: FormData, onProgress: (percent: number) => void) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onerror = () => reject(new Error("The upload was interrupted."));
    request.onload = () => {
      try {
        const data = JSON.parse(request.responseText) as Record<string, unknown>;
        if (request.status >= 200 && request.status < 300) resolve(data);
        else reject(new Error(String((data.error as { message?: string } | undefined)?.message || "The upload could not be completed.")));
      } catch { reject(new Error("The upload service returned an unreadable response.")); }
    };
    request.send(body);
  });
}

export function MemoriesExperience() {
  const [gallery, setGallery] = useState<GalleryResponse>({ uploadOpen: true, uploadConfigured: false, uploadCloseLabel: "7 December 2026", prompts: fallbackPrompts, memories: [] });
  const [name, setName] = useState("");
  const [promptId, setPromptId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [sort, setSort] = useState<"newest" | "favourites">("newest");
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<Memory | null>(null);
  const [returnHref, setReturnHref] = useState("/");
  const fileInput = useRef<HTMLInputElement>(null);
  const lightboxClose = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const load = useCallback(async (quiet = false) => {
    try {
      const response = await fetch(`/api/memories?at=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as GalleryResponse;
      setGallery({ ...data, prompts: data.prompts?.length ? data.prompts : fallbackPrompts });
    } catch { if (!quiet) setError("The gallery is taking a moment to open. Please try again."); }
  }, []);

  useEffect(() => {
    try { setFavourites(new Set(JSON.parse(readStorage(favouritesStorageKey) || "[]") as string[])); } catch { /* empty set */ }
    if (!readStorage(visitorStorageKey)) writeStorage(visitorStorageKey, randomId());
    const invitationToken = readToken();
    if (invitationToken) setReturnHref(`/rsvp?t=${encodeURIComponent(invitationToken)}`);
    void load();
  }, [load]);

  useEffect(() => {
    if (!lightbox) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lightboxClose.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      lastFocus.current?.focus();
    };
  }, [lightbox]);

  useEffect(() => {
    const interval = window.setInterval(() => { if (!document.hidden) void load(true); }, 15_000);
    const visible = () => { if (!document.hidden) void load(true); };
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", visible); };
  }, [load]);

  const displayed = useMemo(() => [...gallery.memories].sort((a, b) => sort === "favourites" ? b.favouriteCount - a.favouriteCount : String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))), [gallery.memories, sort]);

  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    setError("");
    const selected = Array.from(event.target.files ?? []);
    const accepted = selected.filter((file) => {
      const video = file.type.startsWith("video/") || /\.(mov|mp4|m4v)$/i.test(file.name);
      const image = file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
      const limit = video ? 95 * 1024 * 1024 : 30 * 1024 * 1024;
      return (video || image) && file.size > 0 && file.size <= limit;
    });
    const messages: string[] = [];
    if (accepted.length !== selected.length) messages.push("Some files were skipped because they were not supported or were too large.");
    if (accepted.length > 12) messages.push("Only the first 12 memories were selected.");
    if (messages.length) setError(messages.join(" "));
    setFiles(accepted.slice(0, 12));
  };

  const surprise = () => {
    if (!gallery.prompts.length) return;
    const current = Math.max(0, gallery.prompts.findIndex((prompt) => prompt.id === promptId));
    const offset = Math.floor(Math.random() * Math.max(1, gallery.prompts.length - 1)) + 1;
    setPromptId(gallery.prompts[(current + offset) % gallery.prompts.length].id);
  };

  const upload = async () => {
    const guestName = name.trim();
    if (!guestName) { setError("Please enter your name before sharing a memory."); return; }
    if (!promptId) { setError("Please choose a prompt."); return; }
    if (!files.length) { fileInput.current?.click(); return; }
    setBusy(true); setError(""); setStatus(""); setProgress(0);
    const visitorId = readStorage(visitorStorageKey) || randomId();
    writeStorage(visitorStorageKey, visitorId);
    let completed = 0;
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const resourceType = file.type.startsWith("video/") || /\.(mov|mp4|m4v)$/i.test(file.name) ? "video" : "image";
        setStatus(`Sharing ${index + 1} of ${files.length}…`);
        const signatureResponse = await fetch("/api/memories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "signature", guestName, promptId, visitorId, resourceType, bytes: file.size }) });
        const signature = await signatureResponse.json() as Record<string, unknown>;
        if (!signatureResponse.ok) throw new Error(String(signature.error || "The upload could not begin."));
        const form = new FormData();
        form.append("file", file);
        form.append("api_key", String(signature.apiKey));
        form.append("timestamp", String(signature.timestamp));
        form.append("signature", String(signature.signature));
        form.append("allowed_formats", String(signature.allowedFormats));
        form.append("overwrite", "false");
        form.append("public_id", String(signature.publicId));
        const uploadType = signature.resourceType === "video" ? "video" : "image";
        const uploaded = await uploadCloudinary(`https://api.cloudinary.com/v1_1/${encodeURIComponent(String(signature.cloudName))}/${uploadType}/upload`, form, (fileProgress) => setProgress(Math.round(((index + fileProgress / 100) / files.length) * 100)));
        const finalise = await fetch("/api/memories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          action: "finalise", guestName, promptId,
          publicId: uploaded.public_id, version: String(uploaded.version), responseSignature: uploaded.signature,
          secureUrl: uploaded.secure_url, resourceType: uploaded.resource_type, format: uploaded.format,
          width: uploaded.width, height: uploaded.height, duration: uploaded.duration, bytes: uploaded.bytes,
        }) });
        const saved = await finalise.json() as { error?: string };
        if (!finalise.ok) throw new Error(saved.error || "The memory was uploaded but could not be added to the gallery.");
        completed += 1;
      }
      setStatus(files.length === 1 ? "Your memory is now part of the evening." : `${files.length} memories are now part of the evening.`);
      setFiles([]); setProgress(100);
      if (fileInput.current) fileInput.current.value = "";
      await load(true);
      document.getElementById("memory-gallery")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "The upload could not be completed. Please try again.";
      const remaining = files.slice(completed);
      setFiles(remaining);
      setError(completed ? `${completed} memor${completed === 1 ? "y was" : "ies were"} shared successfully. ${message} Only the remaining files will be retried.` : message);
      if (completed) await load(true);
    } finally { setBusy(false); }
  };

  const toggleFavourite = async (memory: Memory) => {
    const visitorId = readStorage(visitorStorageKey) || randomId();
    writeStorage(visitorStorageKey, visitorId);
    const next = !favourites.has(memory.id);
    const optimistic = new Set(favourites);
    if (next) optimistic.add(memory.id); else optimistic.delete(memory.id);
    setFavourites(optimistic);
    writeStorage(favouritesStorageKey, JSON.stringify([...optimistic]));
    setGallery((current) => ({ ...current, memories: current.memories.map((item) => item.id === memory.id ? { ...item, favouriteCount: Math.max(0, item.favouriteCount + (next ? 1 : -1)) } : item) }));
    try {
      const response = await fetch("/api/memories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "favourite", memoryId: memory.id, visitorId, favourite: next }) });
      if (!response.ok) throw new Error();
      const result = await response.json() as { favouriteCount: number };
      setGallery((current) => ({ ...current, memories: current.memories.map((item) => item.id === memory.id ? { ...item, favouriteCount: result.favouriteCount } : item) }));
    } catch { setError("That favourite could not be saved. Please try again."); }
  };

  return <main className="memories-page">
    <header className="memories-hero">
      <a href="/" className="memories-monogram">E <i>&amp;</i> H</a>
      <p className="memories-kicker">7 November 2026 · Kuala Lumpur</p>
      <h1>Memories<br /><em>from the night</em></h1>
      <p>Show us the celebration through your eyes. Choose a little prompt, share what you captured, and watch the evening unfold together.</p>
      <a href="#share-memory" className="memories-primary">Share a memory ↓</a>
    </header>

    <section className="memory-upload" id="share-memory">
      <div className="memory-section-title"><p>01 · Your name</p><h2>Who are we thanking?</h2></div>
      <label className="memory-name"><span>Guest name · required</span><input required aria-required="true" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" maxLength={80} /></label>

      <div className="memory-section-title"><p>02 · Choose a prompt</p><h2>What did you notice?</h2><button type="button" onClick={surprise}>Surprise me ↻</button></div>
      <div className="memory-prompts">{gallery.prompts.map((prompt, index) => <button type="button" key={prompt.id} className={prompt.id === promptId ? "is-selected" : ""} onClick={() => setPromptId(prompt.id)}><i>{String(index + 1).padStart(2, "0")}</i><span>{prompt.label}</span><b aria-hidden="true">{prompt.id === promptId ? "✓" : "○"}</b></button>)}</div>

      <div className="memory-section-title"><p>03 · Add your memory</p><h2>Photographs, films &amp; Live Photos</h2></div>
      <label className="memory-picker">
        <input ref={fileInput} type="file" accept="image/*,video/*,.heic,.heif,.mov,.mp4,.m4v" multiple onChange={chooseFiles} disabled={!gallery.uploadOpen || !gallery.uploadConfigured || busy || !name.trim()} />
        <span>＋</span><strong>{files.length ? `${files.length} memor${files.length === 1 ? "y" : "ies"} selected` : "Choose from your camera roll"}</strong>
        <small>Up to 12 at once · photos under 30 MB · videos under 95 MB</small>
      </label>
      {files.length ? <div className="memory-file-list">{files.map((file) => <span key={`${file.name}-${file.lastModified}`}>{file.name}<small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span>)}</div> : null}
      {!gallery.uploadConfigured ? <p className="memory-closed">Photo uploads are still being prepared. The gallery will remain available here.</p> : null}
      {!gallery.uploadOpen ? <p className="memory-closed">Uploads closed on {gallery.uploadCloseLabel}. Every shared memory remains below.</p> : null}
      {error ? <p className="memory-error" role="alert">{error}</p> : null}
      {status ? <p className="memory-success" role="status">{status}</p> : null}
      {busy ? <div className="memory-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ width: `${progress}%` }} /><span>{progress}%</span></div> : null}
      <button className="memory-submit" type="button" disabled={busy || !gallery.uploadOpen || !gallery.uploadConfigured || !name.trim() || !promptId} onClick={() => void upload()}>{busy ? "Sharing your memories…" : "Share with Elaine & Haykal"}</button>
      <p className="memory-consent">By uploading, you confirm that you may share this photo or video with the couple and their wedding guests.</p>
    </section>

    <section className="memory-gallery" id="memory-gallery">
      <header><div><p className="memories-kicker">The evening, through your eyes</p><h2>Shared memories</h2><span>{gallery.memories.length} memor{gallery.memories.length === 1 ? "y" : "ies"} and counting</span></div><div className="memory-sort"><button type="button" className={sort === "newest" ? "is-selected" : ""} onClick={() => setSort("newest")}>Newest</button><button type="button" className={sort === "favourites" ? "is-selected" : ""} onClick={() => setSort("favourites")}>Most loved</button></div></header>
      {displayed.length ? <div className="memory-masonry">{displayed.map((memory) => <article key={memory.id} className={memory.resourceType === "video" ? "is-video" : ""}>
        <button type="button" className="memory-open" onClick={(event) => { lastFocus.current = event.currentTarget; setLightbox(memory); }} aria-label={`Open memory shared by ${memory.guestName}`}>
          <img src={memory.previewUrl} alt={`${memory.prompt}, shared by ${memory.guestName}`} loading="lazy" />
          {memory.resourceType === "video" ? <span className="memory-play" aria-hidden="true">▶</span> : null}
        </button>
        <div className="memory-caption"><p>{memory.prompt}</p><span>by {memory.guestName} · {relativeTime(memory.createdAt)}</span><div><button type="button" className={favourites.has(memory.id) ? "is-loved" : ""} onClick={() => void toggleFavourite(memory)} aria-label={`${favourites.has(memory.id) ? "Remove favourite from" : "Favourite"} ${memory.guestName}'s memory`}>♡ <b>{memory.favouriteCount}</b></button><a href={cloudinaryDownload(memory.url)} target="_blank" rel="noreferrer" aria-label="Download original">↓</a></div></div>
      </article>)}</div> : <div className="memory-empty"><span>♡</span><h3>The first memory is waiting.</h3><p>Share yours and begin the evening’s album.</p></div>}
    </section>

    <footer className="memories-footer"><p>Elaine <i>&amp;</i> Haykal</p><span>Every photograph becomes part of the story.</span><a href={returnHref}>Return to invitation ↑</a></footer>

    {lightbox ? <div className="memory-lightbox" role="dialog" aria-modal="true" aria-label={`Memory shared by ${lightbox.guestName}`} onMouseDown={(event) => { if (event.currentTarget === event.target) setLightbox(null); }}><button ref={lightboxClose} type="button" className="memory-lightbox-close" onClick={() => setLightbox(null)} aria-label="Close memory">×</button><div>{lightbox.resourceType === "video" ? <video src={lightbox.url} controls autoPlay playsInline /> : <img src={lightbox.url} alt={`${lightbox.prompt}, shared by ${lightbox.guestName}`} />}<footer><p>{lightbox.prompt}</p><span>Shared by {lightbox.guestName}</span><a href={cloudinaryDownload(lightbox.url)} target="_blank" rel="noreferrer">Download original ↓</a></footer></div></div> : null}
  </main>;
}
