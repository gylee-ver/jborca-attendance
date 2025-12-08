"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, MapPin, Clock, Calendar, AlertCircle, ChevronLeft, ChevronRight, Vote } from "lucide-react"
import { eventService, attendanceService, type Event, type User } from "@/lib/supabase"

interface VotingSectionProps {
  user: User
}

interface EventVoteState {
  selectedOption: "attend" | "absent" | null
  absentReason: string
  isSubmitted: boolean
  isSubmitting: boolean
}

export default function VotingSection({ user }: VotingSectionProps) {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [voteStates, setVoteStates] = useState<Record<string, EventVoteState>>({})
  const [currentEventIndex, setCurrentEventIndex] = useState(0)

  // 코칭스태프 여부 확인
  const isCoachingStaff = user.role === 'manager' && user.tag && 
    ['감독', '수석코치', '투수코치', '배터리코치', '수비코치', '타격코치'].includes(user.tag)

  const calculateTimeUntilEvent = useCallback((eventDate: string, eventTime: string) => {
    const now = new Date()
    const eventDateTime = new Date(`${eventDate}T${eventTime}`)
    const diffMs = eventDateTime.getTime() - now.getTime()

    if (diffMs <= 0) {
      return { text: "이벤트가 시작되었습니다", isStarted: true }
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) {
      return { text: `${days}일 ${hours}시간 ${minutes}분 후`, isStarted: false }
    } else if (hours > 0) {
      return { text: `${hours}시간 ${minutes}분 후`, isStarted: false }
    } else {
      return { text: `${minutes}분 후`, isStarted: false }
    }
  }, [])

  const fetchUpcomingEvents = useCallback(async () => {
    try {
      await eventService.checkAndUpdateAllEventStatuses()
      const events = await eventService.getUpcomingEvents()
      
      if (events && events.length > 0) {
        setUpcomingEvents(events)
        
        const initialVoteStates: Record<string, EventVoteState> = {}
        
        for (const event of events) {
          const existingVote = await attendanceService.getUserEventAttendance(user.id, event.id)
          
          if (existingVote && existingVote.voted_status !== 'pending') {
            initialVoteStates[event.id] = {
              selectedOption: existingVote.voted_status === 'attending' ? 'attend' : 'absent',
              absentReason: existingVote.absence_reason || '',
              isSubmitted: true,
              isSubmitting: false
            }
          } else {
            initialVoteStates[event.id] = {
              selectedOption: null,
              absentReason: '',
              isSubmitted: false,
              isSubmitting: false
            }
          }
        }
        
        setVoteStates(initialVoteStates)
      } else {
        setUpcomingEvents([])
        setVoteStates({})
      }
    } catch (error) {
      console.error('예정 이벤트 로딩 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    fetchUpcomingEvents()
  }, [fetchUpcomingEvents])

  const updateVoteState = (eventId: string, updates: Partial<EventVoteState>) => {
    setVoteStates(prev => ({
      ...prev,
      [eventId]: { ...prev[eventId], ...updates }
    }))
  }

  const handleVoteOptionChange = (eventId: string, option: "attend" | "absent") => {
    const currentState = voteStates[eventId]
    if (currentState?.isSubmitted) return

    // 코칭스태프는 불참 클릭 시 관리자 페이지로 안내
    if (isCoachingStaff && option === "absent") {
      alert("코칭스태프는 일정 변경이 필요한 경우 관리자 페이지에서 '내 일정 요청'을 통해 신청해주세요.")
      return
    }

    updateVoteState(eventId, { 
      selectedOption: option,
      absentReason: option === 'attend' ? '' : currentState?.absentReason || ''
    })
  }

  const handleAbsentReasonChange = (eventId: string, reason: string) => {
    // 공백을 제외한 글자 수 계산 (한글 기준)
    const trimmedReason = reason.replace(/\s/g, '')
    
    // 20자 제한 확인
    if (trimmedReason.length > 20) {
      return // 20자를 초과하면 입력을 제한
    }
    
    updateVoteState(eventId, { absentReason: reason })
  }

  const handleSubmit = async (eventId: string) => {
    const voteState = voteStates[eventId]
    if (!voteState) return

    if (voteState.selectedOption === "absent") {
      const trimmedReason = voteState.absentReason.trim()
      const reasonWithoutSpaces = trimmedReason.replace(/\s/g, '')
      
      if (!trimmedReason) {
        alert("불참 사유를 입력해주세요.")
        return
      }
      
      if (reasonWithoutSpaces.length < 20) {
        alert("불참 사유는 공백 제외 20자 이상 입력해주세요.")
        return
      }
    }

    const event = upcomingEvents.find(e => e.id === eventId)
    if (!event) return

    const timeInfo = calculateTimeUntilEvent(event.date, event.time)
    if (timeInfo.isStarted) {
      alert("이벤트가 이미 시작되어 투표할 수 없습니다.")
      return
    }

    updateVoteState(eventId, { isSubmitting: true })

    try {
      const result = await attendanceService.submitVote(
        user.id,
        eventId,
        voteState.selectedOption === 'attend' ? 'attending' : 'absent',
        voteState.selectedOption === 'absent' ? voteState.absentReason : undefined
      )

      if (result.success) {
        updateVoteState(eventId, { isSubmitted: true, isSubmitting: false })
        alert("투표가 완료되었습니다!")
      } else {
        alert(result.error || "투표 제출 중 오류가 발생했습니다.")
        updateVoteState(eventId, { isSubmitting: false })
      }
    } catch (error) {
      alert("투표 제출 중 오류가 발생했습니다.")
      updateVoteState(eventId, { isSubmitting: false })
    }
  }

  const handleChangeVote = (eventId: string) => {
    updateVoteState(eventId, {
      isSubmitted: false,
      selectedOption: null,
      absentReason: ''
    })
  }

  const getEventTypeName = (type: string) => {
    switch (type) {
      case "regular": return "정기 모임"
      case "guerrilla": return "게릴라 훈련"
      case "league": return "리그 경기"
      case "mercenary": return "용병 경기"
      case "tournament": return "토너먼트 대회"
      default: return "기타"
    }
  }

  const nextEvent = () => {
    setCurrentEventIndex(prev => 
      prev < upcomingEvents.length - 1 ? prev + 1 : prev
    )
  }

  const prevEvent = () => {
    setCurrentEventIndex(prev => prev > 0 ? prev - 1 : prev)
  }

  if (isLoading) {
    return (
      <div className="py-10 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-zinc-500 text-sm">일정 확인 중...</p>
      </div>
    )
  }

  if (upcomingEvents.length === 0) {
    return (
      <div className="py-16 text-center border border-zinc-800 rounded-xl bg-zinc-900/50 border-dashed">
        <Calendar className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-500 font-medium">예정된 일정이 없습니다</p>
        <p className="text-zinc-600 text-sm mt-1">새로운 일정이 등록되면 알려드릴게요</p>
      </div>
    )
  }

  const currentEvent = upcomingEvents[currentEventIndex]
  const voteState = voteStates[currentEvent.id]
  const timeInfo = calculateTimeUntilEvent(currentEvent.date, currentEvent.time)

  return (
    <div className="space-y-4">
      {/* 헤더: 타이틀 + 인디케이터 */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-black italic tracking-tight text-white flex items-center gap-2">
          VOTE NOW
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
        </h2>
        
        {upcomingEvents.length > 1 && (
          <div className="flex items-center gap-1 bg-zinc-900 rounded-full px-3 py-1 border border-zinc-800">
            <button onClick={prevEvent} disabled={currentEventIndex === 0} className="text-zinc-400 hover:text-white disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-zinc-300 font-mono">
              {currentEventIndex + 1} / {upcomingEvents.length}
            </span>
            <button onClick={nextEvent} disabled={currentEventIndex === upcomingEvents.length - 1} className="text-zinc-400 hover:text-white disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 메인 카드 - Emerald/Green Tint 컬러감 추가 */}
      <div className="bg-gradient-to-br from-emerald-950/30 to-zinc-900 text-white rounded-2xl p-6 relative overflow-hidden border border-emerald-900/20 shadow-2xl group">
        {/* 배경 데코 - 아이콘 추가 */}
        <div className="absolute -right-6 -top-6 opacity-[0.05] pointer-events-none group-hover:opacity-10 transition-opacity duration-500 rotate-12">
          <Vote className="w-40 h-40 text-emerald-500" />
        </div>
        
        {/* 배지 영역 */}
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div className="flex gap-2">
            <Badge variant="outline" className="h-6 px-2 text-[11px] font-bold border-zinc-600 text-zinc-300 bg-zinc-800/80 backdrop-blur-sm rounded-md">
              {getEventTypeName(currentEvent.type)}
            </Badge>
            {currentEvent.is_mandatory && (
              <Badge className="h-6 px-2 text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white border border-red-500 rounded-md shadow-sm">
                필수참석
              </Badge>
            )}
          </div>
          
          <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
            timeInfo.isStarted 
              ? "bg-zinc-800 text-zinc-400 border border-zinc-700" 
              : "bg-red-600 text-white border border-red-500 shadow-[0_0_10px_rgba(220,38,38,0.4)] animate-pulse"
          }`}>
            <Clock className="w-3 h-3" />
            {timeInfo.text}
          </div>
        </div>

        {/* 타이틀 & 정보 */}
        <div className="relative z-10 mb-8">
          <h3 className="text-2xl font-black mb-3 leading-tight break-keep text-white drop-shadow-sm">
            {currentEvent.title}
          </h3>
          <div className="space-y-2 text-sm font-medium text-zinc-300">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              {new Date(currentEvent.date).toLocaleDateString("ko-KR", { month: 'long', day: 'numeric', weekday: 'long' })}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              {currentEvent.time}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              {currentEvent.location}
            </div>
          </div>
        </div>

        {/* 투표 버튼 영역 - 스타일 조정 */}
        {!timeInfo.isStarted && (
          <div className="relative z-10">
            {isCoachingStaff && (
              <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-900/30 rounded-lg text-xs text-emerald-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                코칭스태프는 불참 시 '관리자 페이지'에서 일정 요청을 제출해주세요.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVoteOptionChange(currentEvent.id, "attend")}
                disabled={voteState?.isSubmitted}
                className={`h-12 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 duration-200
                  ${voteState?.selectedOption === "attend" 
                    ? "bg-white text-black shadow-lg shadow-white/10 scale-[1.02]" 
                    : "bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700 hover:border-zinc-500"}`}
              >
                <CheckCircle className={`w-4 h-4 ${voteState?.selectedOption === "attend" ? "text-emerald-600" : ""}`} /> 참석
              </button>

              <button
                onClick={() => handleVoteOptionChange(currentEvent.id, "absent")}
                disabled={!!(voteState?.isSubmitted || isCoachingStaff)}
                className={`h-12 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 duration-200
                  ${voteState?.selectedOption === "absent" 
                    ? "bg-zinc-700 text-white border border-zinc-600 scale-[1.02] shadow-lg" 
                    : isCoachingStaff
                      ? "bg-zinc-900/50 text-zinc-600 border border-zinc-800 cursor-not-allowed"
                      : "bg-zinc-800/50 text-zinc-300 hover:bg-red-950/50 hover:text-red-200 border border-zinc-700 hover:border-red-900/50"}`}
              >
                <XCircle className="w-4 h-4" /> 불참
              </button>
            </div>

            {/* 불참 사유 입력 및 제출 */}
            {voteState?.selectedOption && (
              <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                {voteState.selectedOption === "absent" && !isCoachingStaff && (
                  <div className="bg-black/40 p-3 rounded-xl border border-zinc-700/50">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-zinc-400">불참 사유 (필수)</label>
                      <span className={`text-[10px] font-mono ${
                        voteState.absentReason.replace(/\s/g, '').length < 20 ? "text-red-400" : "text-green-500"
                      }`}>
                        {voteState.absentReason.replace(/\s/g, '').length}/20
                      </span>
                    </div>
                    <Textarea
                      value={voteState.absentReason}
                      onChange={(e) => handleAbsentReasonChange(currentEvent.id, e.target.value)}
                      placeholder="사유를 구체적으로 입력해주세요..."
                      className="bg-zinc-900/80 border-zinc-700 text-white placeholder:text-zinc-600 text-sm min-h-[80px] resize-none focus-visible:ring-emerald-500"
                    />
                  </div>
                )}

                {!voteState.isSubmitted ? (
                  <Button
                    onClick={() => handleSubmit(currentEvent.id)}
                    className="w-full h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-base rounded-xl shadow-lg shadow-emerald-900/20 transition-all duration-200"
                    disabled={voteState.isSubmitting}
                  >
                    {voteState.isSubmitting ? "처리 중..." : "투표 제출하기"}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 font-bold text-sm animate-in zoom-in duration-200">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      제출 완료
                    </div>
                    <Button
                      onClick={() => handleChangeVote(currentEvent.id)}
                      variant="outline"
                      className="h-12 px-4 border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white rounded-xl"
                    >
                      수정
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 투표 마감 표시 */}
        {timeInfo.isStarted && (
          <div className="mt-6 p-4 bg-zinc-800/50 border border-zinc-800 rounded-xl text-center">
            <p className="text-zinc-500 font-medium text-sm">투표가 마감되었습니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
