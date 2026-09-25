import type { Metadata } from "next";
import localFont from "next/font/local";
import { Navigation } from "@/components/navigation";
import "./globals.css";
const manrope = localFont({
  src: "./fonts/Manrope.ttf",
  variable: "--font-manrope",
  display: "swap",
  weight: "200 800",
});
export const metadata: Metadata = {
  metadataBase: new URL("https://tenjo-azure.vercel.app"),
  title: { default: "Tenjō — Every loss counts", template: "%s · Tenjō" },
  description:
    "One person, one entry. A free drop lottery where every loss earns another ticket and every draw has a public record.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={manrope.variable} data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Navigation />
        <div className="app-frame">
          <header className="topbar">
            <span>FAIR DROPS. REAL PEOPLE.</span>
            <span className="environment-badge">
              <span className="status-dot live" />
              Phase 1 · Server draw
            </span>
          </header>
          <main id="main">{children}</main>
          <footer className="footer">
            <span>tenjō · Every loss counts.</span>
            <span>Free entry. Public odds. No personal details.</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
