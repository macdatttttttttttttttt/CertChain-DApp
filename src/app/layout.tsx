import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "CertChain – Xác minh văn bằng đại học bằng Blockchain",
  description: "Hệ thống cấp phát và xác minh văn bằng, chứng chỉ đại học trên Blockchain",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
