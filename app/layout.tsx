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
  description: '今いる場所から一番安い食堂をすぐ見つける。価格順で並べて、歩いて行ける距離のお店だけ表示。学生・節約派のための食堂検索アプリ。',
  metadataBase: new URL('https://yasumeshi.jp'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'やすめし - 近くの安い食堂を探す',
    description: '今いる場所から一番安い食堂をすぐ見つける。価格順で並べて、歩いて行ける距離のお店だけ表示。',
    url: 'https://yasumeshi.jp',
    siteName: 'やすめし',
    locale: 'ja_JP',
    type: 'website',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'やすめし',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'やすめし - 近くの安い食堂を探す',
    description: '今いる場所から一番安い食堂をすぐ見つける。価格順で並べて、歩いて行ける距離のお店だけ表示。',
    images: ['/icon-512.png'],
  },
  keywords: ['安い食堂', '格安ランチ', '近くの食堂', '価格順', 'やすめし', '学生 ランチ', '節約 外食', '食堂検索'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'やすめし',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} h-full antialiased`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-noto-sans-jp)]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'やすめし',
              url: 'https://yasumeshi.jp',
              description: '今いる場所から一番安い食堂をすぐ見つける。価格順で並べて、歩いて行ける距離のお店だけ表示。',
              applicationCategory: 'LifestyleApplication',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'JPY',
              },
              inLanguage: 'ja',
              availableLanguage: 'ja',
            }),
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
