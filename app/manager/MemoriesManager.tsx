"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Memory = {
  id: string;
  guestName: string;
  prompt: string;
  resourceType: "image" | "video";
  url: string;
  previewUrl: string;
  favouriteCount: number;
  hidden: boolean;
  createdAt: string | null;
};

type Filter = "all" | "visible" | "hidden";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function MemoriesManager({ authToken }: { authToken: string }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/memories/manage", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as { memories?: Memory[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Memories could not be loaded.");
      setMemories(result.memories || []);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Memories could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => memories.filter((memory) => filter === "all" || (filter === "visible" ? !memory.hidden : memory.hidden)), [filter, memories]);
  const contributors = useMemo(() => new Set(memories.map((memory) => memory.guestName.trim().toLowerCase())).size, [memories]);
  const favourites = useMemo(() => memories.reduce((total, memory) => total + memory.favouriteCount, 0), [memories]);

  const changeVisibility = async (memory: Memory) => {
    setBusyId(memory.id);
    setError("");
    try {
      const response = await fetch("/api/memories/manage", {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "visibility", id: memory.id, hidden: !memory.hidden }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "That memory could not be updated.");
      setMemories((current) => current.map((item) => item.id === memory.id ? { ...item, hidden: !item.hidden } : item));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That memory could not be updated.");
    } finally {
      setBusyId("");
    }
  };

  const downloadPng = async () => {
    try {
      const response = await fetch("/api/memories/qr");
      if (!response.ok) throw new Error();
      const svg = await response.text();
      const svgBlob = new Blob([svg], { type: "image/svg+xml" });
      const svgUrl = URL.createObjectURL(svgBlob);
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error());
        image.src = svgUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 1600;
      const context = canvas.getContext("2d");
      if (!context) throw new Error();
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(svgUrl);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!png) throw new Error();
      downloadBlob("haykal-elaine-memories-qr.png", png);
    } catch {
      setError("The PNG could not be prepared. The SVG download is still available.");
    }
  };

  return <div className="manager-page memories-manager-view">
    <section className="manager-page-intro">
      <p className="manager-kicker">Wedding-night gallery</p>
      <h2>Memories</h2>
      <p>Guests must enter their name before they can upload. New photographs and films appear in the shared gallery immediately; you can hide anything here without deleting it.</p>
    </section>

    <section className="memory-manager-stats" aria-label="Memory gallery summary">
      <article><strong>{memories.length}</strong><span>Uploads</span></article>
      <article><strong>{contributors}</strong><span>Named guests</span></article>
      <article><strong>{favourites}</strong><span>Favourites</span></article>
      <article><strong>{memories.filter((memory) => memory.hidden).length}</strong><span>Hidden</span></article>
    </section>

    <section className="memory-qr-panel">
      <img src="/api/memories/qr" alt="QR code opening haykalelaine.com/memories" />
      <div>
        <p className="manager-kicker">Print for the reception</p>
        <h3>Scan to share a memory</h3>
        <a href="https://haykalelaine.com/memories" target="_blank" rel="noreferrer">haykalelaine.com/memories ↗</a>
        <p>This is a fixed direct link. It does not rely on a paid QR service and will continue to work as long as this address remains live.</p>
        <div><a className="memory-manager-button" href="/api/memories/qr?download=1">Download SVG</a><button className="memory-manager-button secondary-button" type="button" onClick={() => void downloadPng()}>Download PNG</button></div>
      </div>
    </section>

    <div className="memory-manager-toolbar">
      <div role="group" aria-label="Filter memories">
        {(["all", "visible", "hidden"] as Filter[]).map((value) => <button key={value} type="button" className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
      </div>
      <button type="button" onClick={() => void load()}>Refresh</button>
    </div>

    {error ? <p className="memory-manager-error" role="alert">{error}</p> : null}
    {loading ? <p className="memory-manager-empty">Opening the gallery…</p> : null}
    {!loading && !visible.length ? <p className="memory-manager-empty">No memories in this view yet.</p> : null}
    {visible.length ? <section className="memory-manager-grid" aria-label="Uploaded memories">
      {visible.map((memory) => <article key={memory.id} className={memory.hidden ? "is-hidden" : ""}>
        <a href={memory.url} target="_blank" rel="noreferrer" aria-label={`Open memory uploaded by ${memory.guestName}`}>
          <img src={memory.previewUrl} alt="" loading="lazy" />
          {memory.resourceType === "video" ? <span aria-hidden="true">▶</span> : null}
        </a>
        <div><p>{memory.prompt}</p><strong>{memory.guestName}</strong><small>{memory.favouriteCount} favourite{memory.favouriteCount === 1 ? "" : "s"}</small><button type="button" disabled={busyId === memory.id} onClick={() => void changeVisibility(memory)}>{busyId === memory.id ? "Saving…" : memory.hidden ? "Show in gallery" : "Hide from gallery"}</button></div>
      </article>)}
    </section> : null}
  </div>;
}
