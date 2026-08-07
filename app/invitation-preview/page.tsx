import type { Metadata } from "next";
import { WeddingExperience } from "../WeddingExperience";

export const metadata: Metadata = {
  title: "Invitation preview",
  description: "A safe preview of the complete wedding invitation journey.",
  robots: { index: false, follow: false },
};

export default function InvitationPreviewPage() {
  return <WeddingExperience previewMode />;
}
