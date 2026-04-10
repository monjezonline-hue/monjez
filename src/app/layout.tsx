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

// =====================================================
// SEO METADATA (محسن لمحركات البحث)
// =====================================================
export const metadata: Metadata = {
  title: {
    default: "Monjez | بوت مبيعات ذكي لمتجرك على ماسنجر",
    template: "%s | Monjez",
  },
  description: "بوت مبيعات ذكي بالذكاء الاصطناعي لمتجرك على فيسبوك ماسنجر. يرد على العملاء، يقفل البيع، ويجمع الطلبات تلقائياً 24/7.",
  keywords: ["بوت ماسنجر", "مبيعات", "ذكاء اصطناعي", "فيسبوك", "تسويق", "Monjez"],
  authors: [{ name: "Monjez Team" }],
  creator: "Monjez",
  publisher: "Monjez",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "Monjez | بوت مبيعات ذكي",
    description: "حول محادثات ماسنجر إلى مبيعات تلقائية. بوت ذكي يفهم عملاءك ويقفل الصفقات.",
    url: "https://monjez.com",
    siteName: "Monjez",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Monjez - بوت مبيعات ذكي",
      },
    ],
    locale: "ar_EG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Monjez | بوت مبيعات ذكي",
    description: "بوت مبيعات بالذكاء الاصطناعي لمتجرك على ماسنجر",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  verification: {
    google: "your-google-verification-code", // أضف كود التحقق من Google Search Console
  },
  alternates: {
    canonical: "https://monjez.com",
  },
};

// =====================================================
// ROOT LAYOUT
// =====================================================
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="msapplication-TileColor" content="#4f46e5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Facebook Meta Tags */}
        <meta property="fb:app_id" content="your-facebook-app-id" />
        <meta property="og:locale" content="ar_AR" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50">
        {children}
      </body>
    </html>
  );
}