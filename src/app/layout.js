import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers"; // 👈 tambahkan ini

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "KIAS AUDIT SYSTEM",
  description: "Enjoy your work with this system & earn your money",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers> {/* 👈 pindahkan SessionProvider ke sini */}
      </body>
    </html>
  );
}
