import { redirect } from "next/navigation";

/**
 * A personal link with the guest's name in it, for links pasted into a
 * message where a bare code would be confusing:
 *
 *   haykalelaine.com/i/9f3k2p/aisyah-and-daniel
 *
 * The name is decoration — only the token is read. That means a guest can
 * even edit or drop the name and the link still works.
 */
export default async function NamedInvitationPage({ params }: { params: Promise<{ token: string; name: string }> }) {
  const { token } = await params;
  redirect(`/?t=${encodeURIComponent(token)}`);
}
