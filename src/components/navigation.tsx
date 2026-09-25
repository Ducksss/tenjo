"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Grid2X2, ScanLine, Ticket, Plus, ArrowUpRight } from "lucide-react";
export function Navigation() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="Tenjo home">
        <span className="brand-symbol">天</span>
        <span>
          tenjō<span className="brand-dot">.</span>
        </span>
      </Link>
      <p className="nav-caption">A fairer way in.</p>
      <nav aria-label="Main navigation">
        {[
          { href: "/", label: "Discover drops", icon: Grid2X2 },
          { href: "/audit", label: "Public record", icon: ScanLine },
          { href: "/codes", label: "My entries", icon: Ticket },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`nav-link ${path === href || (href !== "/" && path.startsWith(href)) ? "selected" : ""}`}
            aria-current={path === href ? "page" : undefined}
          >
            <Icon size={19} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <span className="small-orbit">◎</span>
          <p>
            One person.
            <br />
            One entry.
            <br />
            <strong>Every loss counts.</strong>
          </p>
        </div>
        <Link className="nav-link" href="/admin">
          <Plus size={19} />
          Create a drop
          <ArrowUpRight size={14} />
        </Link>
        <span className="sidebar-foot">Built for people, not bots.</span>
      </div>
    </aside>
  );
}
