import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "KnowledgeCast",
  description: "Turn fragmented knowledge into private training pages."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
