import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import localFont from "next/font/local";
import "./globals.scss";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-noto-thai",
});

const thSarabunNew = localFont({
  src: [
    { path: "../public/fonts/THSarabunNew.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/THSarabunNew-Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-th-sarabun",
});

export const metadata: Metadata = {
  title: "Freshy Game HR · Brown Team",
  description: "Participant records and accreditation for Freshy Game 2026",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${inter.variable} ${notoSansThai.variable} ${thSarabunNew.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
