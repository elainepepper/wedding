import { redirect } from "next/navigation";

// The short form of a personal link: haykalelaine.com/i/<token>
export default async function ShortInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/?t=${encodeURIComponent(token)}`);
}
