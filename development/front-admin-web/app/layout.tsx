import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "thundercrew-domain",
  description: "전기 이륜차 관제 및 운영 관리 웹 서비스"
};

const themeBootstrap = `(function(){try{var k='thundercrew-theme';var s=window.localStorage.getItem(k);var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;var c=window.localStorage.getItem('thundercrew-sidebar-collapsed')==='true';if(c)document.documentElement.dataset.sidebar='collapsed';}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
