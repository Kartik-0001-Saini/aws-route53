import type { Metadata, Viewport } from "next";

import { Providers } from "@/app/providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme-context";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Route 53 Management Console",
    template: "%s | Route 53 Management Console",
  },
  description:
    "A functional clone of the AWS Route 53 console: hosted zones and DNS record management with persistent storage.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The header keeps its navy in both themes, so the browser chrome should
  // match it rather than the page background.
  themeColor: "#0f1b2a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Applies the stored theme class before first paint. It has to run
          ahead of hydration, so it is inlined rather than bundled — anything
          imported would arrive after the browser has already painted white.

          `suppressHydrationWarning` on <html> is required because this script
          mutates the element's class list before React compares the two trees.
        */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
