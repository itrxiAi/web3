import { Metadata, Viewport } from "next";
import "./css/style.css";

export const metadata: Metadata = {
  title: "HAK",
  description: "Decentralized crypto-autonomous community",
  icons: {
    icon: "/images/favicon.ico",
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
            // 禁用手势缩放事件
            document.addEventListener('gesturestart', function(e) {
              e.preventDefault();
            }, { passive: false });
            
            document.addEventListener('gesturechange', function(e) {
              e.preventDefault();
            }, { passive: false });
            
            document.addEventListener('gestureend', function(e) {
              e.preventDefault();
            }, { passive: false });
          `,
          }}
        />
      </head>
      <body
        className={`font-aspekta antialiased bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 tracking-tight`}
      >
        {children}
      </body>
    </html>
  );
}
