import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-sans",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DentalCompare – השוואת מחירים בין רופאי שיניים",
    template: "%s | DentalCompare",
  },
  description:
    "פלטפורמה לקבלת הצעות מחיר מעד 10 רופאי שיניים בישראל באמצעות העלאה חד-פעמית של תוכנית טיפול וצילומי שיניים.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="bg-background text-foreground flex min-h-full flex-col">{children}</body>
    </html>
  );
}
