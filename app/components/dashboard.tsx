"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Users,
  Trophy,
  Settings,
  User,
  LogOut,
  CheckCircle,
  XCircle,
  FlameIcon as Fire,
  ChevronRight,
  RefreshCw,
} from "lucide-react"
import AttendanceCalendar from "./attendance-calendar"
import VotingSection from "./voting-section"
import AttendanceRanking from "./attendance-ranking"
import TeamAttendance from "../team-attendance/page"
import AdminPage from "./admin-page"
import type { User as UserType, AttendanceWithEvent } from "@/lib/supabase"
import { statsService } from "@/lib/supabase"

interface DashboardProps {
  user: UserType
  onLogout: () => void
}

type ViewType = "dashboard" | "team-attendance" | "admin"

// 프론트엔드 통계 계산 함수들 - 입단일 기준 필터링 추가
const calculateAttendanceStats = (attendanceRecords: AttendanceWithEvent[], userJoinDate?: string) => {
  console.log('=== 프론트엔드 통계 계산 시작 ===')
  console.log('전체 출석 기록:', attendanceRecords.length)
  console.log('사용자 입단일:', userJoinDate)
  
  // 취소되지 않은 이벤트만 필터링
  let validRecords = attendanceRecords.filter(record => 
    record.event && record.event.status !== 'cancelled'
  )
  
  // 입단일 이후 이벤트만 필터링
  if (userJoinDate) {
    const joinDate = new Date(userJoinDate)
    validRecords = validRecords.filter(record => {
      if (!record.event?.date) return false
      const eventDate = new Date(record.event.date)
      return eventDate >= joinDate
    })
    console.log('입단일 이후 유효한 출석 기록:', validRecords.length)
  } else {
    console.log('입단일 정보 없음, 전체 기록 사용:', validRecords.length)
  }
  
  // 안전한 날짜 파싱 함수
  const safeDateParse = (dateStr: string, timeStr?: string) => {
    try {
      if (!dateStr) return null
      
      // 기본 날짜 파싱
      let dateTime
      if (timeStr) {
        dateTime = new Date(`${dateStr}T${timeStr}:00`)
      } else {
        dateTime = new Date(`${dateStr}T23:59:59`)
      }
      
      // 유효성 검사
      if (isNaN(dateTime.getTime())) {
        console.warn('날짜 파싱 실패, 대안 시도:', dateStr, timeStr)
        
        // 대안 1: 단순 Date 생성
        dateTime = new Date(dateStr)
        if (timeStr && !isNaN(dateTime.getTime())) {
          const [hours, minutes] = timeStr.split(':')
          dateTime.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0)
        }
        
        // 여전히 실패하면 null 반환
        if (isNaN(dateTime.getTime())) {
          console.error('날짜 파싱 완전 실패:', dateStr, timeStr)
          return null
        }
      }
      
      return dateTime
    } catch (error) {
      console.error('날짜 파싱 예외:', error, dateStr, timeStr)
      return null
    }
  }
  
  // 디버깅: 실제 이벤트 날짜들 확인 (안전한 버전)
  console.log('=== 입단일 필터링 후 이벤트 날짜들 ===')
  validRecords.slice(0, 5).forEach((r, idx) => {
    const parsedDate = safeDateParse(r.event?.date || '', r.event?.time)
    console.log(`이벤트 ${idx + 1}:`, {
      title: r.event?.title,
      date: r.event?.date,
      time: r.event?.time,
      actual_status: r.actual_status,
      event_status: r.event?.status,
      파싱성공: parsedDate !== null,
      파싱된날짜ISO: parsedDate ? parsedDate.toISOString() : 'PARSING_FAILED'
    })
  })

  // 1. 전체 통계 계산 (입단일 이후)
  const totalEvents = validRecords.length
  const attendedEvents = validRecords.filter(record => record.actual_status === 'attended')
  const totalAttendance = attendedEvents.length
  const attendanceRate = totalEvents > 0 ? Math.round((totalAttendance / totalEvents) * 100) : 0

  console.log('입단일 기준 전체 통계:', {
    totalEvents,
    totalAttendance,
    attendanceRate
  })

  // 2. 이번 달 출석 여부 계산 (입단일 이후만)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0)

  const thisMonthAttended = attendedEvents.some(record => {
    if (!record.event?.date) return false
    const eventDate = safeDateParse(record.event.date)
    if (!eventDate) return false
    
    const isThisMonth = eventDate >= firstDayOfMonth && eventDate <= lastDayOfMonth
    if (isThisMonth) {
      console.log('이번 달 참석 이벤트:', {
        title: record.event.title,
        date: record.event.date
      })
    }
    return isThisMonth
  })

  console.log('이번 달 출석 여부 (입단일 기준):', thisMonthAttended)

  // 3. 연속 출석 계산 - 안전한 날짜 처리 (입단일 이후)
  const now_date = new Date()
  console.log('=== 연속 출석 계산 디버깅 (입단일 기준) ===')
  console.log('현재 시간:', now_date.toISOString())
  
  const pastEvents = validRecords
    .filter(record => {
      if (!record.event?.date) return false
      
      const eventDateTime = safeDateParse(record.event.date, record.event.time)
      if (!eventDateTime) return false
      
      const isPast = eventDateTime < now_date
      
      // 디버깅 로그 (안전한 버전)
      console.log('이벤트 확인:', {
        title: record.event?.title,
        date: record.event?.date,
        time: record.event?.time,
        eventDateTime: eventDateTime.toISOString(),
        isPast,
        actual_status: record.actual_status
      })
      
      return isPast
    })
    .sort((a, b) => {
      // 안전한 정렬
      const dateTimeA = safeDateParse(a.event?.date || '', a.event?.time)
      const dateTimeB = safeDateParse(b.event?.date || '', b.event?.time)
      
      if (!dateTimeA || !dateTimeB) return 0
      return dateTimeB.getTime() - dateTimeA.getTime()
    })

  console.log('필터링된 과거 이벤트 수 (입단일 기준):', pastEvents.length)
  console.log('과거 이벤트들 (최신순):', pastEvents.slice(0, 5).map(r => ({
    title: r.event?.title,
    date: r.event?.date,
    time: r.event?.time,
    actual_status: r.actual_status
  })))

  let consecutiveAttendance = 0
  for (const record of pastEvents) {
    console.log('연속 출석 체크:', {
      title: record.event?.title,
      date: record.event?.date,
      actual_status: record.actual_status,
      현재연속: consecutiveAttendance
    })
    
    if (record.actual_status === 'attended') {
      consecutiveAttendance++
    } else {
      break
    }
  }

  console.log('최종 연속 출석 수 (입단일 기준):', consecutiveAttendance)

  return {
    monthlyAttended: thisMonthAttended,
    consecutiveAttendance,
    totalAttendance,
    totalEvents,
    attendanceRate
  }
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [currentView, setCurrentView] = useState<ViewType>("dashboard")
  const [attendanceStats, setAttendanceStats] = useState({
    monthlyAttended: false,
    consecutiveAttendance: 0,
    totalAttendance: 0,
    totalEvents: 0,
    attendanceRate: 0
  })
  const [rawAttendanceData, setRawAttendanceData] = useState<AttendanceWithEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUserStats = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      console.log('원시 출석 데이터 로딩 시작...', user.id)
      
      // 원시 데이터 가져오기
      const { attendanceRecords, error: fetchError } = await statsService.getUserRawAttendanceData(user.id)
      
      if (fetchError) {
        setError(fetchError)
        return
      }

      console.log('가져온 원시 데이터:', attendanceRecords.length, '개')
      setRawAttendanceData(attendanceRecords)
      
      // 프론트엔드에서 통계 계산 (입단일 전달)
      const calculatedStats = calculateAttendanceStats(attendanceRecords, user.join_date)
      setAttendanceStats(calculatedStats)
      
    } catch (error) {
      console.error('통계 데이터 로딩 오류:', error)
      setError('출석 데이터를 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUserStats()
  }, [user.id])

  // 새로고침 함수
  const handleRefresh = () => {
    fetchUserStats()
  }

  // 실시간 통계 재계산 (데이터가 변경될 때마다) - 입단일 기준
  useEffect(() => {
    if (rawAttendanceData.length > 0) {
      const calculatedStats = calculateAttendanceStats(rawAttendanceData, user.join_date)
      setAttendanceStats(calculatedStats)
    }
  }, [rawAttendanceData, user.join_date])

  if (currentView === "team-attendance") {
    return <TeamAttendance user={user} onBack={() => setCurrentView("dashboard")} />
  }

  if (currentView === "admin") {
    return <AdminPage user={user} onBack={() => setCurrentView("dashboard")} />
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 relative">
              <Image
                src="/JB_Logo_White.png"
                alt="JB ORCA 로고"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="font-bold text-lg">JB ORCA</h1>
              <p className="text-sm text-gray-400">
                #{user.number} {user.name} {user.role === "manager" && user.tag ? user.tag : user.role === "manager" ? "매니저" : "선수"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-gray-400 hover:text-white">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* 개인화된 출석 대시보드 */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>
                  {user.name} {user.role === "manager" && user.tag ? user.tag : user.role === "manager" ? "매니저" : "선수"}의 출석 현황
                </span>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                className="text-gray-400 hover:text-white"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                <p className="text-gray-400 mt-2">출석 데이터 로딩 중...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                  <Button 
                    onClick={handleRefresh} 
                    className="mt-2 bg-red-600 hover:bg-red-700"
                    size="sm"
                  >
                    다시 시도
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      {attendanceStats.monthlyAttended ? (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-400">이번 달 정기 모임</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {attendanceStats.monthlyAttended ? "이미 참여했어요!" : "아직 참석하지 않았어요!"}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      <Fire className="w-6 h-6 text-orange-500" />
                      <span className="ml-1 font-bold text-lg">{attendanceStats.consecutiveAttendance}</span>
                    </div>
                    <p className="text-sm text-gray-400">연속 출석</p>
                    <p className="text-xs text-gray-500 mt-1">
                      🔥 연속 {attendanceStats.consecutiveAttendance}회 출석중
                    </p>
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-800 rounded-lg">
                  <p className="text-lg font-bold">
                    {attendanceStats.totalAttendance}/{attendanceStats.totalEvents}
                  </p>
                  <p className="text-sm text-gray-400">
                    전체 출석률 {attendanceStats.attendanceRate}%
                  </p>
                  {attendanceStats.totalEvents > 0 && (
                    <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${attendanceStats.attendanceRate}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* 추가 통계 정보 */}
                {attendanceStats.totalEvents > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-2 bg-gray-800 rounded-lg">
                      <p className="text-lg font-bold text-green-400">
                        {attendanceStats.totalAttendance}
                      </p>
                      <p className="text-xs text-gray-400">참석 횟수</p>
                    </div>
                    <div className="text-center p-2 bg-gray-800 rounded-lg">
                      <p className="text-lg font-bold text-red-400">
                        {attendanceStats.totalEvents - attendanceStats.totalAttendance}
                      </p>
                      <p className="text-xs text-gray-400">불참 횟수</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 출석 투표 섹션 */}
        <VotingSection user={user} />

        {/* 일정 캘린더 */}
        <AttendanceCalendar user={user} />

        {/* 출석 랭킹 */}
        <AttendanceRanking onTeamAttendanceClick={() => setCurrentView("team-attendance")} />

        {/* 관리 버튼들 */}
        <div className="space-y-3">
          {user.role === "manager" && (
            <>
              <Button
                onClick={() => setCurrentView("team-attendance")}
                className="w-full bg-purple-600 hover:bg-purple-700 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>팀 출석 관리</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </Button>
              
              <Button
                onClick={() => setCurrentView("admin")}
                className="w-full bg-green-600 hover:bg-green-700 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>관리자 페이지</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
} 