import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Home Server Dashboard",
  description: "Monitoring performa server dan sisa storage SSD/HDD",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body>{children}</body>
    </html>
  );
}
