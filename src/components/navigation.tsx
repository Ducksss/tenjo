"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
export function Navigation() {
  const path = usePathname();
  return (
    <header className="site-navigation">
      <Link href="/" className="site-brand" aria-label="Tenjo home">
        <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path
            d="M8 9h24M5 18h30M20 10v8c0 9-5 14-13 17M20 18c0 9 5 14 13 17"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <span>
          tenjō<span className="site-brand-dot">.</span>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        {[
          // Discovery holds the walkthrough and every drop; a drop's own page belongs to it.
          { href: "/", label: "Drops", within: ["/drops/"] },
          // Results covers everyone's record and your own history by code.
          { href: "/results", label: "Results", within: ["/codes/"] },
          { href: "/architecture", label: "How it’s built", within: [] },
        ].map(({ href, label, within }) => {
          const selected =
            path === href ||
            (href !== "/" && path.startsWith(href)) ||
            within.some((prefix) => path.startsWith(prefix));
          return (
            <Link
              key={href}
              href={href}
              className={`site-nav-link ${selected ? "selected" : ""}`}
              aria-current={selected ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <Link className="organiser-link" href="/admin">
        Create a drop <ArrowUpRight size={15} />
      </Link>
    </header>
  );
}
