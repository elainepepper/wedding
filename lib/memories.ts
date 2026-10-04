export const MEMORIES_URL = "https://haykalelaine.com/memories";
export const MEMORIES_FOLDER = "elaine-haykal/memories";
export const MEMORIES_AFTER_DAYS = 30;

export const memoryPrompts = [
  { id: "with-couple", label: "A picture of you with Elaine & Haykal" },
  { id: "best-dressed", label: "Best-dressed guest — according to you" },
  { id: "table-portrait", label: "Your table family portrait" },
  { id: "best-candid", label: "The best candid moment" },
  { id: "hidden-detail", label: "A detail Elaine & Haykal might have missed" },
  { id: "favourite-look", label: "Your favourite look from the evening" },
  { id: "made-you-laugh", label: "The moment that made you laugh" },
  { id: "dance-floor", label: "Your dance-floor evidence" },
  { id: "sweetest-moment", label: "The sweetest moment you witnessed" },
  { id: "plate-or-drink", label: "Your favourite plate or drink" },
  { id: "worthy-of-framing", label: "A photograph worthy of framing" },
  { id: "last-photo", label: "The final photo on your camera roll tonight" },
] as const;

export type MemoryPromptId = typeof memoryPrompts[number]["id"];

export function memoryPrompt(id: unknown) {
  return memoryPrompts.find((prompt) => prompt.id === id) ?? null;
}

export function memoryUploadClose(weddingDate: unknown) {
  const date = typeof weddingDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(weddingDate) ? weddingDate : "2026-11-07";
  const weddingNight = new Date(`${date}T23:59:59+08:00`);
  return new Date(weddingNight.getTime() + MEMORIES_AFTER_DAYS * 86_400_000);
}

export function memoryUploadOpen(weddingDate: unknown, now = new Date()) {
  return now.getTime() <= memoryUploadClose(weddingDate).getTime();
}

export function memoryCloseLabel(weddingDate: unknown) {
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(memoryUploadClose(weddingDate));
}

export function optimisedMemoryUrl(url: string, type: string) {
  if (!url.startsWith("https://res.cloudinary.com/") || !url.includes("/upload/")) return url;
  if (type === "video") {
    return url.replace("/upload/", "/upload/so_0,c_fill,w_1000,h_1250,q_auto,f_jpg/").replace(/\.[a-z0-9]+(?:\?.*)?$/i, ".jpg");
  }
  return url.replace("/upload/", "/upload/c_limit,w_1400,h_1800,q_auto,f_auto/");
}
