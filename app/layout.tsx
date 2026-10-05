import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReturnCheck — Return review workspace",
  description: "Review return evidence, flag inconsistencies, and save human review decisions.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
