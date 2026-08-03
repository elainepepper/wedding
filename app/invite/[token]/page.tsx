import { redirect } from "next/navigation";

// Personal links have always looked like /invite/<token>. They still work:
// they simply carry the guest to the RSVP at its new address.
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/rsvp?t=${encodeURIComponent(token)}`);
}
