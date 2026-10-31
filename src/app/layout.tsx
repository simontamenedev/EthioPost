import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import type { ReactNode } from "react";
import { CommissionDataProvider } from "../components/commission-data";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { AppProviders } from "../providers/app-providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "EthioPost | Commission dashboard",
  description: "Import, calculate, and summarize commissions by agent, branch, and district.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // suppressHydrationWarning is required by next-themes (it sets the theme attribute before hydration)
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CommissionDataProvider>
          <NextThemesProvider>
            <AppProviders>{children}</AppProviders>
          </NextThemesProvider>
        </CommissionDataProvider>
      </body>
    </html>
  );
}
