import type { Metadata } from "next";
import { WelcomeExperience } from "./WelcomeExperience";

export const metadata: Metadata = {
  title: "Elaine & Haykal — 7 November 2026",
  description: "You are invited to celebrate Elaine and Haykal at Grand Hyatt Kuala Lumpur.",
};

export default function WelcomePage() {
  return <WelcomeExperience />;
}
