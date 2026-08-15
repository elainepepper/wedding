import type { Metadata } from "next";
import { WeddingExperience } from "../WeddingExperience";

export const metadata: Metadata = {
  title: "Invitation preview",
  description: "A safe preview of the complete wedding invitation journey, including the after-party chapter.",
  robots: { index: false, follow: false },
};

// The address guests never see: the whole journey on sample data, so the
// experience can be reviewed end to end without a personal invitation link.
export default function PreviewPage() {
  return <WeddingExperience previewMode />;
}
