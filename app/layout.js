import { JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap", // Faster text rendering - prevent FOIT
  preload: true,
  adjustFontFallback: true,
});

export const metadata = {
  title: "SendTheLink - Free Link Sharing Platform | Share Resources Anonymously",
  description: "Free link sharing platform for designers, developers, and creators. Share 3D assets, design resources, code snippets, tutorials, tools, and more. No login required, AI-powered moderation.",
  keywords: [
    "link sharing",
    "anonymous sharing",
    "free resources",
    "share links",
    "design resources",
    "3d assets free",
    "code resources",
    "free tutorials",
    "developer tools",
    "design assets",
    "free fonts",
    "ai tools",
    "music resources",
    "video assets",
    "game assets",
    "android apps",
    "windows software",
    "no login sharing",
    "resource sharing platform"
  ],
  authors: [{ name: "SendTheLink" }],
  creator: "SendTheLink",
  publisher: "SendTheLink",

  // Open Graph (Facebook, LinkedIn)
  openGraph: {
    title: "SendTheLink - Free Link Sharing Platform",
    description: "Share useful links with everyone. Free resources for designers, developers & creators. No login required.",
    url: "https://sendthelink.vercel.app",
    siteName: "SendTheLink",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SendTheLink - Free Link Sharing Platform"
      }
    ]
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "SendTheLink - Free Link Sharing",
    description: "Share useful links with everyone. Free resources for designers, developers & creators.",
    images: ["/og-image.png"],
    creator: "@sendthelink"
  },

  // App manifest
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SendTheLink"
  },

  // Icons
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-icon.png"
  },

  // Additional metadata
  metadataBase: new URL("https://sendthelink.vercel.app"),
  alternates: {
    canonical: "/"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },

  // Additional mobile optimization
  formatDetection: {
    telephone: true,
    date: false,
    address: false,
    email: true,
  },
  verification: {
    // Add your verification codes here
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code"
  }
};

// Viewport configuration (Next.js 16+ requirement)
export const viewport = {
  themeColor: "#110820",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to critical third-party origins for faster loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://firestore.googleapis.com" />
        <link rel="preconnect" href="https://www.google.com" />
        <link rel="preconnect" href="https://www.gstatic.com" />

        {/* DNS Prefetch for secondary resources */}
        <link rel="dns-prefetch" href="https://identitytoolkit.googleapis.com" />
        <link rel="dns-prefetch" href="https://generativelanguage.googleapis.com" />

        {/* Optimize for mobile */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body
        className={`${jetbrainsMono.variable} antialiased`}
      >
        {/* Support Palestine Banner */}
        <a
          className="support-palestine"
          href="https://kitabisa.com/campaign/celenganwargapalestina/"
          target="_blank"
          rel="nofollow noopener"
          title="Donate to support Palestine"
        >
          <svg
            className="support-palestine__flag"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 36 24"
            width="36"
            height="24"
            role="img"
            aria-label="Flag of Palestine"
          >
            <rect width="36" height="8" fill="#000000" />
            <rect y="8" width="36" height="8" fill="#FFFFFF" />
            <rect y="16" width="36" height="8" fill="#009639" />
            <polygon points="0,0 12,12 0,24" fill="#CE1126" />
          </svg>
          <div className="support-palestine__label">Donate to support Palestine</div>
        </a>
        {/* End of Banner */}


        {children}
        <Analytics />
      </body>
    </html>
  );
}
