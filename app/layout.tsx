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
        <link rel="icon" href="/jborca-favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/jborca-favicon.ico" />
        <meta name="theme-color" content="#111827" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={inter.className} suppressHydrationWarning={true}>
        <div className="min-h-screen flex flex-col">
          {/* 메인 콘텐츠 */}
          <main className="flex-1">
            {children}
          </main>
          
          {/* 전역 푸터 */}
          <footer className="bg-gray-900 border-t border-gray-800 py-4 px-4">
            <div className="max-w-md mx-auto text-center">
              <p className="text-gray-400 text-sm">
                made by. 단장 이건용
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
