import type { Metadata } from "next";
import { MemoriesExperience } from "./MemoriesExperience";
import "./memories.css";

export const metadata: Metadata = {
  title: "Memories",
  description: "Share photographs and films from Elaine and Haykal's wedding celebration.",
};

export default function MemoriesPage() {
  return <MemoriesExperience />;
}
