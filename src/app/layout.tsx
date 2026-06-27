import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IVR Navigator — AI voice agent for insurer calls",
  description:
    "Outbound voice agent that dials insurer support lines, navigates IVR menu trees, detects live reps vs recordings, recovers from hold queues, answers verification questions, and bridges the call to your staff.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
