import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { QueryProvider } from "@/components/QueryProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "PREDECT — Swarm Intelligence Prediction Platform",
  description: "Feed it reality. It returns the future.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-bg-base text-text-primary antialiased">
        <QueryProvider>
          <ThemeProvider>
            <Navigation />
            <main className="pt-14 pb-16 sm:pb-0">{children}</main>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
