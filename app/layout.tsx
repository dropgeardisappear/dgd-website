import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import UsernameSetup from "@/components/UsernameSetup";
import { CartProvider } from "@/components/shop/CartProvider";
import LivePresence from "@/components/LivePresence";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Drop Gear Disappear",
  description:
    "Underground builds. Community rated. Cars, trucks, motorcycles and the people building them.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
      >
        <CartProvider>
          <LivePresence />
          {children}
          <UsernameSetup />
        </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}
