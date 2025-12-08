"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, TrendingUp, CheckCircle, XCircle, Clock, User as LucideUser, Edit3 } from "lucide-react"
import { statsService, attendanceService, type User, type UserWithStats, type AttendanceWithEvent } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

interface UserProps {
  name: string
  number: string
  role: "player" | "manager"
  id: string
}

interface TeamAttendanceProps {
  user: UserProps
  onBack: () => void
}

export default function TeamAttendance({ user, onBack }: TeamAttendanceProps) {
  const [players, setPlayers] = useState<UserWithStats[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<UserWithStats | null>(null)
  const [playerAttendance, setPlayerAttendance] = useState<AttendanceWithEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchPlayersData()
  }, [])

  const fetchPlayersData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const allPlayers = await statsService.getAllUserStats(2025)
      setPlayers(allPlayers)
    } catch (err) {
      console.error('선수단 데이터 로딩 오류:', err)
      setError('선수단 데이터를 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPlayerDetail = async (player: UserWithStats) => {
    try {
      setSelectedPlayer(player)
      setIsDetailLoading(true)
      
      const attendance = await attendanceService.getUserAttendance(player.id)
      setPlayerAttendance(attendance)
    } catch (err) {
      console.error('선수 상세 정보 로딩 오류:', err)
      toast({
        title: "데이터 로딩 실패",
        description: "선수 상세 정보를 불러오는데 실패했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsDetailLoading(false)
    }
  }

  const updateAttendanceStatus = async (attendanceId: string, currentStatus: string) => {
    if (isUpdating) return

    setIsUpdating(attendanceId)
    
    try {
      // 현재 상태와 반대로 변경
      const newStatus = currentStatus === 'attended' ? 'absent' : 'attended'
      
      const success = await attendanceService.updateAttendanceStatus(attendanceId, newStatus)
      
      if (success) {
        // UI 즉시 업데이트
        setPlayerAttendance(prev => 
          prev.map(record => 
            record.id === attendanceId 
              ? { ...record, actual_status: newStatus, confirmed_at: new Date().toISOString() }
              : record
          )
        )

        // 선수 통계도 다시 가져오기
        if (selectedPlayer) {
          const updatedStats = await statsService.getUserStats(selectedPlayer.id, 2025)
          setSelectedPlayer({
            ...selectedPlayer,
            stats: updatedStats
          })

          // 전체 선수 목록도 업데이트
          setPlayers(prev => 
            prev.map(p => 
              p.id === selectedPlayer.id 
                ? { ...p, stats: updatedStats }
                : p
            )
          )
        }

        toast({
          title: "출석 상태 업데이트 완료",
          description: newStatus === 'attended' ? "참석으로 변경되었습니다." : "불참으로 변경되었습니다.",
        })
      } else {
        toast({
          title: "업데이트 실패",
          description: "출석 상태 업데이트에 실패했습니다.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('출석 상태 업데이트 오류:', error)
      toast({
        title: "오류 발생",
        description: "시스템 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(null)
    }
  }

  // 관리자 권한 확인 (현재 사용자가 관리자인지)
  const canEdit = user.role === 'manager'

  if (selectedPlayer) {
    return (
      <div className="min-h-screen bg-black pb-20">
        {/* 상세 헤더 */}
        <header className="bg-black border-b border-zinc-800 p-4 sticky top-0 z-50">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => setSelectedPlayer(null)} className="mr-2 text-zinc-400 hover:text-white">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                {selectedPlayer.name}
                <Badge variant="outline" className="text-zinc-400 border-zinc-700">{selectedPlayer.number}</Badge>
              </h1>
            </div>
          </div>
        </header>

        <main className="p-4 space-y-6">
          {/* 선수 요약 카드 */}
          <Card className="bg-zinc-900 border-zinc-800 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">2025 시즌 요약</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-black rounded-xl border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1 font-bold">출석률</p>
                  <p className="text-xl font-black text-white">{selectedPlayer.stats?.attendance_rate || 0}%</p>
                </div>
                <div className="text-center p-3 bg-black rounded-xl border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1 font-bold">출석</p>
                  <p className="text-xl font-black text-white">{selectedPlayer.stats?.attended_events || 0}</p>
                </div>
                <div className="text-center p-3 bg-black rounded-xl border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1 font-bold">전체</p>
                  <p className="text-xl font-black text-white">{selectedPlayer.stats?.total_events || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 출석 히스토리 */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white px-1">출석 히스토리</h3>
            
            {isDetailLoading ? (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-zinc-500 text-sm">데이터를 불러오는 중...</p>
              </div>
            ) : playerAttendance.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl">
                <p className="text-zinc-500 text-sm">출석 기록이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {playerAttendance.map((record) => {
                  const isPastEvent = record.event && new Date(`${record.event.date}T${record.event.time}`) < new Date()
                  
                  return (
                    <div key={record.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-white text-base mb-1">{record.event?.title}</h4>
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {record.event?.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {record.event?.time}
                            </span>
                          </div>
                        </div>
                        <Badge className={`
                          ${record.actual_status === 'attended' ? 'bg-white text-black hover:bg-zinc-200' : 
                            record.actual_status === 'absent' ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 
                            'bg-zinc-800 text-zinc-500 border-zinc-700'}
                          border-none font-bold px-2.5 py-0.5
                        `}>
                          {record.actual_status === 'attended' ? '출석' : 
                           record.actual_status === 'absent' ? '불참' : 
                           record.actual_status === 'late' ? '지각' : 
                           record.actual_status === 'early_leave' ? '조퇴' : '미정'}
                        </Badge>
                      </div>

                      {/* 투표 상태 표시 */}
                      <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between items-center">
                        <div className="text-xs">
                          <span className="text-zinc-600 mr-2">투표:</span>
                          <span className={`font-medium ${
                            record.voted_status === 'attending' ? 'text-green-500' :
                            record.voted_status === 'absent' ? 'text-red-500' : 'text-zinc-500'
                          }`}>
                            {record.voted_status === 'attending' ? '참석 예정' :
                             record.voted_status === 'absent' ? '불참 예정' : '미투표'}
                          </span>
                        </div>
                        
                        {/* 관리자용 수정 버튼 */}
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-zinc-500 hover:text-white hover:bg-zinc-800"
                            onClick={() => updateAttendanceStatus(record.id, record.actual_status)}
                            disabled={isUpdating === record.id}
                          >
                            {isUpdating === record.id ? (
                              <div className="animate-spin rounded-full h-3 w-3 border border-zinc-500 border-t-transparent"></div>
                            ) : (
                              <Edit3 className="w-3.5 h-3.5 mr-1" />
                            )}
                            <span className="text-xs">상태 변경</span>
                          </Button>
                        )}
                      </div>
                      
                      {/* 불참 사유 표시 */}
                      {record.absence_reason && (
                        <div className="mt-2 p-2 bg-black rounded text-xs text-zinc-400 border border-zinc-800">
                          <span className="text-zinc-600 mr-1">사유:</span>
                          {record.absence_reason}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* 헤더 */}
      <header className="bg-black border-b border-zinc-800 p-4 sticky top-0 z-50">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-2 text-zinc-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-black text-white tracking-tight italic">TEAM MANAGEMENT</h1>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* 선수 목록 카드 */}
        <Card className="bg-zinc-900 border-zinc-800 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <LucideUser className="w-5 h-5" />
                선수단 목록
              </span>
              <Badge variant="outline" className="text-zinc-400 border-zinc-700">{players.length}명</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-zinc-500 text-sm">데이터를 불러오는 중...</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {players.map((player) => (
                  <div 
                    key={player.id} 
                    className="py-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 px-2 rounded-lg transition-colors -mx-2"
                    onClick={() => fetchPlayerDetail(player)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center border border-zinc-800 font-bold text-zinc-400">
                        {player.number}
                      </div>
                      <div>
                        <p className="text-white font-bold">{player.name}</p>
                        <p className="text-xs text-zinc-500">{player.position || '포지션 미정'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1 mb-1">
                        <TrendingUp className="w-3 h-3 text-zinc-500" />
                        <span className="text-sm font-bold text-white">{player.stats?.attendance_rate || 0}%</span>
                      </div>
                      <p className="text-xs text-zinc-600">
                        {player.stats?.attended_events || 0}/{player.stats?.total_events || 0}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
