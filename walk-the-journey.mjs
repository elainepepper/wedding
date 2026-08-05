import { redirect } from "next/navigation";

// The separate welcome pages were an empty scroll between the archway and the
// invitation. Anyone landing here goes straight to the invitation.
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  redirect(t ? `/rsvp?t=${encodeURIComponent(t)}` : "/rsvp");
}
