export const editableScenes = ["welcome", "invitation", "venue", "rsvp", "dress", "meal", "travel", "recommendations", "wishes", "confirmation"] as const;
export type EditableScene = (typeof editableScenes)[number];

// Chapters guests may hide. The RSVP journey (welcome, invitation, rsvp, meal,
// confirmation) stays mandatory so replies and menu choices can never break.
export const hideableScenes = ["venue", "dress", "travel", "recommendations", "wishes"] as const;

export type CustomPage = {
  id: string;
  title: string;
  kicker: string;
  body: string;
  afterScene: EditableScene;
};

export const decorationMotions = ["none", "float", "sway", "drift", "shimmer", "cursor"] as const;
export type DecorationMotion = (typeof decorationMotions)[number];

export type SiteDecoration = {
  id: string;
  name: string;
  scene: string; // an editable chapter id or a custom page id
  src: string;
  x: number;
  y: number;
  width: number;
  opacity: number;
  rotation: number;
  depth: number;
  visible: boolean;
  motion: DecorationMotion;
  motionStrength: number;
};

export type SiteContent = {
  heroKicker: string;
  heroGreeting: string;
  heroNote: string;
  familyLine: string;
  invitationLine: string;
  brideName: string;
  groomName: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress: string;
  dressKicker: string;
  dressCode: string;
  dressNote: string;
  dressRestriction: string;
  wishesKicker: string;
  wishesHeading: string;
};

export type SiteDesign = {
  content: SiteContent;
  decorations: SiteDecoration[];
  hiddenBuiltIns: string[];
  hiddenScenes: string[];
  customPages: CustomPage[];
  motionDamping: number;
  cursorMotion: boolean;
  fontPair: string;
};

// Locked design system: Cormorant Garamond + Montserrat, Playfair Display for
// hero display. No script fonts.
export const fontPairs = [
  {
    id: "playfair-cormorant",
    name: "French Editorial",
    header: "Playfair Display",
    body: "Cormorant Garamond",
    headerFamily: '"Playfair Display", Georgia, serif',
    bodyFamily: '"Cormorant Garamond", Georgia, serif',
    headerUrl: "https://fonts.google.com/specimen/Playfair+Display",
    bodyUrl: "https://fonts.google.com/specimen/Cormorant+Garamond",
  },
  {
    id: "cormorant-montserrat",
    name: "Quiet Gallery",
    header: "Cormorant Garamond",
    body: "Montserrat",
    headerFamily: '"Cormorant Garamond", Georgia, serif',
    bodyFamily: '"Montserrat", "Segoe UI", sans-serif',
    headerUrl: "https://fonts.google.com/specimen/Cormorant+Garamond",
    bodyUrl: "https://fonts.google.com/specimen/Montserrat",
  },
  {
    id: "playfair-montserrat",
    name: "Poster House",
    header: "Playfair Display",
    body: "Montserrat",
    headerFamily: '"Playfair Display", Georgia, serif',
    bodyFamily: '"Montserrat", "Segoe UI", sans-serif',
    headerUrl: "https://fonts.google.com/specimen/Playfair+Display",
    bodyUrl: "https://fonts.google.com/specimen/Montserrat",
  },
] as const;

export const decorationLibrary = [
  { name: "White lace bow", src: "/wedding/decor/lace-bow-white.webp" },
  { name: "White lace ribbon", src: "/wedding/decor/lace-ribbon-white.webp" },
  { name: "Pink sheer bow", src: "/wedding/decor/ribbon-pink-sheer.webp" },
  { name: "White lace tape", src: "/wedding/decor/lace-tape-white.webp" },
  { name: "French bow", src: "/wedding/decor/bow.webp" },
  { name: "Pearl floral", src: "/wedding/pearl-floral.png" },
  { name: "Floral arch", src: "/wedding/floral-frame.png" },
  { name: "Dinner table", src: "/wedding/dinner-table.png" },
  { name: "Feast table", src: "/wedding/feast-table.png" },
] as const;

export const builtInArtwork = [
  { id: "invitation-frame", label: "Invitation floral arch" },
  { id: "invitation-blooms", label: "Invitation side flowers" },
  { id: "dinner-table", label: "RSVP dinner table" },
  { id: "dress-frame", label: "Dress-code frame" },
  { id: "feast-table", label: "Meal feast table" },
  { id: "travel-floral", label: "Travel floral background" },
  { id: "wishes-lace", label: "Wishes lace" },
] as const;

export const defaultSiteDesign: SiteDesign = {
  content: {
    heroKicker: "Elaine & Haykal · 07.11.26",
    heroGreeting: "Hello,",
    heroNote: "A beautiful evening awaits, and it would mean the world to share it with you.",
    familyLine: "With the love and blessing of their families",
    invitationLine: "request the pleasure of your company at their wedding reception",
    brideName: "Elaine",
    groomName: "Haykal",
    eventDate: "7 November 2026",
    eventTime: "6:30pm",
    venueName: "The Grand Salon",
    venueAddress: "Level 1, Grand Hyatt Kuala Lumpur\n12 Jalan Pinang, 50450 Kuala Lumpur",
    dressKicker: "An evening in your finest",
    dressCode: "Black tie, in colour",
    dressNote: "We invite you to arrive in formal eveningwear, with colour and a touch of romance. Think graceful silhouettes, polished tailoring and shoes made for dancing.",
    dressRestriction: "Kindly avoid white, ivory, cream and beige — these shades are reserved for the bride.",
    wishesKicker: "A few words for our forever",
    wishesHeading: "Your wishes for our next chapter",
  },
  decorations: [
    { id: "invitation-lace-ribbon", name: "Invitation lace ribbon", scene: "invitation", src: "/wedding/decor/lace-ribbon-white.webp", x: 50, y: 12, width: 64, opacity: .34, rotation: 0, depth: -1, visible: true, motion: "float", motionStrength: .35 },
  ],
  hiddenBuiltIns: ["invitation-frame"],
  hiddenScenes: [],
  customPages: [],
  motionDamping: .1,
  cursorMotion: true,
  fontPair: "playfair-cormorant",
};

