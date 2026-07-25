import { Newsreader, Hanken_Grotesk } from "next/font/google";

/**
 * The collection page's typography. Only that page -- the admin and dashboard keep
 * Geist, because a customer-facing page and an internal tool have different jobs.
 */
export const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
  display: "swap",
});

export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-collect",
  display: "swap",
});
