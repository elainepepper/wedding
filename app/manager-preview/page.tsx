import type { Metadata } from "next";
import { ManagerPreview } from "./ManagerPreview";

export const metadata: Metadata = {
  title: "Guest manager preview",
  description: "A read-only walkthrough of the guest manager, populated with fictional guests.",
  robots: { index: false, follow: false },
};

export default function ManagerPreviewPage() {
  return <ManagerPreview />;
}