const legacyCopy: Partial<Record<keyof SiteContent, string>> = {
  heroNote: "A celebration has been written in the stars.",
  familyLine: "Together with their families",
  invitationLine: "You are joyfully invited to the wedding reception of",
  dressKicker: "Dress for the moonlight",
  dressCode: "Black tie",
  dressNote: "Formal evening wear, with a little shimmer if the mood takes you. Think romantic silhouettes, polished tailoring, and dancing shoes.",
  wishesKicker: "A note for our next chapter",
  wishesHeading: "Warm wishes & marriage advice",
};

const number = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};

export function normaliseSiteDesign(value: unknown): SiteDesign {
  if (!value || typeof value !== "object") return structuredClone(defaultSiteDesign);
  const source = value as Partial<SiteDesign>;
  const sourceContent = source.content && typeof source.content === "object" ? source.content as Partial<SiteContent> : {};
  const content = Object.fromEntries(Object.entries(defaultSiteDesign.content).map(([key, fallback]) => {
    const typedKey = key as keyof SiteContent;
    const candidate = typeof sourceContent[typedKey] === "string" ? sourceContent[typedKey] as string : fallback;
    return [key, legacyCopy[typedKey] === candidate ? fallback : candidate];
  })) as SiteContent;
  // Custom pages parse before decorations so artwork can be placed on them.
  const customPages: CustomPage[] = Array.isArray(source.customPages) ? source.customPages.slice(0, 6).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const page = item as Partial<CustomPage>;
    const title = typeof page.title === "string" && page.title.trim() ? page.title.trim().slice(0, 80) : `Our page ${index + 1}`;
    return [{
      id: typeof page.id === "string" && /^custom-[a-z0-9-]{1,40}$/.test(page.id) ? page.id : `custom-page-${index + 1}`,
      title,
      kicker: typeof page.kicker === "string" ? page.kicker.trim().slice(0, 120) : "",
      body: typeof page.body === "string" ? page.body.trim().slice(0, 1500) : "",
      afterScene: editableScenes.includes(page.afterScene as EditableScene) ? page.afterScene as EditableScene : "recommendations",
    }];
  }) : defaultSiteDesign.customPages;
  const customPageIds = new Set(customPages.map((page) => page.id));
  const hiddenScenes = Array.isArray(source.hiddenScenes) ? source.hiddenScenes.filter((item): item is string => typeof item === "string" && hideableScenes.includes(item as never)) : defaultSiteDesign.hiddenScenes;
  const decorations = Array.isArray(source.decorations) ? source.decorations.slice(0, 60).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const decoration = item as Partial<SiteDecoration>;
    const scene = editableScenes.includes(decoration.scene as EditableScene) || customPageIds.has(decoration.scene as string) ? decoration.scene as string : "invitation";
    const src = typeof decoration.src === "string" && (decoration.src.startsWith("/wedding/") || decoration.src.startsWith("https://res.cloudinary.com/")) ? decoration.src : decorationLibrary[0].src;
    return [{
      id: typeof decoration.id === "string" && decoration.id ? decoration.id.slice(0, 80) : `element-${index + 1}`,
      name: typeof decoration.name === "string" && decoration.name ? decoration.name.slice(0, 100) : `Element ${index + 1}`,
      scene, src,
      x: number(decoration.x, 50, -20, 120), y: number(decoration.y, 50, -20, 120), width: number(decoration.width, 35, 5, 140),
      opacity: number(decoration.opacity, .5, 0, 1), rotation: number(decoration.rotation, 0, -180, 180), depth: number(decoration.depth, 0, -3, 3),
      visible: decoration.visible !== false,
      motion: decorationMotions.includes(decoration.motion as DecorationMotion) ? decoration.motion as DecorationMotion : "none",
      motionStrength: number(decoration.motionStrength, .5, 0, 1),
    }];
  }) : defaultSiteDesign.decorations;
  const allowedBuiltIns = new Set(builtInArtwork.map((item) => item.id));
  const hiddenBuiltIns = Array.isArray(source.hiddenBuiltIns) ? source.hiddenBuiltIns.filter((item): item is string => typeof item === "string" && allowedBuiltIns.has(item as never)) : defaultSiteDesign.hiddenBuiltIns;
  const fontPair = fontPairs.some((pair) => pair.id === source.fontPair) ? source.fontPair as string : defaultSiteDesign.fontPair;
  return { content, decorations, hiddenBuiltIns, hiddenScenes, customPages, motionDamping: number(source.motionDamping, .1, .05, .24), cursorMotion: source.cursorMotion !== false, fontPair };
}
