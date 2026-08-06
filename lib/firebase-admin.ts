import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

export const WEDDING_ID = "elaine-haykal-2026";

let firebaseAdminConfigurationError = "";

function normaliseServiceAccountValue(value: string) {
  let raw = value.trim();

  // Be forgiving when a value was copied from a .env file or a Markdown code
  // block into Netlify instead of copying only the JSON value.
  raw = raw.replace(/^FIREBASE_SERVICE_ACCOUNT_JSON\s*=\s*/i, "").trim();
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith("`") && raw.endsWith("`"))) {
    raw = raw.slice(1, -1).trim();
  }

  // Some environment-variable screens wrap the complete JSON in a JSON
  // string. Decode that outer layer before parsing the service account.
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      const decoded = JSON.parse(raw);
      if (typeof decoded === "string") raw = decoded.trim();
    } catch {
      // Leave it untouched so the clearer validation error below is used.
    }
  }

  return raw;
}

function serviceAccount() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  const supplied = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (!encoded && !supplied) {
    firebaseAdminConfigurationError = "FIREBASE_SERVICE_ACCOUNT_JSON is missing in Netlify.";
    return applicationDefault();
  }

  let raw = supplied ? normaliseServiceAccountValue(supplied) : "";
  if (!raw && encoded) {
    try {
      raw = Buffer.from(encoded, "base64").toString("utf8").trim();
    } catch {
      firebaseAdminConfigurationError = "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 is not valid Base64.";
      return applicationDefault();
    }
  }

  let parsed: {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    firebaseAdminConfigurationError = "FIREBASE_SERVICE_ACCOUNT_JSON is incomplete or is not valid JSON. Copy the complete file from its first { to its final } into the Netlify value field.";
    return applicationDefault();
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    firebaseAdminConfigurationError = "FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key.";
    return applicationDefault();
  }

  return cert({
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  });
}

const app = getApps()[0] ?? initializeApp({
  credential: serviceAccount(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
});

export const adminAuth = getAuth(app);
export const firestore = getFirestore(app);
export const serverTimestamp = FieldValue.serverTimestamp;
export const weddingRef = firestore.collection("weddings").doc(WEDDING_ID);

export function assertFirebaseAdminConfigured() {
  if (firebaseAdminConfigurationError) throw new Error(firebaseAdminConfigurationError);
}

export function plainValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString().replace("T", " ").slice(0, 19);
  if (Array.isArray(value)) return value.map(plainValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, plainValue(item)]));
  return value;
}

export function plainDoc(snapshot: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> {
  return { id: snapshot.data()?.id ?? snapshot.id, ...plainValue(snapshot.data()) as Record<string, unknown> };
}

export async function nextId(collection: string, reserve = 1) {
  // Reserving a block of ids in one transaction lets an import allocate every
  // id it needs up front instead of a round-trip per row.
  const counter = weddingRef.collection("counters").doc(collection);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(counter);
    const current = Number(snapshot.data()?.value ?? 0);
    const first = current + 1;
    transaction.set(counter, { value: current + Math.max(1, reserve) }, { merge: true });
    return first;
  });
}

// Twelve characters from a 32-letter alphabet — around 60 bits, which is far
// beyond guessing for a guest list of this size, and short enough to read
// aloud. Ambiguous characters (i, l, o, 0, 1) are left out so a token can be
// typed by hand from a screenshot without confusion.
const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join("");
}
