import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Here App",
  description: "Student check-in/check-out for remote work and internships",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
