import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

export const WEDDING_ID = "elaine-haykal-2026";

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return applicationDefault();

  const parsed = JSON.parse(raw) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing required service-account fields.");
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

export function plainValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString().replace("T", " ").slice(0, 19);
  if (Array.isArray(value)) return value.map(plainValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, plainValue(item)]));
  return value;
}

export function plainDoc(snapshot: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> {
  return { id: snapshot.data()?.id ?? snapshot.id, ...plainValue(snapshot.data()) as Record<string, unknown> };
}

export async function nextId(collection: string) {
  const counter = weddingRef.collection("counters").doc(collection);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(counter);
    const value = Number(snapshot.data()?.value ?? 0) + 1;
    transaction.set(counter, { value }, { merge: true });
    return value;
  });
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
