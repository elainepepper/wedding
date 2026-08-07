"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";

/**
 * A menu entry is either a real address or an action. Inside the RSVP the
 * sections of other steps are hidden, so an anchor has nothing to jump to —
 * those entries carry an onSelect that turns to the right step instead.
 */
export type MenuLink = { label: string; href?: string; onSelect?: () => void };

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
        {links.map((link, index) => {
          const style = { "--i": index } as CSSProperties;
          if (link.onSelect) {
            return (
              <button
                type="button"
                key={link.label}
                style={style}
                onClick={() => { link.onSelect?.(); setOpen(false); }}
              >
                {link.label}
              </button>
            );
          }
          const href = link.href ?? "#";
          return href.startsWith("/") ? (
            <Link key={link.label} href={href} style={style} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ) : (
            <a key={link.label} href={href} style={style} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          );
        })}
      </nav>
    </>
  );
}
