import { Inter } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--sans" });

export const metadata = {
  title: "Leave your Thumbprint",
  description: "Press your thumb to the page. Leave your mark with your X username.",
  openGraph: { title: "Leave your Thumbprint", description: "Press your thumb to the page. Leave your mark." },
  twitter: { card: "summary", title: "Leave your Thumbprint", description: "Press your thumb to the page. Leave your mark." },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}