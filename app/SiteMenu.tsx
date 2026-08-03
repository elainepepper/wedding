"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";

type MenuLink = { href: string; label: string };

/**
 * The fixed MENU button, top right, and the full-screen overlay it opens.
 * The button becomes an ✕ while the overlay is up; tapping a link, the ✕,
 * or the space around the links closes it. Escape works too.
 */
export function SiteMenu({ links }: { links: MenuLink[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`site-menu-button${open ? " is-open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? "✕" : "Menu"}
      </button>
      <nav
        className={`site-menu-overlay${open ? " is-open" : ""}`}
        aria-hidden={!open}
        onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
      >
        {links.map((link, index) =>
          link.href.startsWith("/") ? (
            <Link key={link.href} href={link.href} style={{ "--i": index } as CSSProperties} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ) : (
            <a key={link.href} href={link.href} style={{ "--i": index } as CSSProperties} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          )
        )}
      </nav>
    </>
  );
}
