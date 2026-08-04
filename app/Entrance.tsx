"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockedInvitation } from "./LockedInvitation";
import { readToken } from "./invite-token";

/**
 * The front door at haykalelaine.com.
 *
 * A guest whose invitation is known — either carried in the address or
 * remembered from earlier in the visit — is shown straight through to the
 * welcome. Anyone else stops here, and the page tells them nothing about the
 * day beyond the fact that invitations are personal.
 */
export function Entrance() {
  const router = useRouter();
  const [known, setKnown] = useState<boolean | null>(null);

  useEffect(() => {
    const token = readToken();
    if (token) {
      setKnown(true);
      router.replace(`/welcome?t=${encodeURIComponent(token)}`);
    } else {
      setKnown(false);
    }
  }, [router]);

  if (known !== false) return null;   // nothing flashes while we look
  return <LockedInvitation />;
}
