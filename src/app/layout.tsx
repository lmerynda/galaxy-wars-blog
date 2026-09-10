import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "Galaxy Wars — Development log",
    template: "%s · Galaxy Wars",
  },
  description:
    "Building Galaxy Wars, one change at a time. Small stories, real screenshots, and a galaxy taking shape.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="site-shell">
          <header className="site-header">
            <Link className="brand" href="/" aria-label="Galaxy Wars home">
              <span className="brand-icon" aria-hidden="true">
                ✳
              </span>
              <span>
                GALAXY WARS<span className="brand-sub">DEVELOPMENT LOG</span>
              </span>
            </Link>
            <span className="header-note">
              <span className="status-dot" /> A galaxy in the making
            </span>
          </header>
          <main id="main">{children}</main>
          <footer className="site-footer">
            <span>
              GALAXY WARS <span className="footer-slash">/</span> Development
              log
            </span>
            <span>Built one update at a time.</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
