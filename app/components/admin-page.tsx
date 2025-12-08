"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  ArrowLeft, Users, Calendar, CheckCircle, XCircle, AlertTriangle, 
  Vote, Clock, UserCheck, UserX, AlertCircle, ChevronDown, ChevronUp, 
  Loader2, MoreHorizontal, Copy, Minus
} from "lucide-react"
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { eventService, attendanceService, statsService, adminService, staffRequestService, supabase, type Event, type User as UserType, type Attendance, type StaffRequestWithEvent } from "@/lib/supabase"

interface AdminPageProps {
  user: UserType
  onBack: () => void
}

interface EventVotingStatus {
  event: Event
  attendingUsers: (UserType & { attendance: Attendance })[]
  absentUsers: (UserType & { attendance: Attendance })[]
  pendingUsers: UserType[]
  totalUsers: number
}

interface CoachingStaffEventStatus {
  event: Event
  attendingStaff: Array<UserType & { attendance: Attendance }>
  absentStaff: Array<UserType & { attendance: Attendance }>
  pendingStaff: UserType[]
  totalStaff: number
  attendingCount: number
  absentCount: number
  pendingCount: number
}

export default function AdminPage({ user, onBack }: AdminPageProps) {
  // State
  const [eventVotingData, setEventVotingData] = useState<EventVotingStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [coachingStaffEventsData, setCoachingStaffEventsData] = useState<CoachingStaffEventStatus[]>([])
  const [coachingStaffEventsLoading, setCoachingStaffEventsLoading] = useState(true)
  
  const [allStaffRequests, setAllStaffRequests] = useState<StaffRequestWithEvent[]>([])
  const [allStaffRequestsLoading, setAllStaffRequestsLoading] = useState(true)

  // Permissions
  // 코치 일정 탭 접근 권한: 단장 추가
  const isCoachingStaff = user.role === 'manager' && user.tag && 
    ['단장', '감독', '수석코치', '투수코치', '배터리코치', '수비코치', '타격코치'].includes(user.tag)
  
  const canManageStaffRequests = user.role === 'manager' && user.tag && 
    ['단장', '감독'].includes(user.tag)

  // Data Fetching
  const loadVotingStatus = async () => {
    try {
      setIsLoading(true)
      const { data: users } = await supabase.from('users').select('*').eq('is_active', true).order('number')
      const { data: upcomingEvents } = await supabase.from('events').select('*').eq('status', 'upcoming').order('date').order('time')

      if (!upcomingEvents || upcomingEvents.length === 0) {
        setEventVotingData([])
        return
      }

      const eventVotingResults = await Promise.all(upcomingEvents.map(async (event) => {
        const { data: attendance } = await supabase.from('attendance').select('*').eq('event_id', event.id)
        const att = attendance || []
        
        const attendingUsers: any[] = []
        const absentUsers: any[] = []
        const pendingUsers: any[] = []

        users?.forEach(u => {
          const record = att.find(a => a.user_id === u.id)
          if (record) {
            if (record.voted_status === 'attending') attendingUsers.push({ ...u, attendance: record })
            else if (record.voted_status === 'absent') absentUsers.push({ ...u, attendance: record })
            else pendingUsers.push(u)
          } else {
            pendingUsers.push(u)
          }
        })

        return { event, attendingUsers, absentUsers, pendingUsers, totalUsers: users?.length || 0 }
      }))

      setEventVotingData(eventVotingResults)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadCoachingStaffEventsData = async () => {
    try {
      setCoachingStaffEventsLoading(true)
      const result = await adminService.getCoachingStaffEventsStatus()
      if (!result.error) setCoachingStaffEventsData(result.events)
    } catch (error) {
      console.error(error)
    } finally {
      setCoachingStaffEventsLoading(false)
    }
  }

  const loadAllStaffRequests = async () => {
    if (!canManageStaffRequests) return
    try {
      setAllStaffRequestsLoading(true)
      // 모든 대기 중인 요청을 가져오고, 렌더링 시 필터링
      const requests = await staffRequestService.getPendingStaffRequests()
      setAllStaffRequests(requests)
    } catch (error) {
      console.error(error)
    } finally {
      setAllStaffRequestsLoading(false)
    }
  }

  useEffect(() => {
    loadVotingStatus()
    if (isCoachingStaff) loadCoachingStaffEventsData()
    if (canManageStaffRequests) loadAllStaffRequests()
  }, [])

  // Handlers
  const handleApproveStaffRequest = async (requestId: string, requesterId: string) => {
    if (!confirm('이 요청을 승인하시겠습니까?')) return
    try {
      const canApproveResult = await staffRequestService.canApproveRequest(user.id, requesterId)
      if (!canApproveResult.canApprove) {
        alert(canApproveResult.reason)
        return
      }
      const result = await staffRequestService.approveRequestWithAttendanceUpdate(requestId, user.id)
      if (result.success) {
        alert('승인되었습니다.')
        loadAllStaffRequests()
      } else {
        alert(result.error)
      }
    } catch (error) {
      console.error(error)
      alert('오류가 발생했습니다.')
    }
  }

  const handleRejectStaffRequest = async (requestId: string, requesterId: string) => {
    if (!confirm('이 요청을 거절하시겠습니까?')) return
    try {
      const result = await staffRequestService.updateRequestStatus(requestId, 'rejected')
      if (result.success) {
        alert('거절되었습니다.')
        loadAllStaffRequests()
      } else {
        alert(result.error)
      }
    } catch (error) {
      console.error(error)
      alert('오류가 발생했습니다.')
    }
  }

  // Filter requests based on user role and rules
  const getFilteredRequests = () => {
    if (!allStaffRequests) return []
    
    return allStaffRequests.filter(req => {
      const requesterTag = req.requester?.tag
      
      if (user.tag === '단장') {
        // Rule 1: 단장은 감독의 일정만 관리한다.
        return requesterTag === '감독'
      } else if (user.tag === '감독') {
        // Rule 2: 감독은 코치의 일정만 관리한다.
        const coachTags = ['수석코치', '투수코치', '배터리코치', '수비코치', '타격코치']
        return coachTags.includes(requesterTag || '')
      }
      // 그 외 관리자는 볼 수 없음 (혹은 코치 본인은 자신의 요청을 볼 수도 있지만 여기는 관리자 페이지)
      return false
    })
  }

  const filteredRequests = getFilteredRequests()

  // Helper
  const getRequestTypeText = (type: string) => {
    switch (type) {
      case 'absence': return '결석'
      case 'late_arrival': return '지각'
      case 'early_departure': return '조퇴'
      case 'partial_absence': return '부분 불참'
      default: return type
    }
  }

  const getDday = (dateStr: string) => {
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    target.setHours(0,0,0,0);
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "D-Day";
    if (diff < 0) return `D+${Math.abs(diff)}`;
    return `D-${diff}`;
  }

  const handleCopyAttendanceList = (data: EventVotingStatus) => {
    const { event, attendingUsers, absentUsers, pendingUsers } = data
    
    const title = `[${event.date} ${event.time} ${event.title} 투표 현황]`
    
    // 참석자: 이름 (등번호)
    const attendingText = attendingUsers.length > 0
      ? `✅ 참석 (${attendingUsers.length}명)\n` + attendingUsers.map(u => `- ${u.name} (${u.number})`).join(', ')
      : `✅ 참석 (0명)\n- 없음`

    // 불참자: 이름 (등번호): 사유
    const absentText = absentUsers.length > 0
      ? `❌ 불참 (${absentUsers.length}명)\n` + absentUsers.map(u => `- ${u.name} (${u.number}): ${u.attendance.absence_reason || '사유 없음'}`).join('\n')
      : `❌ 불참 (0명)\n- 없음`

    // 미투표자: 이름
    const pendingText = pendingUsers.length > 0
      ? `❓ 미투표 (${pendingUsers.length}명)\n` + pendingUsers.map(u => `- ${u.name}`).join(', ')
      : `❓ 미투표 (0명)\n- 없음`

    const fullText = `${title}\n\n${attendingText}\n\n${absentText}\n\n${pendingText}`

    navigator.clipboard.writeText(fullText).then(() => {
      alert('명단이 클립보드에 복사되었습니다.')
    }).catch(err => {
      console.error('복사 실패:', err)
      alert('복사에 실패했습니다.')
    })
  }

  return (
    <div className="min-h-screen bg-black pb-20 font-sans text-white">
      {/* 헤더 */}
      <header className="bg-black/80 backdrop-blur-md border-b border-zinc-800 p-4 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-2 text-zinc-400 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-lg font-black text-white tracking-tight italic">ADMIN DASHBOARD</h1>
        </div>
      </header>

      <main className="p-0">
        <Tabs defaultValue="voting" className="w-full">
          {/* 탭 디자인 개선: 심플하고 직관적인 Border-bottom 스타일 */}
          <div className="sticky top-[73px] z-40 bg-black/95 backdrop-blur border-b border-zinc-800">
            <TabsList className="w-full flex h-auto p-0 bg-transparent rounded-none">
              <TabsTrigger 
                value="voting" 
                className="flex-1 rounded-none border-b-2 border-transparent py-4 text-sm font-bold text-zinc-500 data-[state=active]:border-white data-[state=active]:text-white data-[state=active]:bg-transparent transition-colors shadow-none"
              >
                투표 현황
              </TabsTrigger>
              <TabsTrigger 
                value="coaching" 
                className="flex-1 rounded-none border-b-2 border-transparent py-4 text-sm font-bold text-zinc-500 data-[state=active]:border-white data-[state=active]:text-white data-[state=active]:bg-transparent transition-colors shadow-none"
              >
                코치 일정
              </TabsTrigger>
              <TabsTrigger 
                value="requests" 
                className="flex-1 rounded-none border-b-2 border-transparent py-4 text-sm font-bold text-zinc-500 data-[state=active]:border-white data-[state=active]:text-white data-[state=active]:bg-transparent transition-colors shadow-none"
              >
                요청 관리
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 1. 투표 현황 (UI/UX 개편) */}
          <TabsContent value="voting" className="space-y-8 p-4">
            {isLoading ? (
              <div className="text-center py-10 text-zinc-500 text-sm">로딩 중...</div>
            ) : eventVotingData.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                예정된 투표가 없습니다.
              </div>
            ) : (
              eventVotingData.map((data) => (
                <div key={data.event.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-12 last:mb-0 shadow-2xl">
                  {/* Event Header */}
                  <div className="bg-black/50 border-b border-zinc-800 p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl -mr-10 -mt-10"></div>
                    
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px] uppercase tracking-wider">{data.event.type}</Badge>
                      <span className="text-xs font-bold text-white bg-zinc-800 border border-zinc-700 px-2.5 py-1 rounded-full">{getDday(data.event.date)}</span>
                    </div>
                    <h3 className="font-black text-2xl text-white italic tracking-tight mb-2 relative z-10">{data.event.title}</h3>
                    <div className="flex items-center justify-between mt-4 relative z-10">
                      <div className="flex items-center text-xs text-zinc-400 font-medium">
                        <Calendar className="w-3.5 h-3.5 mr-1.5 text-zinc-500" /> {data.event.date}
                        <Clock className="w-3.5 h-3.5 ml-4 mr-1.5 text-zinc-500" /> {data.event.time}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleCopyAttendanceList(data)} 
                        className="h-8 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all rounded-lg"
                      >
                        <Copy className="w-3.5 h-3.5 mr-1.5" /> 명단 복사
                      </Button>
                    </div>
                  </div>

                  <div className="p-5 bg-zinc-900">
                    {/* Status Summary Cards (Bento Grid) */}
                    <div className="grid grid-cols-3 gap-3 mb-8">
                      <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden group">
                          <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors"></div>
                          <span className="text-[10px] text-emerald-400 font-bold mb-1 uppercase tracking-wider z-10">Attending</span>
                          <span className="text-2xl font-black text-white z-10">{data.attendingUsers.length}</span>
                      </div>
                      <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden group">
                          <div className="absolute inset-0 bg-red-500/5 group-hover:bg-red-500/10 transition-colors"></div>
                          <span className="text-[10px] text-red-400 font-bold mb-1 uppercase tracking-wider z-10">Absent</span>
                          <span className="text-2xl font-black text-white z-10">{data.absentUsers.length}</span>
                      </div>
                      <div className="bg-zinc-800/30 border border-zinc-800/50 rounded-xl p-3 flex flex-col items-center justify-center relative overflow-hidden group">
                          <div className="absolute inset-0 bg-zinc-500/5 group-hover:bg-zinc-500/10 transition-colors"></div>
                          <span className="text-[10px] text-zinc-500 font-bold mb-1 uppercase tracking-wider z-10">Pending</span>
                          <span className="text-2xl font-black text-zinc-400 z-10">{data.pendingUsers.length}</span>
                      </div>
                    </div>

                    {/* Detailed Lists */}
                    <div className="grid grid-cols-1 gap-8">
                       {/* 1. Attending List */}
                       <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-800/50">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                              <h4 className="font-bold text-sm text-emerald-100">참석 명단</h4>
                          </div>
                          {data.attendingUsers.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {data.attendingUsers.map(u => (
                                  <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-zinc-800/80 hover:border-emerald-900/50 transition-colors group">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-zinc-200 group-hover:text-white transition-colors">{u.name}</span>
                                        {u.role === 'manager' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" title="코칭스태프"></span>}
                                      </div>
                                      <Badge variant="outline" className="border-emerald-900/40 text-emerald-500/80 bg-emerald-950/10 text-[10px] px-1.5 h-5">{u.number}</Badge>
                                  </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-600 pl-2 italic">참석자가 없습니다.</p>
                          )}
                       </div>
                       
                       {/* 2. Absent List */}
                       <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-800/50">
                              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                              <h4 className="font-bold text-sm text-red-100">불참 명단</h4>
                          </div>
                          {data.absentUsers.length > 0 ? (
                            <div className="space-y-2">
                              {data.absentUsers.map(u => (
                                  <div key={u.id} className="bg-black/40 border border-red-900/20 rounded-lg p-3 group hover:border-red-900/40 transition-colors">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-sm text-zinc-200">{u.name}</span>
                                          <Badge variant="outline" className="border-red-900/40 text-red-500/80 bg-red-950/10 text-[10px] px-1.5 h-5">{u.number}</Badge>
                                        </div>
                                      </div>
                                      <div className="text-xs text-zinc-400 bg-red-950/10 p-2.5 rounded border-l-2 border-red-900/50 leading-relaxed">
                                        {u.attendance.absence_reason || '사유 없음'}
                                      </div>
                                  </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-600 pl-2 italic">불참자가 없습니다.</p>
                          )}
                       </div>

                       {/* 3. Pending List */}
                       <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-800/50">
                              <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                              <h4 className="font-bold text-sm text-zinc-400">미투표 명단</h4>
                          </div>
                          {data.pendingUsers.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {data.pendingUsers.map(u => (
                                  <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800 text-zinc-500">
                                      <span className="text-xs font-medium">{u.name}</span>
                                  </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-600 pl-2 italic">미투표자가 없습니다.</p>
                          )}
                       </div>
                    </div>

                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* 2. 코치 일정 */}
          <TabsContent value="coaching" className="space-y-4 p-4">
            {!isCoachingStaff ? (
              <div className="text-center py-10 text-zinc-500 text-sm">접근 권한이 없습니다.</div>
            ) : coachingStaffEventsLoading ? (
              <div className="text-center py-10 text-zinc-500 text-sm">로딩 중...</div>
            ) : coachingStaffEventsData.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                예정된 일정이 없습니다.
              </div>
            ) : (
              coachingStaffEventsData.map((data) => (
                <Card key={data.event.id} className="bg-zinc-900 border-zinc-800 shadow-none">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base font-bold text-white">{data.event.title}</CardTitle>
                    <CardDescription className="text-xs text-zinc-500">{data.event.date}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      {data.attendingStaff.map(staff => (
                        <div key={staff.id} className="bg-black border border-zinc-800 rounded p-2 flex justify-between items-center">
                          <span className="text-xs font-bold text-white">{staff.tag || staff.name}</span>
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      ))}
                      {data.absentStaff.map(staff => (
                        <div key={staff.id} className="bg-black border border-zinc-800 rounded p-2 flex justify-between items-center opacity-50">
                          <span className="text-xs font-bold text-zinc-400">{staff.tag || staff.name}</span>
                          <XCircle className="w-3 h-3 text-zinc-500" />
                        </div>
                      ))}
                      {data.pendingStaff.map(staff => (
                        <div key={staff.id} className="bg-black border border-zinc-800 rounded p-2 flex justify-between items-center opacity-50">
                          <span className="text-xs font-bold text-zinc-400">{staff.tag || staff.name}</span>
                          <span className="text-[10px] text-zinc-600">미정</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* 3. 요청 관리 */}
          <TabsContent value="requests" className="space-y-4 p-4">
            {!canManageStaffRequests ? (
              <div className="text-center py-10 text-zinc-500 text-sm">관리 권한이 없습니다.</div>
            ) : allStaffRequestsLoading ? (
              <div className="text-center py-10 text-zinc-500 text-sm">로딩 중...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
                대기 중인 요청이 없습니다.
              </div>
            ) : (
              filteredRequests.map((request) => (
                <div key={request.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-white text-black hover:bg-zinc-200 text-xs font-bold">
                        {request.requester?.tag || request.requester?.name}
                      </Badge>
                      <span className="text-sm font-bold text-white">{getRequestTypeText(request.request_type)}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{new Date(request.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="bg-black rounded-lg p-3 mb-4 border border-zinc-800">
                    <p className="text-xs text-zinc-400 font-medium mb-1">{request.event?.title}</p>
                    <p className="text-sm text-white">{request.reason_detail}</p>
                    {request.has_substitute && (
                      <p className="text-xs text-zinc-500 mt-2 pt-2 border-t border-zinc-800">
                        대체자: {request.substitute?.name} ({request.substitute?.tag})
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={() => handleApproveStaffRequest(request.id, request.requester_id)}
                      className="bg-white text-black hover:bg-zinc-200 h-10 font-bold text-xs"
                    >
                      승인
                    </Button>
                    <Button 
                      onClick={() => handleRejectStaffRequest(request.id, request.requester_id)}
                      variant="outline" 
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-10 font-bold text-xs"
                    >
                      거부
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
