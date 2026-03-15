import type { Metadata } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { QueryProvider } from "@/components/QueryProvider";

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
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0f] text-[#F8F8FC] antialiased">
        <QueryProvider>
          <Navigation />
          <main className="pt-14 pb-16 sm:pb-0">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
