import type { Metadata } from "next";
// Self-hosted rather than next/font/google. The Google loader fetches the font
// files from Google's CDN during `next build`, so a build environment without
// outbound internet — a locked-down CI runner or a VPC build with no NAT — hangs
// or fails. Same typefaces, shipped as files by the `geist` package.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Ace Global · Admin",
  description: "Internal admin panel for Ace Global — leads, clients and performance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
