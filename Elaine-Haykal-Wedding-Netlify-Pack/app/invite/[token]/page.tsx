import type { Metadata } from "next";
import { WeddingExperience } from "../../WeddingExperience";

export const metadata: Metadata = {
  title: "Your invitation",
  description: "A personal invitation to celebrate Elaine and Haykal.",
  robots: { index: false, follow: false },
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <WeddingExperience invitationToken={token} />;
}
