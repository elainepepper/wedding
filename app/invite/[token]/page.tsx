import { redirect } from "next/navigation";

// Personal links have always looked like /invite/<token>. They still work,
// arriving at the archway with the invitation held in the address.
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/?t=${encodeURIComponent(token)}`);
}
