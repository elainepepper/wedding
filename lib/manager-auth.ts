import { adminAuth, weddingRef } from "./firebase-admin";

export type AdminIdentity = { uid: string; displayName: string; email: string; role: "owner" | "partner" | "planner" };

export async function requireAdmin(request: Request): Promise<AdminIdentity | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return null;
  try {
    // Standard verification validates the signature, audience, issuer and
    // expiry without requiring a second Identity Toolkit lookup. The extra
    // revoked-token lookup can fail on Netlify when the service-account IAM
    // permissions have not propagated yet, incorrectly rejecting the owner.
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email?.toLowerCase();
    if (!email) return null;
    const ownerEmail = (process.env.WEDDING_OWNER_EMAIL || "haykalelaine@gmail.com").toLowerCase();
    if (email === ownerEmail) return { uid: decoded.uid, email, displayName: decoded.name || email, role: "owner" };
    // Match on the email alone. Firestore drops any record missing a field
    // named in a where(), and "active" saved as 1 would never equal true —
    // either would silently lock a partner or planner out.
    const access = await weddingRef.collection("admins").where("email", "==", email).limit(1).get();
    if (access.empty) return null;
    const record = access.docs[0].data() as { name?: string; role?: "partner" | "planner"; active?: unknown };
    if (record.active === false || record.active === 0 || record.active === "false") return null;
    if (record.role !== "partner" && record.role !== "planner") return null;
    return { uid: decoded.uid, email, displayName: record.name || decoded.name || email, role: record.role };
  } catch {
    return null;
  }
}
