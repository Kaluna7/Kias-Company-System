import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers"; // 👈 tambahkan ini

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata = {
  title: "KIAS AUDIT SYSTEM",
  description: "Enjoy your work with this system & earn your money",
  icons: {
    icon: "/images/kias-logo.png",
    shortcut: "/images/kias-logo.png",
    apple: "/images/kias-logo.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers> 
      </body>
    </html>
  );
}
