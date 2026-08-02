"use client";

import { DragEvent, FormEvent, PointerEvent, useMemo, useState } from "react";
import {
  builtInArtwork,
  decorationLibrary,
  defaultSiteDesign,
  editableScenes,
  EditableScene,
  fontPairs,
  normaliseSiteDesign,
  SiteDecoration,
  SiteDesign,
} from "../../lib/site-design";

type Props = {
  initialDesign?: unknown;
  save?: (design: SiteDesign) => Promise<void>;
  upload?: (file: File) => Promise<string>;
  demo?: boolean;
};

const sceneNames: Record<EditableScene, string> = {
  welcome: "Landing", invitation: "Invitation", venue: "Venue", rsvp: "RSVP", dress: "Dress code", meal: "Meal", travel: "Travel", recommendations: "KL favourites", wishes: "Wishes", confirmation: "Confirmation",
};

function PreviewCopy({ design, scene }: { design: SiteDesign; scene: EditableScene }) {
  const c = design.content;
  if (scene === "welcome") return <><small>{c.heroKicker}</small><h2>{c.heroGreeting}<br /><i>guest!</i></h2><p>{c.heroNote}</p></>;
  if (scene === "invitation") return <><small>{c.familyLine}</small><p>{c.invitationLine}</p><h2>{c.brideName}<i>&amp;</i>{c.groomName}</h2><p>{c.eventDate} · {c.eventTime}<br />{c.venueName}</p></>;
  if (scene === "venue") return <><small>Where we shall celebrate</small><h2>{c.venueName}</h2><p>{c.venueAddress}</p></>;
  if (scene === "dress") return <><small>{c.dressKicker}</small><h2>{c.dressCode}</h2><p>{c.dressNote}</p><strong className="editor-dress-restriction">{c.dressRestriction}</strong></>;
  if (scene === "wishes") return <><small>{c.wishesKicker}</small><h2>{c.wishesHeading}</h2></>;
  return <><small>{sceneNames[scene]}</small><h2>{c.brideName} <i>&amp;</i> {c.groomName}</h2><p>Drag an illustration directly on this canvas, then refine it below.</p></>;
}

