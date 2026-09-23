import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aster House - Guest Assistance & Room Availability",
  description:
    "Grounded concierge assistant for Aster House hotel. Check-in hours, verified amenities, policy FAQs, and deterministic room availability.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="min-h-screen bg-[#F7F5F0] text-[#1E2328] antialiased selection:bg-[#1F5A5A] selection:text-white">
        {children}
      </body>
    </html>
  );
}
