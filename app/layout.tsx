import type { Metadata } from "next";
import { Cinzel, Lato } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-cinzel" });
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-lato" });

export const metadata: Metadata = {
  title: "Skull King Tracker",
  description: "Premium score tracker for Skull King card game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${cinzel.variable} ${lato.variable}`}>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
