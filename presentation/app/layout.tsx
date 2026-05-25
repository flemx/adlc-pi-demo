import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentforce × Headless 360 — Vibe Coding with sf-pi",
  description:
    "Interactive presentation: building Agentforce agents with vibe coding on Salesforce Headless 360 using sf-pi.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
