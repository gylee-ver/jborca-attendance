import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 안전한 날짜 포맷팅 함수 추가
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    // ISO 형식으로 일관된 날짜 표시
    return date.toISOString().split('T')[0]
      .split('-')
      .map((part, index) => {
        if (index === 0) return part + '년'
        if (index === 1) return parseInt(part) + '월'
        return parseInt(part) + '일'
      })
      .join(' ')
  } catch (error) {
    return dateString
  }
}

// 클라이언트 전용 날짜 포맷팅
export function formatDateClient(dateString: string): string {
  if (typeof window === 'undefined') {
    return formatDate(dateString)
  }
  
  try {
    return new Date(dateString).toLocaleDateString("ko-KR")
  } catch (error) {
    return formatDate(dateString)
  }
}
