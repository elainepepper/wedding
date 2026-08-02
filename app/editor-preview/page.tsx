import { notFound } from "next/navigation";
import { WebsiteEditorDemo } from "../manager/WebsiteEditor";
import "../manager/manager.css";

export const dynamic = "force-dynamic";

export default function EditorPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <WebsiteEditorDemo />;
}
