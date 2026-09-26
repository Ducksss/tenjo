import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { Navigation } from "@/components/navigation";
import { worldConfig } from "@/lib/world";
import { shortId, suiStatus, suiscan } from "@/lib/sui-status";
import "./globals.css";
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});
export const metadata: Metadata = {
  metadataBase: new URL("https://tenjo-azure.vercel.app"),
  title: { default: "Tenjō — Every loss counts", template: "%s · Tenjō" },
  description:
    "Gacha’s pity ceiling for ticket ballots. World ID lets each person enter once, Sui runs the draw and keeps the loss ledger, and every loss adds a chance next time.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const world = worldConfig();
  const sui = suiStatus();
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${spaceGrotesk.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Navigation />
        <div className="app-frame">
          <header className="topbar">
            <span className="topbar-tagline">Fair drops for real people.</span>
            <ul className="environment-badges" aria-label="What’s running">
              <li className="environment-badge">
                <span
                  className={`status-dot ${world.ready ? "live" : "pending"}`}
                />
                World ID ·{" "}
                {world.ready ? world.environment : "awaiting credentials"}
              </li>
              <li className="environment-badge">
                <span
                  className={`status-dot ${sui.ready ? "live" : "pending"}`}
                />
                Sui · {sui.ready ? sui.network : "not published yet"}
                {sui.ready && sui.packageId ? (
                  <a
                    href={suiscan(sui.network, "object", sui.packageId)}
                    title={sui.packageId}
                  >
                    {shortId(sui.packageId)}
                  </a>
                ) : null}
              </li>
            </ul>
          </header>
          <main id="main">{children}</main>
          <footer className="footer">
            <div>
              <span className="footer-brand">
                tenjō <span className="jp">天井</span>
              </span>
              <p>
                Every loss counts. One person, one entry, and a public record of
                every draw.
              </p>
            </div>
            <ul className="footer-links" aria-label="More">
              <li>
                <Link href="/architecture">How it’s built</Link>
              </li>
              <li>
                <Link href="/results">Results</Link>
              </li>
              <li>
                <a href="https://github.com/Ducksss/tenjo">Source on GitHub</a>
              </li>
            </ul>
          </footer>
        </div>
      </body>
    </html>
  );
}
