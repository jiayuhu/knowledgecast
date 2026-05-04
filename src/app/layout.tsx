import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "KnowledgeCast",
  description: "把碎片知识快速整理成可讲、可发、可复用的培训网页",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
