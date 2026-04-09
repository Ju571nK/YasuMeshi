import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'やすめし - 近くの安い食堂を探す',
  description: '今いる場所から、一番安い食堂をすぐ見つける',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-noto-sans-jp)]">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
