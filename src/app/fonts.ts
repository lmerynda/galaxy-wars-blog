import {
  Archivo,
  Barlow,
  Barlow_Semi_Condensed,
  IBM_Plex_Sans,
  Manrope,
  Saira,
  Saira_Stencil,
  Unbounded,
} from "next/font/google";

// Exploration loads every concept's faces without preloading; the winner keeps only its own.
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  preload: false,
});
const saira = Saira({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-saira",
  preload: false,
});
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  preload: false,
});
const barlowSemi = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow-semi",
  preload: false,
});
const stencil = Saira_Stencil({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-stencil",
  preload: false,
});
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  preload: false,
});
const unbounded = Unbounded({
  subsets: ["latin"],
  variable: "--font-unbounded",
  preload: false,
});
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  preload: false,
});
export const fontVariables = [
  plex,
  saira,
  barlow,
  barlowSemi,
  stencil,
  archivo,
  unbounded,
  manrope,
]
  .map((font) => font.variable)
  .join(" ");
