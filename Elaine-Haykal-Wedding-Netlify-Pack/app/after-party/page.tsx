import type { Metadata } from "next";
import { AfterPartyExperience } from "./AfterPartyExperience";

export const metadata: Metadata = {
  title: "A little secret",
  description: "An invitation for selected guests of Elaine and Haykal.",
  robots: { index: false, follow: false },
};

export default function AfterPartyPage() {
  return <AfterPartyExperience />;
}