export function WebsiteEditor({ initialDesign, save, upload, demo = false }: Props) {
  const [design, setDesign] = useState(() => normaliseSiteDesign(initialDesign));
  const [scene, setScene] = useState<EditableScene>("invitation");
  const [selectedId, setSelectedId] = useState<string | null>(design.decorations.find((item) => item.scene === "invitation")?.id ?? null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("mobile");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [fileHover, setFileHover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadError, setUploadError] = useState("");
  const selected = design.decorations.find((item) => item.id === selectedId) ?? null;
  const selectedFont = fontPairs.find((pair) => pair.id === design.fontPair) ?? fontPairs[0];
  const sceneDecorations = useMemo(() => design.decorations.filter((item) => item.scene === scene), [design.decorations, scene]);
  const updateContent = (key: keyof SiteDesign["content"], value: string) => setDesign((current) => ({ ...current, content: { ...current.content, [key]: value } }));
  const updateDecoration = (id: string, patch: Partial<SiteDecoration>) => setDesign((current) => ({ ...current, decorations: current.decorations.map((item) => item.id === id ? { ...item, ...patch } : item) }));

  const placeDecoration = (src: string, name: string, x = 50, y = 50) => {
    const item: SiteDecoration = { id: `element-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, scene, src, x, y, width: 34, opacity: .82, rotation: 0, depth: 0, visible: true };
    setDesign((current) => ({ ...current, decorations: [...current.decorations, item] }));
    setSelectedId(item.id);
  };

  const addDecoration = () => placeDecoration(decorationLibrary[0].src, decorationLibrary[0].name);
  const removeDecoration = (id: string) => {
    setDesign((current) => ({ ...current, decorations: current.decorations.filter((item) => item.id !== id) }));
    setSelectedId(null);
  };
  const duplicateDecoration = (item: SiteDecoration) => {
    const copy = { ...item, id: `element-${Date.now()}`, name: `${item.name} copy`, x: Math.min(120, item.x + 4), y: Math.min(120, item.y + 4) };
    setDesign((current) => ({ ...current, decorations: [...current.decorations, copy] }));
    setSelectedId(copy.id);
  };

  const addFiles = async (files: File[], x = 50, y = 50) => {
    const requested = files.slice(0, 24);
    const accepted = requested.filter((file) => /^image\/(png|jpeg|webp)$/.test(file.type) && file.size <= 10 * 1024 * 1024);
    if (!accepted.length) {
      setUploadError("Choose PNG, JPG or WebP illustrations up to 10 MB each.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      for (let index = 0; index < accepted.length; index += 1) {
        const file = accepted[index];
        setUploadProgress(`Uploading ${index + 1} of ${accepted.length}…`);
        const src = demo ? URL.createObjectURL(file) : upload ? await upload(file) : "";
        if (!src) throw new Error("Cloudinary upload is not configured yet.");
        const offset = (index % 6) * 3;
        placeDecoration(src, file.name.replace(/\.[^.]+$/, ""), Math.min(110, x + offset), Math.min(110, y + offset));
      }
      if (accepted.length !== requested.length) setUploadError("Some files were skipped. Use PNG, JPG or WebP files no larger than 10 MB.");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The illustration could not be uploaded.");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const pointOnCanvas = (event: { clientX: number; clientY: number }, canvas: HTMLElement) => {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.max(-20, Math.min(120, ((event.clientX - rect.left) / rect.width) * 100)), y: Math.max(-20, Math.min(120, ((event.clientY - rect.top) / rect.height) * 100)) };
  };
  const moveElement = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingId) return;
    const point = pointOnCanvas(event, event.currentTarget);
    updateDecoration(draggingId, point);
  };
  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setFileHover(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (!files.length) return;
    const point = pointOnCanvas(event, event.currentTarget);
    void addFiles(files, point.x, point.y);
  };
  const nudgeSelected = (x: number, y: number) => {
    if (!selected) return;
    updateDecoration(selected.id, { x: Math.max(-20, Math.min(120, selected.x + x)), y: Math.max(-20, Math.min(120, selected.y + y)) });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (save) await save(design);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } finally { setSaving(false); }
  };

  return <form className="website-editor" onSubmit={submit}>
    <header className="editor-head"><div><p className="panel-kicker">Invitation studio</p><h2>Your wedding design atelier</h2><span>Write, upload and arrange your invitation with a simple drag-and-drop canvas.</span></div><div>{demo ? <em>Codex preview</em> : null}<a href="/" target="_blank" rel="noreferrer">Open website ↗</a><button type="submit" disabled={saving}>{saving ? "Publishing…" : saved ? "Saved ✓" : demo ? "Save preview" : "Publish changes"}</button></div></header>
    <div className="editor-layout">
      <aside className="editor-controls">
        <details open><summary>Wedding details</summary><div className="editor-fields">
          <label><span>Bride’s name</span><input value={design.content.brideName} onChange={(event) => updateContent("brideName", event.target.value)} /></label>
          <label><span>Groom’s name</span><input value={design.content.groomName} onChange={(event) => updateContent("groomName", event.target.value)} /></label>
          <label><span>Date shown</span><input value={design.content.eventDate} onChange={(event) => updateContent("eventDate", event.target.value)} /></label>
          <label><span>Time shown</span><input value={design.content.eventTime} onChange={(event) => updateContent("eventTime", event.target.value)} /></label>
          <label><span>Venue</span><input value={design.content.venueName} onChange={(event) => updateContent("venueName", event.target.value)} /></label>
          <label><span>Venue address</span><textarea rows={3} value={design.content.venueAddress} onChange={(event) => updateContent("venueAddress", event.target.value)} /></label>
        </div></details>
        <details><summary>Classy wording</summary><div className="editor-fields">
          <label><span>Landing label</span><input value={design.content.heroKicker} onChange={(event) => updateContent("heroKicker", event.target.value)} /></label>
          <label><span>Greeting</span><input value={design.content.heroGreeting} onChange={(event) => updateContent("heroGreeting", event.target.value)} /></label>
          <label><span>Landing note</span><textarea rows={3} value={design.content.heroNote} onChange={(event) => updateContent("heroNote", event.target.value)} /></label>
          <label><span>Family line</span><input value={design.content.familyLine} onChange={(event) => updateContent("familyLine", event.target.value)} /></label>
          <label><span>Invitation sentence</span><textarea rows={3} value={design.content.invitationLine} onChange={(event) => updateContent("invitationLine", event.target.value)} /></label>
          <label><span>Dress-code title</span><input value={design.content.dressCode} onChange={(event) => updateContent("dressCode", event.target.value)} /></label>
          <label><span>Dress-code introduction</span><input value={design.content.dressKicker} onChange={(event) => updateContent("dressKicker", event.target.value)} /></label>
          <label><span>Dress-code details</span><textarea rows={4} value={design.content.dressNote} onChange={(event) => updateContent("dressNote", event.target.value)} /></label>
          <label><span>Reserved bridal colours</span><textarea rows={3} value={design.content.dressRestriction} onChange={(event) => updateContent("dressRestriction", event.target.value)} /></label>
          <label><span>Wishes introduction</span><input value={design.content.wishesKicker} onChange={(event) => updateContent("wishesKicker", event.target.value)} /></label>
          <label><span>Wishes heading</span><input value={design.content.wishesHeading} onChange={(event) => updateContent("wishesHeading", event.target.value)} /></label>
        </div></details>
        <details open><summary>Typography</summary><div className="font-pair-list">{fontPairs.map((pair) => <article key={pair.id} className={design.fontPair === pair.id ? "is-active" : ""} style={{ "--pair-header": pair.headerFamily, "--pair-body": pair.bodyFamily } as React.CSSProperties}><button type="button" onClick={() => setDesign((current) => ({ ...current, fontPair: pair.id }))}><strong>{pair.name}</strong><b>Elaine &amp; Haykal</b><span>{pair.header} + {pair.body}</span></button><p><a href={pair.headerUrl} target="_blank" rel="noreferrer">Download {pair.header} ↗</a><a href={pair.bodyUrl} target="_blank" rel="noreferrer">Download {pair.body} ↗</a></p></article>)}</div></details>
        <details><summary>Original artwork</summary><div className="editor-builtins">{builtInArtwork.map((item) => { const shown = !design.hiddenBuiltIns.includes(item.id); return <label key={item.id}><span>{item.label}</span><button type="button" className={shown ? "is-on" : ""} role="switch" aria-checked={shown} onClick={() => setDesign((current) => ({ ...current, hiddenBuiltIns: shown ? [...current.hiddenBuiltIns, item.id] : current.hiddenBuiltIns.filter((id) => id !== item.id) }))}><i /></button></label>; })}</div></details>
        <details><summary>Motion</summary><div className="editor-fields"><label><span>Scroll smoothness</span><input type="range" min="0.05" max="0.2" step="0.01" value={design.motionDamping} onChange={(event) => setDesign({ ...design, motionDamping: Number(event.target.value) })} /><small>Lower is softer and more cinematic; 0.10 is recommended for phones.</small></label></div></details>
      </aside>

      <section className="editor-stage-panel">
        <div className="editor-stage-toolbar"><nav className="editor-scenes" aria-label="Preview a website chapter">{editableScenes.map((item) => <button type="button" key={item} className={scene === item ? "is-active" : ""} onClick={() => { setScene(item); setSelectedId(design.decorations.find((element) => element.scene === item)?.id ?? null); }}>{sceneNames[item]}</button>)}</nav><div className="editor-preview-mode" aria-label="Preview size"><button type="button" className={previewMode === "desktop" ? "is-active" : ""} onClick={() => setPreviewMode("desktop")}>▰ Desktop</button><button type="button" className={previewMode === "mobile" ? "is-active" : ""} onClick={() => setPreviewMode("mobile")}>▯ Mobile</button></div></div>
        <div className={`editor-canvas-viewport is-${previewMode}`}>
          <div className="editor-canvas-help"><strong>Position your artwork</strong><span>Drag it directly on the canvas. Select it for exact size, rotation and layer controls. Arrow keys nudge one step; Shift + arrow nudges five.</span></div>
          <div className={`editor-canvas editor-canvas--${scene}${fileHover ? " is-file-hover" : ""}`} style={{ "--preview-header": selectedFont.headerFamily, "--preview-body": selectedFont.bodyFamily } as React.CSSProperties} onPointerMove={moveElement} onPointerUp={() => setDraggingId(null)} onPointerCancel={() => setDraggingId(null)} onDragEnter={(event) => { event.preventDefault(); setFileHover(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFileHover(false); }} onDrop={dropFile}>
            {sceneDecorations.filter((item) => item.visible).sort((a, b) => a.depth - b.depth).map((item) => <button type="button" key={item.id} className={`editor-canvas-element${selectedId === item.id ? " is-selected" : ""}${draggingId === item.id ? " is-dragging" : ""}`} style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.width}%`, opacity: item.opacity, transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`, zIndex: item.depth + 4 }} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDraggingId(item.id); setSelectedId(item.id); }} onKeyDown={(event) => { const step = event.shiftKey ? 5 : 1; const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }; const move = moves[event.key]; if (move) { event.preventDefault(); updateDecoration(item.id, { x: Math.max(-20, Math.min(120, item.x + move[0])), y: Math.max(-20, Math.min(120, item.y + move[1])) }); } }} onClick={() => setSelectedId(item.id)} aria-label={`Move and edit ${item.name}`}><img src={item.src} alt="" /></button>)}
            <div className="editor-preview-copy"><PreviewCopy design={design} scene={scene} /></div>
            {fileHover ? <div className="editor-drop-overlay"><strong>Drop your illustration here</strong><span>It will be placed exactly at your pointer.</span></div> : null}
          </div>
        </div>
        <div className="element-toolbar"><div><h3>{sceneNames[scene]} illustrations</h3><span>{sceneDecorations.length} editable element{sceneDecorations.length === 1 ? "" : "s"} · drag directly on the canvas</span></div><div><label className={`editor-upload-button${uploading ? " is-loading" : ""}`}><input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) void addFiles(files); event.currentTarget.value = ""; }} />{uploading ? uploadProgress || "Uploading…" : "↑ Upload illustrations"}</label><button type="button" onClick={addDecoration}>＋ Add supplied art</button></div></div>
        {uploadError ? <p className="editor-upload-error" role="alert">{uploadError}</p> : null}
        <div className="element-chips">{sceneDecorations.map((item) => <button type="button" key={item.id} className={selectedId === item.id ? "is-active" : ""} onClick={() => setSelectedId(item.id)}><img src={item.src} alt="" /><span>{item.name}</span></button>)}{!sceneDecorations.length ? <p>Drag a PNG, JPG or WebP onto the canvas, or choose “Add supplied art”.</p> : null}</div>
        {selected ? <section className="element-inspector"><header><input aria-label="Element name" value={selected.name} onChange={(event) => updateDecoration(selected.id, { name: event.target.value })} /><div><button type="button" onClick={() => duplicateDecoration(selected)}>Duplicate</button><button type="button" onClick={() => removeDecoration(selected.id)}>Remove</button></div></header><div className="element-quick-actions"><button type="button" onClick={() => nudgeSelected(-2, 0)}>← Left</button><button type="button" onClick={() => nudgeSelected(0, -2)}>↑ Up</button><button type="button" onClick={() => nudgeSelected(0, 2)}>↓ Down</button><button type="button" onClick={() => nudgeSelected(2, 0)}>Right →</button><button type="button" onClick={() => updateDecoration(selected.id, { x: 50, y: 50 })}>Centre</button><button type="button" onClick={() => updateDecoration(selected.id, { rotation: 0 })}>Straighten</button><button type="button" onClick={() => updateDecoration(selected.id, { depth: Math.max(-3, selected.depth - 1) })}>Send backward</button><button type="button" onClick={() => updateDecoration(selected.id, { depth: Math.min(3, selected.depth + 1) })}>Bring forward</button></div><div className="element-control-grid">
          <label><span>Artwork</span><select value={decorationLibrary.some((item) => item.src === selected.src) ? selected.src : "custom"} onChange={(event) => { if (event.target.value !== "custom") updateDecoration(selected.id, { src: event.target.value }); }}><option value="custom">Uploaded / Cloudinary</option>{decorationLibrary.map((item) => <option key={item.src} value={item.src}>{item.name}</option>)}</select></label>
          <label className="wide"><span>Image URL</span><input value={selected.src} onChange={(event) => updateDecoration(selected.id, { src: event.target.value })} /></label>
          <label><span>Horizontal · {Math.round(selected.x)}%</span><input type="range" min="-20" max="120" value={selected.x} onChange={(event) => updateDecoration(selected.id, { x: Number(event.target.value) })} /></label>
          <label><span>Vertical · {Math.round(selected.y)}%</span><input type="range" min="-20" max="120" value={selected.y} onChange={(event) => updateDecoration(selected.id, { y: Number(event.target.value) })} /></label>
          <label><span>Size · {Math.round(selected.width)}%</span><input type="range" min="5" max="140" value={selected.width} onChange={(event) => updateDecoration(selected.id, { width: Number(event.target.value) })} /></label>
          <label><span>Opacity · {Math.round(selected.opacity * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={selected.opacity} onChange={(event) => updateDecoration(selected.id, { opacity: Number(event.target.value) })} /></label>
          <label><span>Rotation · {Math.round(selected.rotation)}°</span><input type="range" min="-180" max="180" value={selected.rotation} onChange={(event) => updateDecoration(selected.id, { rotation: Number(event.target.value) })} /></label>
          <label><span>Layer · {selected.depth}</span><input type="range" min="-3" max="3" value={selected.depth} onChange={(event) => updateDecoration(selected.id, { depth: Number(event.target.value) })} /></label>
          <label className="element-visible"><input type="checkbox" checked={selected.visible} onChange={(event) => updateDecoration(selected.id, { visible: event.target.checked })} /><span>Show this illustration</span></label>
        </div></section> : null}
      </section>
    </div>
    {demo ? <p className="editor-demo-note">This Codex preview lets you try the full studio. On the deployed site, uploaded artwork is stored securely in Cloudinary and the published design is stored in Firestore.</p> : null}
  </form>;
}

export function WebsiteEditorDemo() {
  return <main className="manager-shell editor-demo-shell"><WebsiteEditor initialDesign={defaultSiteDesign} demo /></main>;
}
