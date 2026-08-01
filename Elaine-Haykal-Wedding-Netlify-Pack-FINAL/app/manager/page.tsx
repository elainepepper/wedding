import type { Metadata } from "next";
import { ManagerGate } from "./ManagerGate";
import "./manager.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guest Manager", robots: { index: false, follow: false } };

export default function ManagerPage() {
  return <ManagerGate />;
}
