import type { Metadata } from "next";
import { TableReveal } from "./TableReveal";

export const metadata: Metadata = {
  title: "Your table",
  robots: { index: false, follow: false },
};

export default async function TablePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return <TableReveal token={t} />;
}
