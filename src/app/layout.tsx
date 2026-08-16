import type { Metadata } from "next";
import { Frank_Ruhl_Libre, Heebo } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { heIL } from "@clerk/localizations";
import { shadcn } from "@clerk/ui/themes";
import { Toaster } from "@/components/ui/sonner";
import "@clerk/ui/themes/shadcn.css";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-sans",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

const frankRuhl = Frank_Ruhl_Libre({
  variable: "--font-serif",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dentalcompare.co.il"),
  title: {
    default: "DentalCompare – השוו מחירים. חסכו אלפי שקלים.",
    template: "%s | DentalCompare",
  },
  description:
    "פלטפורמה ישראלית לקבלת הצעות מחיר מ-3 רופאי שיניים מובילים בבקשה אחת — בחינם. העלאה חד-פעמית של תוכנית טיפול, ללא שיחות טלפון, ללא לחץ.",
  // opengraph-image.jpg / twitter-image.jpg in this folder are picked up
  // automatically; metadataBase makes their URLs absolute for social crawlers.
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: "DentalCompare",
    title: "DentalCompare – השוו מחירים. חסכו אלפי שקלים.",
    description: "קבלו הצעות מחיר מ-3 רופאי שיניים בבקשה אחת, בחינם — ללא שיחות טלפון, ללא לחץ.",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} ${frankRuhl.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ClerkProvider localization={heIL} appearance={{ theme: shadcn }}>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ClerkProvider>
      </body>
    </html>
  );
}
