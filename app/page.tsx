import { redirect } from "next/navigation";

// The front door is the invitation itself.
export default function Home() {
  redirect("/welcome");
}
