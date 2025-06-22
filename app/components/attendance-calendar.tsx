"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Plus, MapPin, Clock, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { eventService, type Event, type User } from "@/lib/supabase"

interface AttendanceCalendarProps {
  user: User
}

export default function AttendanceCalendar({ user }: AttendanceCalendarProps) {
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [showAllEvents, setShowAllEvents] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    time: "14:00",
    location: "안산 해양야구장",
    type: "regular" as const,
    description: "",
    is_mandatory: true,
    required_staff_count: 15
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const fetchEvents = async () => {
    try {
      // 모든 이벤트를 가져와서 최신순으로 정렬
      const eventsData = await eventService.getAllEvents()
      // 날짜 기준으로 내림차순 정렬 (최신 일정이 먼저)
      const sortedEvents = eventsData.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`)
        const dateB = new Date(`${b.date}T${b.time}`)
        return dateB.getTime() - dateA.getTime()
      })
      setEvents(sortedEvents)
    } catch (error) {
      console.error('이벤트 데이터 로딩 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const getEventTypeColor = (type: string): string => {
    switch (type) {
      case "regular":
        return "bg-blue-600"
      case "guerrilla":
        return "bg-orange-600"
      case "league":
        return "bg-green-600"
      case "mercenary":
        return "bg-purple-600"
      case "tournament":
        return "bg-red-600"
      default:
        return "bg-gray-600"
    }
  }

  const getEventTypeName = (type: string): string => {
    switch (type) {
      case "regular":
        return "정기 모임"
      case "guerrilla":
        return "게릴라 훈련"
      case "league":
        return "리그 경기"
      case "mercenary":
        return "용병 경기"
      case "tournament":
        return "토너먼트 대회"
      default:
        return "기타"
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "completed":
        return "text-green-400"
      case "cancelled":
        return "text-red-400"
      case "upcoming":
        return "text-blue-400"
      case "ongoing":
        return "text-yellow-400"
      default:
        return "text-gray-400"
    }
  }

  const getStatusName = (status: string): string => {
    switch (status) {
      case "completed":
        return "완료"
      case "cancelled":
        return "취소"
      case "upcoming":
        return "예정"
      case "ongoing":
        return "진행중"
      default:
        return "알 수 없음"
    }
  }

  const validateEventForm = (): string | null => {
    if (!newEvent.title.trim()) return "제목을 입력해주세요."
    if (!newEvent.date) return "날짜를 선택해주세요."
    if (!newEvent.time) return "시간을 선택해주세요."
    if (!newEvent.location.trim()) return "장소를 입력해주세요."
    
    // 과거 날짜 체크
    const eventDateTime = new Date(`${newEvent.date}T${newEvent.time}`)
    const now = new Date()
    if (eventDateTime <= now) {
      return "미래 날짜와 시간을 선택해주세요."
    }

    return null
  }

  const handleAddEvent = async () => {
    const validationError = validateEventForm()
    if (validationError) {
      alert(validationError)
      return
    }

    setIsCreating(true)
    try {
      const { event, error } = await eventService.createEvent({
        title: newEvent.title.trim(),
        description: newEvent.description.trim() || undefined,
        date: newEvent.date,
        time: newEvent.time,
        location: newEvent.location.trim(),
        type: newEvent.type,
        is_mandatory: newEvent.is_mandatory,
        required_staff_count: newEvent.required_staff_count,
        created_by: user.id
      })

      if (error) {
        alert(error)
        return
      }

      if (event) {
        // UI에 새 이벤트 즉시 추가 (최신순으로 정렬)
        setEvents(prevEvents => {
          const updatedEvents = [event, ...prevEvents]
          return updatedEvents.sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time}`)
            const dateB = new Date(`${b.date}T${b.time}`)
            return dateB.getTime() - dateA.getTime()
          })
        })
        
        // 폼 초기화
        setNewEvent({
          title: "",
          date: "",
          time: "14:00",
          location: "안산 해양야구장",
          type: "regular",
          description: "",
          is_mandatory: true,
          required_staff_count: 15
        })
        
        setIsDialogOpen(false)
        alert("일정이 성공적으로 추가되었습니다!\n모든 선수단 멤버가 투표할 수 있습니다.")
      }
    } catch (error) {
      console.error('이벤트 생성 오류:', error)
      alert("일정 추가 중 오류가 발생했습니다.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    // 삭제 확인 대화상자
    const confirmMessage = `"${eventTitle}" 일정을 삭제하시겠습니까?\n\n⚠️ 주의사항:\n- 해당 일정과 관련된 모든 출석 기록이 함께 삭제됩니다\n- 이 작업은 되돌릴 수 없습니다\n\n정말 삭제하시겠습니까?`
    
    if (!confirm(confirmMessage)) {
      return
    }

    console.log(`🚀 이벤트 삭제 요청 시작 - "${eventTitle}" (ID: ${eventId})`)

    try {
      const { success, error } = await eventService.deleteEvent(eventId, user.id)
      
      console.log(`📋 삭제 결과:`, { success, error })
      
      if (error) {
        console.error('❌ 삭제 실패:', error)
        alert(`삭제 실패: ${error}`)
        return
      }

      if (success) {
        console.log(`🎉 삭제 성공 - UI 업데이트 시작`)
        
        // 방법 1: UI에서 즉시 제거
        setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId))
        
        // 방법 2: 서버에서 데이터 다시 불러오기 (더 안전)
        setTimeout(() => {
          fetchEvents() // 1초 후 데이터 새로고침
        }, 1000)
        
        // 성공 메시지
        alert(`✅ "${eventTitle}" 일정이 삭제되었습니다.`)
        
        console.log(`🎉 이벤트 "${eventTitle}" (ID: ${eventId}) 삭제 완료`)
      }
    } catch (error) {
      console.error('💥 이벤트 삭제 중 예외:', error)
      alert(`일정 삭제 중 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.`)
    }
  }

  // 표시할 이벤트 결정 (5개 또는 전체)
  const displayedEvents = showAllEvents ? events : events.slice(0, 5)
  const hasMoreEvents = events.length > 5

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>일정 캘린더</span>
          </CardTitle>
          {user.role === "manager" && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-1" />
                  일정 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
                <DialogHeader>
                  <DialogTitle>새 일정 추가</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    새로운 팀 일정을 추가합니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600">
                  <div className="space-y-2">
                    <Label htmlFor="title">제목 *</Label>
                    <Input
                      id="title"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="bg-gray-800 border-gray-700"
                      placeholder="일정 제목을 입력하세요"
                      maxLength={100}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">날짜 *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={newEvent.date}
                        onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                        className="bg-gray-800 border-gray-700"
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">시간 *</Label>
                      <Input
                        id="time"
                        type="time"
                        value={newEvent.time}
                        onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                        className="bg-gray-800 border-gray-700"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="location">장소 *</Label>
                    <Input
                      id="location"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      className="bg-gray-800 border-gray-700"
                      placeholder="장소를 입력하세요"
                      maxLength={100}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="type">일정 유형 *</Label>
                    <Select 
                      value={newEvent.type} 
                      onValueChange={(value: "regular" | "guerrilla" | "league" | "mercenary" | "tournament") => 
                        setNewEvent({ ...newEvent, type: value })
                      }
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="regular">정기 모임</SelectItem>
                        <SelectItem value="guerrilla">게릴라 훈련</SelectItem>
                        <SelectItem value="league">리그 경기</SelectItem>
                        <SelectItem value="mercenary">용병 경기</SelectItem>
                        <SelectItem value="tournament">토너먼트 대회</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">설명 (선택사항)</Label>
                    <Textarea
                      id="description"
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      className="bg-gray-800 border-gray-700"
                      placeholder="일정에 대한 추가 설명을 입력하세요"
                      rows={3}
                      maxLength={255}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="required_staff">필요 인원</Label>
                      <Input
                        id="required_staff"
                        type="number"
                        value={newEvent.required_staff_count}
                        onChange={(e) => setNewEvent({ 
                          ...newEvent, 
                          required_staff_count: Math.max(1, parseInt(e.target.value) || 15)
                        })}
                        className="bg-gray-800 border-gray-700"
                        min="1"
                        max="30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>필수 참석</Label>
                      <Select 
                        value={newEvent.is_mandatory ? "true" : "false"} 
                        onValueChange={(value) => setNewEvent({ 
                          ...newEvent, 
                          is_mandatory: value === "true" 
                        })}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="true">필수</SelectItem>
                          <SelectItem value="false">선택</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button 
                    onClick={handleAddEvent} 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={isCreating}
                  >
                    {isCreating ? "생성 중..." : "일정 추가"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
            <p className="text-gray-400 mt-2">일정 데이터 로딩 중...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">등록된 일정이 없습니다</p>
            {user.role === "manager" && (
              <p className="text-sm text-gray-500 mt-2">새 일정을 추가해보세요!</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* 일정 목록 - 일정한 높이 유지 + 얇은 스크롤바 */}
            <div className="h-[580px] overflow-y-auto space-y-3 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">
              {displayedEvents.map((event) => (
                <div key={event.id} className="relative p-4 bg-gray-800/70 rounded-xl border border-gray-700/50 hover:bg-gray-800/90 transition-all duration-200">
                  {/* 우측 상단 뱃지들 */}
                  <div className="absolute top-3 right-3 flex flex-col items-end space-y-1">
                    <Badge className={`${getEventTypeColor(event.type)} text-white text-xs px-2 py-1`}>
                      {getEventTypeName(event.type)}
                    </Badge>
                  </div>

                  {/* 우측 하단 상태 표시 및 휴지통 버튼 */}
                  <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                    <span className={`text-base font-semibold ${getStatusColor(event.status)}`}>
                      {getStatusName(event.status)}
                    </span>
                    {/* 휴지통 버튼 - 예정 오른편 */}
                    {user.role === "manager" && event.status === "upcoming" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEvent(event.id, event.title)}
                        className="p-1.5 h-7 w-7 hover:bg-red-600/20 transition-colors rounded-lg flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-300" />
                      </Button>
                    )}
                  </div>

                  {/* 이벤트 헤더 */}
                  <div className="flex items-start justify-between mb-3 pr-20">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-base leading-tight mb-1 pr-2">
                        {event.title}
                      </h3>
                    </div>
                  </div>

                  {/* 이벤트 정보 */}
                  <div className="grid grid-cols-1 gap-2 mb-3 pr-16">
                    <div className="flex items-center text-sm text-gray-300">
                      <div className="flex items-center space-x-2 w-full">
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="font-medium">
                          {new Date(event.date).toLocaleDateString("ko-KR", {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short'
                          })}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-300">
                      <div className="flex items-center space-x-2 w-full">
                        <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>{event.time}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-300">
                      <div className="flex items-center space-x-2 w-full">
                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* 이벤트 설명 */}
                  {event.description && (
                    <div className="pt-2 border-t border-gray-700/50 pr-16 pb-6">
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {event.description}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* 더보기/접기 버튼 */}
            {hasMoreEvents && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowAllEvents(!showAllEvents)}
                  className="text-gray-400 hover:text-white hover:bg-gray-800"
                >
                  {showAllEvents ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      접기
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      더보기 ({events.length - 5}개 더)
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
