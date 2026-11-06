import { Barlow, Barlow_Semi_Condensed } from "next/font/google";

// Barlow matches the plain readouts of the game's flight HUD.
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
});
const barlowSemi = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-barlow-semi",
});
export const fontVariables = `${barlow.variable} ${barlowSemi.variable}`;
