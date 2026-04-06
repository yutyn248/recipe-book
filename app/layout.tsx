import type { Metadata, Viewport } from "next";
import "./globals.css";
import SwRegister from "@/components/SwRegister";

export const metadata: Metadata = {
  title: "マイレシピ帳",
  description: "料理本をデジタル化する個人レシピ管理システム",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-full bg-[#FAFAF8]">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
