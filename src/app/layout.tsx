import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Toaster } from "sonner";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Industry Desk — Robinhood industry agents",
  description:
    "Connect Robinhood. Pick an industry book. Let an agent watch the AI trade and execute on your Agentic account.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${fraunces.variable} antialiased`}>
        <SiteNav />
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
