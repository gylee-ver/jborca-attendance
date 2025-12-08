"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Users,
  Settings,
  LogOut,
  RefreshCw,
  Trophy,
  Flame,
  CalendarDays,
  ChevronRight,
  Shield,
  LayoutDashboard
} from "lucide-react"
import VotingSection from "./voting-section"
import PointSystem from "./point-system"
import AttendanceRanking from "./attendance-ranking"
import AttendanceCalendar from "./attendance-calendar"
import TeamAttendance from "./team-attendance"
import AdminPage from "./admin-page"
import type { User as UserType, AttendanceWithEvent } from "@/lib/supabase"
import { statsService, attendanceService, supabase } from "@/lib/supabase"

interface DashboardProps {
  user: UserType
  onLogout: () => void
}

type ViewType = "dashboard" | "team-attendance" | "admin"

// 프론트엔드 통계 계산 함수들
const calculateAttendanceStats = (attendanceRecords: AttendanceWithEvent[], userJoinDate?: string) => {
  // 취소되지 않고 시작된 이벤트만 필터링
  let validRecords = attendanceRecords.filter(record => 
    record.event && 
    record.event.status !== 'cancelled' && 
    record.event.status !== 'upcoming'
  )
  
  // 입단일 이후 이벤트만 필터링
  if (userJoinDate) {
    const joinDate = new Date(userJoinDate)
    validRecords = validRecords.filter(record => {
      if (!record.event?.date) return false
      const eventDate = new Date(record.event.date)
      return eventDate >= joinDate
    })
  }
  
  // 안전한 날짜 파싱 함수
  const parseEventDate = (dateStr: string, timeStr: string) => {
    try {
      return new Date(`${dateStr}T${timeStr}`)
    } catch {
      return new Date()
    }
  }

  // 날짜순 정렬 (최신순)
  validRecords.sort((a, b) => {
    const dateA = parseEventDate(a.event!.date, a.event!.time).getTime()
    const dateB = parseEventDate(b.event!.date, b.event!.time).getTime()
    return dateB - dateA
  })

  const totalEvents = validRecords.length
  const totalAttendance = validRecords.filter(r => r.actual_status === 'attended').length
  const attendanceRate = totalEvents > 0 ? Math.round((totalAttendance / totalEvents) * 100) : 0

  // 연속 출석 계산
  let consecutiveAttendance = 0
  for (const record of validRecords) {
    if (record.actual_status === 'attended') {
      consecutiveAttendance++
    } else {
      break
    }
  }

  return {
    totalEvents,
    totalAttendance,
    attendanceRate,
    consecutiveAttendance
  }
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [view, setView] = useState<ViewType>("dashboard")

  const getAttendanceMessage = (rate: number) => {
    if (rate <= 20) return "참여율이 매우 저조합니다."
    if (rate <= 50) return "조금만 시간을 내주세요."
    if (rate <= 80) return "오르카를 위해 조금만 더 힘내주세요."
    return "당신은 오르카의 에이스입니다."
  }

  const [attendanceStats, setAttendanceStats] = useState({
    totalEvents: 0,
    totalAttendance: 0,
    attendanceRate: 0,
    consecutiveAttendance: 0
  })
  const [isLoading, setIsLoading] = useState(false)

  const loadStats = async () => {
    setIsLoading(true)
    try {
      // attendanceService.getUserRawAttendanceData 대신 직접 쿼리 (모듈 로딩 이슈 해결용)
      const { data: attendanceData, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
      
      if (attError) throw attError

      let attendanceRecords: AttendanceWithEvent[] = []
      
      if (attendanceData && attendanceData.length > 0) {
        const eventIds = attendanceData.map(a => a.event_id)
        const { data: eventsData, error: eventError } = await supabase
          .from('events')
          .select('*')
          .in('id', eventIds)
          
        if (eventError) throw eventError

        attendanceRecords = attendanceData.map(att => ({
          ...att,
          event: eventsData?.find(e => e.id === att.event_id) || undefined
        })).filter(r => r.event) as AttendanceWithEvent[]
      }

      const stats = calculateAttendanceStats(attendanceRecords, user.join_date)
      setAttendanceStats(stats)
    } catch (error) {
      console.error('통계 로딩 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (view === "dashboard") {
      loadStats()
    }
  }, [user.id, view])

  const handleRefresh = () => {
    loadStats()
  }

  // 화면 전환 처리
  if (view === "team-attendance") {
    return <TeamAttendance user={user} onBack={() => setView("dashboard")} />
  }

  if (view === "admin") {
    return <AdminPage user={user} onBack={() => setView("dashboard")} />
  }

  // 오늘 날짜 포맷
  const today = new Date()
  const dateString = today.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })

  // 직책 표시 (tag가 없으면 position, 그것도 없으면 '선수')
  const userRoleText = user.tag || user.position || '선수'

  return (
    <div className="min-h-screen bg-black pb-20 font-sans tracking-tight text-white">
      {/* 1. Header Area - Sticky & Blur */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-zinc-800/50 px-6 py-4 flex justify-between items-center transition-all duration-300">
         {/* 로고 영역 */}
         <div className="flex items-center gap-2">
            <Image src="/JB_Logo_White.png" alt="Logo" width={24} height={24} className="object-contain" />
            <Image src="/JBORCA_title.png" alt="Title" width={90} height={22} className="object-contain" />
          </div>
        
        {/* 버튼 영역 */}
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={handleRefresh} className="text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full w-9 h-9">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onLogout} className="text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full w-9 h-9">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* 2. Greeting Section (Scrollable Area) */}
      <section className="px-6 pt-8 pb-6">
          {/* 개인화 인사말 - 직책 반영 */}
          <h1 className="text-3xl font-bold leading-tight mb-2">
            <span className="text-zinc-500">안녕하세요,</span><br/>
            <span className="text-white">{user.name} {userRoleText}님</span>
          </h1>
          <p className="text-zinc-600 text-sm font-medium">{dateString}</p>
      </section>

      {/* 3. My Stats (Bento Grid) - 컬러감 추가 */}
      <section className="px-6 mb-10">
        <h2 className="sr-only">My Stats</h2>
        <div className="grid grid-cols-2 gap-3 h-44">
           {/* Big Card: Attendance Rate (Blue Tint) */}
           <div className="bg-gradient-to-br from-blue-950/30 to-zinc-900 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden group border border-blue-900/20">
              <div className="absolute -top-2 -right-2 p-4 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                <CalendarDays className="w-24 h-24 text-blue-200" />
              </div>
              <div>
                <span className="text-blue-400/70 text-xs font-bold block mb-1">전체 출석률</span>
                <div className="flex items-baseline">
                  <span className="text-5xl font-black text-white tracking-tighter">{attendanceStats.attendanceRate}</span>
                  <span className="text-xl text-zinc-600 font-bold ml-1">%</span>
                </div>
              </div>
              <div className="w-full bg-zinc-800/50 h-1.5 rounded-full overflow-hidden mt-2">
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                  style={{ width: `${attendanceStats.attendanceRate}%` }}
                />
              </div>
              <div className="flex flex-col items-end mt-2">
                <p className="text-[10px] text-zinc-500 font-medium">
                  {attendanceStats.totalAttendance} / {attendanceStats.totalEvents} 회 참석
                </p>
                <p className="text-[10px] text-blue-300/90 font-bold mt-1 tracking-tight text-right break-keep leading-tight">
                  {getAttendanceMessage(attendanceStats.attendanceRate)}
                </p>
              </div>
           </div>
           
           <div className="flex flex-col gap-3">
             {/* Small Card 1: Streak (Orange/Fire Tint) */}
             <div className="bg-gradient-to-br from-orange-950/30 to-zinc-900 rounded-3xl p-4 flex-1 flex flex-col justify-center relative overflow-hidden group border border-orange-900/20">
                <div className="absolute -right-2 -bottom-2 opacity-[0.08] group-hover:opacity-15 transition-opacity">
                  <Flame className="w-16 h-16 text-orange-500" />
                </div>
                <span className="text-orange-400/70 text-[10px] font-bold mb-1">연속 출석</span>
                <div className="flex items-baseline gap-1 relative z-10">
                  <span className="text-3xl font-black text-white tracking-tighter">{attendanceStats.consecutiveAttendance}</span>
                  <span className="text-xs text-zinc-600 font-bold">주</span>
                </div>
             </div>
             
             {/* Small Card 2: Points (Yellow/Gold Tint) */}
             <div className="bg-gradient-to-br from-yellow-950/30 to-zinc-900 rounded-3xl p-4 flex-1 flex flex-col justify-center relative overflow-hidden group border border-yellow-900/20">
                 <div className="absolute -right-2 -bottom-2 opacity-[0.08] group-hover:opacity-15 transition-opacity">
                  <Trophy className="w-16 h-16 text-yellow-500" />
                </div>
                <span className="text-yellow-400/70 text-[10px] font-bold mb-1">내 포인트</span>
                <div className="flex items-baseline gap-1 relative z-10">
                   <span className="text-3xl font-black text-white tracking-tighter">{user.total_points || 0}</span>
                   <span className="text-xs text-zinc-600 font-bold">PTS</span>
                </div>
             </div>
           </div>
        </div>
      </section>

      {/* 4. Manager Actions (Moved Up) */}
      {user.role === 'manager' && (
        <section className="px-6 mb-8">
          <div className="bg-zinc-900 rounded-3xl p-1 border border-zinc-800/50 flex">
            <Button 
              variant="ghost" 
              className="flex-1 h-12 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 flex flex-col items-center justify-center gap-0.5"
              onClick={() => setView("team-attendance")}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="text-xs font-bold">팀 출석 관리</span>
              </div>
            </Button>
            <div className="w-[1px] bg-zinc-800 my-2"></div>
            <Button 
              variant="ghost" 
              className="flex-1 h-12 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 flex flex-col items-center justify-center gap-0.5"
              onClick={() => setView("admin")}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span className="text-xs font-bold">관리자 페이지</span>
              </div>
            </Button>
          </div>
        </section>
      )}

      {/* 5. Vote Section */}
      <section className="px-6 mb-10">
        <VotingSection user={user} />
      </section>

      {/* 6. SCHEDULE (New) */}
      <section className="px-6 mb-10">
        <AttendanceCalendar user={user} />
      </section>

      {/* 7. Ranking & Point System */}
      <section className="px-6 space-y-10">
        <div>
          {/* 타이틀 수정: ATTENDANCE RANKING */}
          <h2 className="text-lg font-black italic tracking-tight text-white mb-4 px-1">ATTENDANCE RANKING</h2>
          <AttendanceRanking />
        </div>
        
        <div>
          <h2 className="text-lg font-black italic tracking-tight text-white mb-4 px-1">POINT SYSTEM</h2>
          <PointSystem user={user} />
        </div>
      </section>
    </div>
  )
}
