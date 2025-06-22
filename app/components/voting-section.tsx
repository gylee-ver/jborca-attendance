"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, MapPin, Clock, Calendar, Users, AlertCircle, ChevronLeft, ChevronRight, Settings } from "lucide-react"
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
    ['감독', '수석코치', '투수코치', '배터리코치', '수비코치'].includes(user.tag)

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
    updateVoteState(eventId, { absentReason: reason })
  }

  const handleSubmit = async (eventId: string) => {
    const voteState = voteStates[eventId]
    if (!voteState) return

    if (voteState.selectedOption === "absent" && !voteState.absentReason.trim()) {
      alert("불참 사유를 입력해주세요.")
      return
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

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "regular": return "bg-blue-500"
      case "guerrilla": return "bg-orange-500"
      case "league": return "bg-green-500"
      case "mercenary": return "bg-purple-500"
      case "tournament": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  const getEventTypeName = (type: string) => {
    switch (type) {
      case "regular": return "정기모임"
      case "guerrilla": return "게릴라"
      case "league": return "리그"
      case "mercenary": return "용병"
      case "tournament": return "토너먼트"
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
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-400 mt-2 text-sm">일정 확인 중...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (upcomingEvents.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-yellow-500 flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>투표해주세요!</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Calendar className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400">예정된 일정이 없습니다</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentEvent = upcomingEvents[currentEventIndex]
  const voteState = voteStates[currentEvent.id]
  const timeInfo = calculateTimeUntilEvent(currentEvent.date, currentEvent.time)

  return (
    <Card className="bg-gray-900 border-gray-800">
      {/* 헤더 */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-yellow-500 flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>투표해주세요!</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            {upcomingEvents.length > 1 && (
              <span className="text-xs text-gray-400">
                {currentEventIndex + 1} / {upcomingEvents.length}
              </span>
            )}
            {currentEvent.is_mandatory && (
              <Badge className="bg-red-500 text-white text-xs px-2 py-1">필수</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 이벤트 티켓 */}
        <div className="relative">
          {/* 이벤트 카드 */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-750 rounded-lg p-4 border border-gray-700 relative">
            {/* 이벤트 정보 */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-white font-semibold text-lg mb-1">{currentEvent.title}</h3>
                <div className="flex items-center space-x-3 text-sm text-gray-300">
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(currentEvent.date).toLocaleDateString("ko-KR", { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {currentEvent.time}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <Badge className={`${getEventTypeColor(currentEvent.type)} text-white text-xs`}>
                  {getEventTypeName(currentEvent.type)}
                </Badge>
              </div>
            </div>

            <div className="flex items-center text-sm text-gray-400 mb-2">
              <MapPin className="w-4 h-4 mr-1" />
              <span>{currentEvent.location}</span>
            </div>

            <div className="flex items-center text-sm text-gray-400">
              <Users className="w-4 h-4 mr-1" />
              <span>필요인원 {currentEvent.required_staff_count}명</span>
            </div>

            {/* 횡스크롤 버튼 - 우측 하단 모서리 (항상 두 버튼 표시) */}
            {upcomingEvents.length > 1 && (
              <div className="absolute bottom-2 right-2 flex">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prevEvent}
                  disabled={currentEventIndex === 0}
                  className={`w-6 h-6 p-0 rounded-sm mr-1 ${
                    currentEventIndex === 0 
                      ? 'bg-gray-700/40 text-gray-500 cursor-not-allowed' 
                      : 'bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 hover:text-white'
                  }`}
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={nextEvent}
                  disabled={currentEventIndex === upcomingEvents.length - 1}
                  className={`w-6 h-6 p-0 rounded-sm ${
                    currentEventIndex === upcomingEvents.length - 1
                      ? 'bg-gray-700/40 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 hover:text-white'
                  }`}
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {/* 시간 정보 - 이벤트 티켓 아래 */}
          <div className="mt-2 text-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              timeInfo.isStarted 
                ? 'bg-red-900/30 text-red-400 border border-red-800/50' 
                : 'bg-blue-900/30 text-blue-400 border border-blue-800/50'
            }`}>
              <Clock className="w-4 h-4 mr-1" />
              {timeInfo.text}
            </div>
          </div>
        </div>

        {/* 투표 섹션 */}
        {timeInfo.isStarted ? (
          <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
            <div className="flex items-center justify-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-red-400 text-sm">투표 마감</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 코칭스태프 안내 메시지 */}
            {isCoachingStaff && (
              <div className="p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Settings className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-blue-400 font-medium">코칭스태프 안내</p>
                    <p className="text-blue-300/80 text-xs mt-1">
                      일정 변경이 필요한 경우 관리자 페이지의 '내 일정 요청'을 통해 신청해주세요.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 투표 버튼 */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={voteState?.selectedOption === "attend" ? "default" : "outline"}
                onClick={() => handleVoteOptionChange(currentEvent.id, "attend")}
                className={`h-12 ${
                  voteState?.selectedOption === "attend"
                    ? "bg-green-600 hover:bg-green-700 text-white border-green-600"
                    : "border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500"
                }`}
                disabled={voteState?.isSubmitted}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                참석
              </Button>
              <Button
                variant={voteState?.selectedOption === "absent" ? "default" : "outline"}
                onClick={() => handleVoteOptionChange(currentEvent.id, "absent")}
                className={`h-12 ${
                  voteState?.selectedOption === "absent"
                    ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                    : isCoachingStaff
                    ? "border-gray-700 text-gray-500 bg-gray-800/50 cursor-not-allowed"
                    : "border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500"
                }`}
                disabled={!!(voteState?.isSubmitted || isCoachingStaff)}
              >
                <XCircle className="w-4 h-4 mr-2" />
                {isCoachingStaff ? "일정 요청 필요" : "불참"}
              </Button>
            </div>

            {/* 불참 사유 (코칭스태프가 아닌 경우만) */}
            {voteState?.selectedOption === "absent" && !isCoachingStaff && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">불참 사유</label>
                <Textarea
                  value={voteState.absentReason}
                  onChange={(e) => handleAbsentReasonChange(currentEvent.id, e.target.value)}
                  placeholder="불참 사유를 입력해주세요..."
                  className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 resize-none"
                  rows={2}
                  disabled={voteState.isSubmitted}
                  maxLength={255}
                />
              </div>
            )}

            {/* 제출/변경 버튼 */}
            {voteState?.selectedOption && (
              <>
                {!voteState.isSubmitted ? (
                  <Button
                    onClick={() => handleSubmit(currentEvent.id)}
                    className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={voteState.isSubmitting}
                  >
                    {voteState.isSubmitting ? "제출 중..." : "투표 제출"}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="p-2 bg-green-900/20 border border-green-800/50 rounded text-center">
                      <p className="text-green-400 text-sm">
                        ✓ {voteState.selectedOption === "attend" ? "참석" : "불참"} 투표 완료
                      </p>
                    </div>
                    <Button
                      onClick={() => handleChangeVote(currentEvent.id)}
                      variant="outline"
                      className="w-full h-9 border-gray-600 text-gray-300 hover:bg-gray-800 text-sm"
                    >
                      투표 변경
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
