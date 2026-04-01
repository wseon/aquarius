import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "관제시스템",
  description: "수심별 흐름과 위험구역의 공간적 관계를 3D로 시각화",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-900 text-white">{children}</body>
    </html>
  );
}
