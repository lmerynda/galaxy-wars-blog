import { CommentCounter } from "@/components/CommentCounter";
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "@/concepts/sector.css";
import "@/concepts/hud.css";
import "@/concepts/hangar.css";
import "@/concepts/title.css";
import { fontVariables } from "./fonts";
import { currentConcept } from "@/server/concept";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: {
    default: "Galaxy Wars — Development log",
    template: "%s · Galaxy Wars",
  },
  description:
    "Building Galaxy Wars, one change at a time. Small stories, real screenshots, and a galaxy taking shape.",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-concept={await currentConcept()}
      className={fontVariables}
    >
      <body>
        <div className="backdrop" aria-hidden="true" />
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
            <div className="header-tools">
              <CommentCounter />
              <span className="header-note">
                <span className="status-dot" /> A galaxy in the making
              </span>
            </div>
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
