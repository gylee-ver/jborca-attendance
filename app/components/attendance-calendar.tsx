"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
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
      const eventsData = await eventService.getAllEvents()
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

  const getEventTypeName = (type: string): string => {
    switch (type) {
      case "regular": return "정기 모임"
      case "guerrilla": return "게릴라 훈련"
      case "league": return "리그 경기"
      case "mercenary": return "용병 경기"
      case "tournament": return "토너먼트 대회"
      default: return "기타"
    }
  }

  const handleCreateEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time || !newEvent.location) {
      alert("모든 필수 항목을 입력해주세요.")
      return
    }

    setIsCreating(true)
    try {
      const { success, error } = await eventService.createEvent(newEvent)
      
      if (success) {
        alert("일정이 생성되었습니다.")
        setIsDialogOpen(false)
        fetchEvents()
        // 초기화
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
      } else {
        alert(error || "일정 생성 중 오류가 발생했습니다.")
      }
    } catch (error) {
      console.error('일정 생성 오류:', error)
      alert("일정 생성 중 오류가 발생했습니다.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("정말로 이 일정을 삭제하시겠습니까? 관련된 모든 출석 데이터도 함께 삭제됩니다.")) {
      return
    }

    try {
      const { success, error } = await eventService.deleteEvent(eventId, user.id)
      
      if (success) {
        alert("일정이 삭제되었습니다.")
        fetchEvents()
      } else {
        alert(error || "일정 삭제 중 오류가 발생했습니다.")
      }
    } catch (error) {
      console.error('일정 삭제 오류:', error)
      alert("일정 삭제 중 오류가 발생했습니다.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black italic tracking-tight text-white flex items-center gap-2">
          SCHEDULE
        </h2>
        
        {user.role === 'manager' && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-8 px-3 text-xs font-bold border-zinc-700 hover:bg-zinc-800 text-zinc-300">
                <Plus className="w-3 h-3 mr-1" /> 일정 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
              <DialogHeader>
                <DialogTitle>새 일정 만들기</DialogTitle>
                <DialogDescription>새로운 팀 일정을 등록합니다.</DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">일정 제목</Label>
                  <Input
                    id="title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="bg-zinc-800 border-zinc-700"
                    placeholder="일정 제목을 입력하세요"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="date">날짜</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="time">시간</Label>
                    <Input
                      id="time"
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="location">장소</Label>
                  <Input
                    id="location"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    className="bg-zinc-800 border-zinc-700"
                    placeholder="장소를 입력하세요"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="type">일정 유형</Label>
                  <Select 
                    value={newEvent.type} 
                    onValueChange={(value: any) => setNewEvent({ ...newEvent, type: value })}
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700">
                      <SelectValue placeholder="유형 선택" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      <SelectItem value="regular">정기 모임</SelectItem>
                      <SelectItem value="guerrilla">게릴라 훈련</SelectItem>
                      <SelectItem value="league">리그 경기</SelectItem>
                      <SelectItem value="mercenary">용병 경기</SelectItem>
                      <SelectItem value="tournament">토너먼트 대회</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">추가 설명</Label>
                  <Textarea
                    id="description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="bg-zinc-800 border-zinc-700"
                    placeholder="일정에 대한 추가 설명을 입력하세요"
                  />
                </div>
              </div>

              <Button onClick={handleCreateEvent} disabled={isCreating} className="bg-white text-black hover:bg-zinc-200 font-bold">
                {isCreating ? "생성 중..." : "일정 만들기"}
              </Button>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-500 mx-auto"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-zinc-800 rounded-xl">
            <p className="text-zinc-500 text-sm">등록된 일정이 없습니다.</p>
          </div>
        ) : (
          <>
            {events.slice(0, showAllEvents ? undefined : 3).map((event) => (
              <div key={event.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex justify-between items-start hover:border-zinc-600 transition-colors group">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="border-zinc-700 text-zinc-400 font-bold rounded bg-zinc-800/50 text-[10px]">
                      {getEventTypeName(event.type)}
                    </Badge>
                    {event.status === 'completed' && (
                      <span className="text-[10px] font-bold text-zinc-600 line-through decoration-zinc-600">종료됨</span>
                    )}
                    {event.is_mandatory && event.status !== 'completed' && (
                      <span className="text-[10px] font-bold text-red-500">필수</span>
                    )}
                  </div>
                  <h3 className={`font-bold text-base mb-1.5 ${event.status === 'completed' ? 'text-zinc-500' : 'text-white'}`}>
                    {event.title}
                  </h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {event.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {event.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {event.location}
                    </span>
                  </div>
                </div>
                {user.role === 'manager' && (
                  <Button 
                    onClick={() => handleDeleteEvent(event.id)}
                    variant="ghost" 
                    size="icon" 
                    className="text-zinc-600 hover:text-red-500 h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            
            {events.length > 3 && (
              <Button
                onClick={() => setShowAllEvents(!showAllEvents)}
                variant="ghost"
                className="w-full text-zinc-500 hover:text-white text-xs py-2 h-auto"
              >
                {showAllEvents ? (
                  <span className="flex items-center gap-1">접기 <ChevronUp className="w-3 h-3" /></span>
                ) : (
                  <span className="flex items-center gap-1">지난 일정 더보기 ({events.length - 3}개) <ChevronDown className="w-3 h-3" /></span>
                )}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
