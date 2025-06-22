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

  const getEventTypeColor = (type: string): string => {
    switch (type) {
      case 'league': return 'bg-red-600'
      case 'friendly': return 'bg-green-600'
      case 'training': return 'bg-yellow-600'
      case 'event': return 'bg-purple-600'
      default: return 'bg-blue-600'
    }
  }

  const getEventTypeName = (type: string): string => {
    switch (type) {
      case 'league': return '리그'
      case 'friendly': return '친선경기'
      case 'training': return '훈련'
      case 'event': return '이벤트'
      default: return '정기모임'
    }
  }

  if (selectedPlayer) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="bg-gray-900 border-b border-gray-800 p-4">
          <div className="max-w-md mx-auto flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedPlayer(null)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-bold text-lg">{selectedPlayer.name}의 출석 현황</h1>
              <p className="text-sm text-gray-400">#{selectedPlayer.number} · {selectedPlayer.role === "manager" ? "매니저" : "선수"}</p>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto p-4 space-y-4">
          {/* 출석 통계 카드 */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <LucideUser className="w-5 h-5" />
                <span>출석 통계</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-white">
                    {selectedPlayer.stats?.attendance_rate || 0}%
                  </div>
                  <div className="text-sm text-gray-400">출석률</div>
                </div>
                <div className="p-3 bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-green-500">
                    {selectedPlayer.stats?.attended_events || 0}
                  </div>
                  <div className="text-sm text-gray-400">참석</div>
                </div>
                <div className="p-3 bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-red-500">
                    {(selectedPlayer.stats?.total_events || 0) - (selectedPlayer.stats?.attended_events || 0)}
                  </div>
                  <div className="text-sm text-gray-400">불참</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 상세 출석 기록 - 스크롤 제거 및 UI 개선 */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>출석 기록</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isDetailLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                  <p className="text-gray-400 mt-2">출석 기록 로딩 중...</p>
                </div>
              ) : (
              <div className="space-y-3">
                  {playerAttendance.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">출석 기록이 없습니다</p>
                  ) : (
                    playerAttendance.map((record, index) => {
                      // 안전한 날짜 파싱 함수
                      const safeDateParse = (dateStr: string, timeStr?: string) => {
                        try {
                          if (!dateStr) return null
                          const timeValue = timeStr || '00:00'
                          const dateTime = new Date(`${dateStr}T${timeValue}:00`)
                          return isNaN(dateTime.getTime()) ? null : dateTime
                        } catch (error) {
                          console.warn('날짜 파싱 오류:', { dateStr, timeStr, error })
                          return null
                        }
                      }

                      const eventDateTime = record.event ? safeDateParse(record.event.date, record.event.time) : null
                      const isUpcoming = eventDateTime && eventDateTime > new Date()
                      const isPending = record.actual_status === 'unknown' && record.voted_status !== 'pending'
                      const isPastEvent = eventDateTime && eventDateTime < new Date()
                      
                      // 편집 가능 조건을 더 유연하게 수정
                      const canEdit = isPastEvent && record.actual_status !== 'unknown'
                      
                      // 디버깅용 로그 (안전한 버전)
                      console.log(`Event: ${record.event?.title}`, {
                        eventDateTime: eventDateTime ? eventDateTime.toISOString() : 'Invalid Date',
                        isPastEvent,
                        actual_status: record.actual_status,
                        canEdit,
                        rawDate: record.event?.date,
                        rawTime: record.event?.time
                      })

                      return (
                        <div key={`${record.id}-${index}`} className="relative p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                          {/* 헤더 섹션 */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              {/* 상태 아이콘 */}
                              <div className="flex-shrink-0">
                                {record.actual_status === "attended" ? (
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : record.actual_status === "absent" ? (
                                  <XCircle className="w-5 h-5 text-red-500" />
                                ) : isPending ? (
                                  <Clock className="w-5 h-5 text-yellow-500" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-gray-500" />
                                )}
                              </div>
                              
                              {/* 이벤트 제목 */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-white text-base truncate">
                                  {record.event?.title || "제목 없음"}
                                </h3>
                              </div>
                            </div>
                            
                            {/* 배지 영역 */}
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <Badge className={`${getEventTypeColor(record.event?.type || 'regular')} text-white text-xs px-2 py-1`}>
                                {getEventTypeName(record.event?.type || 'regular')}
                              </Badge>
                              {isUpcoming && (
                                <Badge className="bg-blue-600 text-white text-xs px-2 py-1">예정</Badge>
                              )}
                            </div>
                          </div>

                          {/* 날짜 및 시간 정보 */}
                          <div className="mb-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-white font-medium">
                                  {eventDateTime ? eventDateTime.toLocaleDateString("ko-KR", {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    weekday: 'short'
                                  }) : (record.event?.date || "날짜 없음")}
                                </span>
                                {record.event?.time && (
                                  <span className="text-gray-400 text-sm">
                                    {record.event.time}
                                  </span>
                                )}
                              </div>
                              
                              {/* 참석 예정/불참 예정 표시 */}
                              {record.actual_status === 'unknown' && record.voted_status !== 'pending' && (
                                <Badge variant="outline" className="text-yellow-400 border-yellow-400 text-xs">
                                  {record.voted_status === 'attending' ? '참석 예정' : '불참 예정'}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* 장소 정보 */}
                          {record.event?.location && (
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-4 h-4 text-gray-400 text-center">📍</div>
                              <span className="text-gray-400 text-sm">{record.event.location}</span>
                            </div>
                          )}

                          {/* 불참 사유 */}
                          {record.actual_status === "absent" && record.absence_reason && (
                            <div className="mt-2 p-2 bg-red-900/20 border border-red-800 rounded">
                              <p className="text-red-400 text-sm">
                                <span className="font-medium">불참 사유:</span> {record.absence_reason}
                              </p>
                            </div>
                          )}

                          {/* 메모 */}
                          {record.notes && (
                            <div className="mt-2 p-2 bg-gray-700 rounded">
                              <p className="text-gray-300 text-sm">
                                <span className="font-medium">메모:</span> {record.notes}
                              </p>
                            </div>
                          )}

                          {/* 우측 하단 편집 버튼 */}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute bottom-3 right-3 h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full opacity-80 hover:opacity-100 transition-all duration-200"
                              onClick={() => updateAttendanceStatus(record.id, record.actual_status)}
                              disabled={isUpdating === record.id}
                              title={`${record.actual_status === 'attended' ? '불참' : '참석'}으로 변경`}
                            >
                              {isUpdating === record.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border border-white border-t-transparent"></div>
                              ) : (
                                <Edit3 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          
                          {/* 디버깅용 정보 표시 (임시) */}
                          {isPastEvent && (
                            <div className="absolute top-2 left-2 text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded">
                              Status: {record.actual_status} | CanEdit: {canEdit ? 'Yes' : 'No'}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
              </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="max-w-md mx-auto flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-bold text-lg">선수단 전체 출석 현황</h1>
            <p className="text-sm text-gray-400">선수를 선택하여 상세 정보를 확인하세요</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
            <p className="text-gray-400 mt-2">선수단 데이터 로딩 중...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg">
              <p className="text-red-400">{error}</p>
              <Button 
                onClick={() => window.location.reload()} 
                className="mt-4 bg-red-600 hover:bg-red-700"
              >
                다시 시도
              </Button>
            </div>
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-8">
            <LucideUser className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">선수단 데이터가 없습니다</p>
            <p className="text-sm text-gray-500 mt-2">데이터베이스에 선수 정보가 등록되지 않았습니다.</p>
          </div>
        ) : (
        <div className="grid grid-cols-2 gap-3">
          {players.map((player) => (
            <Button
              key={player.id}
              variant="outline"
                onClick={() => fetchPlayerDetail(player)}
              className="h-auto p-4 bg-gray-900 border-gray-800 hover:bg-gray-800 text-left"
            >
              <div className="w-full">
                <div className="flex items-center space-x-2 mb-2">
                  <LucideUser className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-white">#{player.number}</span>
                    {player.role === "manager" && (
                      <Badge className="bg-purple-600 text-white text-xs">매니저</Badge>
                    )}
                </div>
                <div className="text-white font-medium mb-1">{player.name}</div>
                  <div className="text-sm text-gray-400">
                    출석률 {player.stats?.attendance_rate || 0}%
                  </div>
                <div className="text-xs text-gray-500">
                    {player.stats?.attended_events || 0}/{player.stats?.total_events || 0} 참석
                </div>
              </div>
            </Button>
          ))}
        </div>
        )}
      </div>
    </div>
  )
}
