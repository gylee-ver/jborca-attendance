import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

// viewport를 별도로 export
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: "JB ORCA | 출석 관리 시스템",
  description: "JB ORCA 전용 출석 관리 시스템",
  generator: '단장 이건용',
  icons: {
    icon: '/jborca-favicon.ico',
    shortcut: '/jborca-favicon.ico',
    apple: '/jborca-favicon.ico',
  },
  openGraph: {
    title: 'JB ORCA | 출석 관리 시스템',
    description: 'JB ORCA 전용 출석 관리 시스템',
    url: 'https://jborca-attendance.vercel.app',
    siteName: 'JB ORCA 출석 관리',
    images: [
      {
        url: '/jborca_og.png',
        width: 1200,
        height: 630,
        alt: 'JB ORCA 출석 관리 시스템',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JB ORCA | 출석 관리 시스템',
    description: 'JB ORCA 전용 출석 관리 시스템',
    images: ['/jborca_og.png'],
  },
  robots: {
    index: false, // 검색엔진에서 제외 (팀 내부용)
    follow: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="dark">
      <head>
        <link rel="stylesheet" as="style" crossOrigin="anonymous" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
        <link rel="icon" href="/jborca-favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/jborca-favicon.ico" />
        <meta name="theme-color" content="#111827" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="font-[Pretendard] tracking-tight" suppressHydrationWarning={true}>
        {/* 모바일 뷰포트 제한 컨테이너 */}
        <div className="min-h-screen bg-[#111] flex justify-center items-center sm:items-start">
          <div className="w-full max-w-[390px] min-h-screen bg-black shadow-2xl relative flex flex-col border-x border-zinc-900">
            {/* 메인 콘텐츠 */}
            <main className="flex-1">
              {children}
            </main>
            
            {/* 전역 푸터 */}
            <footer className="bg-black border-t border-zinc-900 py-8 text-center pb-20">
              <p className="text-zinc-500 text-xs font-bold tracking-[0.2em] mb-1">
                RIDE THE WAVE
              </p>
              <p className="text-zinc-700 text-[10px] tracking-wider">
                JB ORCA 2026
              </p>
              <p className="text-zinc-800 text-[9px] mt-2">
                made by. 단장 이건용
              </p>
            </footer>
          </div>
        </div>
      </body>
    </html>
  )
}
