import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "인천항(북항) 3D 해양관제",
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
