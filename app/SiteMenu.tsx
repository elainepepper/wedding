"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";

/**
 * A menu entry is either a real address or an action. Inside the RSVP the
 * sections of other steps are hidden, so an anchor has nothing to jump to —
 * those entries carry an onSelect that turns to the right step instead.
 */
export type MenuLink = { label: string; href?: string; onSelect?: () => void };

export function SiteMenu({ links }: { links: MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const linkKey = links.map((link) => link.label).join("|");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) toggleRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const firstLink = navRef.current?.querySelector<HTMLElement>("a, button");
    const focusFrame = window.requestAnimationFrame(() => firstLink?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        toggleRef.current,
        ...Array.from(
          navRef.current?.querySelectorAll<HTMLElement>("a, button") ?? [],
        ),
      ].filter((element): element is HTMLElement => Boolean(element));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Submission adds the confirmation destination. Close any menu that was
  // open while the request completed so it can never masquerade as an
  // intermediate confirmation screen.
  useEffect(() => setOpen(false), [linkKey]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className={`site-menu-button${open ? " is-open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="invitation-site-menu"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? "✕" : "Menu"}
      </button>
      <nav
        ref={navRef}
        id="invitation-site-menu"
        className={`site-menu-overlay${open ? " is-open" : ""}`}
        aria-label="Invitation sections"
        aria-hidden={!open}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        {links.map((link, index) => {
          const style = { "--i": index } as CSSProperties;
          if (link.onSelect) {
            return (
              <button
                type="button"
                key={link.label}
                style={style}
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  link.onSelect?.();
                  setOpen(false);
                }}
              >
                {link.label}
              </button>
            );
          }
          const href = link.href ?? "#";
          return href.startsWith("/") ? (
            <Link
              key={link.label}
              href={href}
              style={style}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ) : (
            <a
              key={link.label}
              href={href}
              style={style}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          );
        })}
      </nav>
    </>
  );
}
