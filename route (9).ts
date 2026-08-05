import type { Metadata } from "next";
import { WeddingExperience } from "../WeddingExperience";

export const metadata: Metadata = {
  title: "Your reply",
  description: "Reply to Elaine and Haykal’s invitation.",
  robots: { index: false, follow: false },
};

// The RSVP has its own address. A personal link carries its token in the query
// (/rsvp?t=…), so the page is reachable both ways.
export default async function RsvpPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return <WeddingExperience invitationToken={t} />;
}
