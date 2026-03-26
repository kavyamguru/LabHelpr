import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { AppHeader } from "./components/AppHeader";
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
  title: "LH Calculator",
  description: "Bench-friendly calculators for lab workflows.",
  icons: {
    icon: "/logo-labhelpr.png",
    shortcut: "/logo-labhelpr.png",
    apple: "/logo-labhelpr.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('labhelpr-theme')||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=(m==='dark')||(m==='system'&&d);document.documentElement.classList.toggle('dark',dark);}catch(e){}})();`,
          }}
        />
        <AppHeader />
        <div className="pt-16">{children}</div>
        <Analytics />
      </body>
    </html>
  );
}
