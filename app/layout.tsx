import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ATVOO | Discover your next favorite",
    template: "%s | ATVOO",
  },
  description: "Discover a considered collection of products from sellers on ATVOO.",
  applicationName: "ATVOO",
  openGraph: {
    title: "ATVOO | Discover your next favorite",
    description: "Discover a considered collection of products on ATVOO.",
    siteName: "ATVOO",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
