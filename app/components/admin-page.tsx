"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Users, Calendar, CheckCircle, XCircle, AlertTriangle, Vote, Clock, UserCheck, UserX, ChevronLeft, ChevronRight, Plus, Edit, Trash2, AlertCircle } from "lucide-react"
import { eventService, attendanceService, statsService, adminService, staffRequestService, supabase, type Event, type User as UserType, type Attendance, type StaffRequest, type StaffRequestWithEvent } from "@/lib/supabase"

interface User {
  name: string
  number: string
  role: "player" | "manager"
  tag?: string
}

interface Request {
  id: number
  date: string
  type: string
  reason: string
  status: "pending" | "approved" | "rejected"
}

interface Staff {
  id: number
  name: string
  number: string
  role: "manager"
  requests: Request[]
}

interface CriticalEvent {
  date: string
  event: string
  requiredStaff: number
}

interface AdminPageProps {
  user: User
  onBack: () => void
}

// 이벤트별 투표 현황 인터페이스
interface EventVotingStatus {
  event: Event
  attendingUsers: (UserType & { attendance: Attendance })[]
  absentUsers: (UserType & { attendance: Attendance })[]
  pendingUsers: UserType[]
  totalUsers: number
}

// 중요 일정 현황을 위한 새로운 인터페이스
interface CriticalEventStatus {
  event: Event
  attendingUsers: Array<UserType & { attendance: Attendance }>
  absentUsers: Array<UserType & { attendance: Attendance }>
  pendingUsers: UserType[]
  totalUsers: number
  attendingCount: number
  absentCount: number
  pendingCount: number
}

// 코칭스태프 중요 일정 현황을 위한 새로운 인터페이스
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

// 안전한 ID 생성을 위한 카운터
let requestIdCounter = 1000

export default function AdminPage({ user, onBack }: AdminPageProps) {
  const [eventVotingData, setEventVotingData] = useState<EventVotingStatus[]>([])
  const [currentEventIndex, setCurrentEventIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [allUsers, setAllUsers] = useState<UserType[]>([])

  const [staffSchedules, setStaffSchedules] = useState<Staff[]>([
    {
      id: 1,
      name: "이건용",
      number: "77",
      role: "manager",
      requests: [
        { id: 1, date: "2025-01-25", type: "unavailable", reason: "개인 사정", status: "pending" },
        { id: 2, date: "2025-02-01", type: "unavailable", reason: "출장", status: "approved" },
      ],
    },
    {
      id: 2,
      name: "김코치",
      number: "C1",
      role: "manager",
      requests: [{ id: 3, date: "2025-01-28", type: "unavailable", reason: "가족 행사", status: "pending" }],
    },
    {
      id: 3,
      name: "박매니저",
      number: "M1",
      role: "manager",
      requests: [],
    },
  ])

  const [newRequest, setNewRequest] = useState({
    date: "",
    type: "unavailable",
    reason: "",
  })

  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // 정기 모임 및 리그 경기 일정 (3명 이상 필요)
  const criticalEvents: CriticalEvent[] = [
    { date: "2025-01-25", event: "정기 모임", requiredStaff: 3 },
    { date: "2025-01-28", event: "리그 경기 vs 한화", requiredStaff: 3 },
    { date: "2025-02-01", event: "정기 모임", requiredStaff: 3 },
  ]

  // 중요 일정 현황 상태를 코칭스태프용으로 변경
  const [coachingStaffEventsData, setCoachingStaffEventsData] = useState<CoachingStaffEventStatus[]>([])
  const [coachingStaffEventsLoading, setCoachingStaffEventsLoading] = useState(true)
  const [coachingStaffEventsError, setCoachingStaffEventsError] = useState<string | null>(null)

  // 스태프 요청 관련 상태 추가
  const [staffRequests, setStaffRequests] = useState<StaffRequestWithEvent[]>([])
  const [staffRequestsLoading, setStaffRequestsLoading] = useState(true)
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [coachingStaff, setCoachingStaff] = useState<UserType[]>([])
  const [isStaffRequestDialogOpen, setIsStaffRequestDialogOpen] = useState(false)
  const [newStaffRequest, setNewStaffRequest] = useState({
    event_id: '',
    request_type: 'absence',
    late_arrival_time: '',
    early_departure_time: '',
    partial_start_time: '',
    partial_end_time: '',
    reason_category: 'personal',
    reason_detail: '',
    priority: 'medium',
    has_substitute: false,
    substitute_user_id: '',
    substitute_notes: '',
    expires_at: ''
  })

  // 승인 권한 확인 (단장, 감독만)
  const canManageStaffRequests = user.role === 'manager' && user.tag && 
    ['단장', '감독'].includes(user.tag)

  // 스태프 요청 관리 관련 상태 (변수명 통일)
  const [allStaffRequestsLoading, setAllStaffRequestsLoading] = useState(true)
  const [allStaffRequests, setAllStaffRequests] = useState<StaffRequestWithEvent[]>([])

  // 코칭스태프 권한 확인
  const isCoachingStaff = user.role === 'manager' && user.tag && 
    ['감독', '수석코치', '투수코치', '배터리코치', '수비코치', '타격코치'].includes(user.tag)

  // 실시간 투표 현황 데이터 로드 (Supabase 연동)
  const loadVotingStatus = async () => {
    try {
      setIsLoading(true)
      
      // 1. 모든 활성 사용자 가져오기
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('number')

      if (usersError) {
        console.error('사용자 데이터 조회 오류:', usersError)
        return
      }

      setAllUsers(users || [])

      // 2. 다가오는 이벤트들 가져오기 (status = 'upcoming')
      const { data: upcomingEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'upcoming')
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      if (eventsError) {
        console.error('이벤트 데이터 조회 오류:', eventsError)
        return
      }

      if (!upcomingEvents || upcomingEvents.length === 0) {
        setEventVotingData([])
        return
      }

      // 3. 각 이벤트별로 출석 데이터 가져오기
      const eventVotingPromises = upcomingEvents.map(async (event): Promise<EventVotingStatus> => {
        // 해당 이벤트의 출석 정보 가져오기
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select('*')
          .eq('event_id', event.id)

        if (attendanceError) {
          console.error(`이벤트 ${event.id} 출석 데이터 조회 오류:`, attendanceError)
        }

        const attendance = attendanceData || []

        // 투표 상태별로 사용자 분류
        const attendingUsers: (UserType & { attendance: Attendance })[] = []
        const absentUsers: (UserType & { attendance: Attendance })[] = []
        const pendingUsers: UserType[] = []

        for (const user of users || []) {
          const userAttendance = attendance.find(att => att.user_id === user.id)
          
          if (userAttendance) {
            if (userAttendance.voted_status === 'attending') {
              attendingUsers.push({ ...user, attendance: userAttendance })
            } else if (userAttendance.voted_status === 'absent') {
              absentUsers.push({ ...user, attendance: userAttendance })
            } else {
              // voted_status가 'pending'인 경우
              pendingUsers.push(user)
            }
          } else {
            // 출석 레코드가 없는 경우 (미투표)
            pendingUsers.push(user)
          }
        }

        return {
          event,
          attendingUsers,
          absentUsers,
          pendingUsers,
          totalUsers: users?.length || 0
        }
      })

      const eventVotingResults = await Promise.all(eventVotingPromises)
      setEventVotingData(eventVotingResults)
      
    } catch (error) {
      console.error('투표 현황 로드 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 코칭스태프 중요 일정 현황 로드 함수
  const loadCoachingStaffEventsData = async () => {
    try {
      setCoachingStaffEventsLoading(true)
      setCoachingStaffEventsError(null)
      
      const result = await adminService.getCoachingStaffEventsStatus()
      
      if (result.error) {
        setCoachingStaffEventsError(result.error)
      } else {
        setCoachingStaffEventsData(result.events)
      }
    } catch (error) {
      setCoachingStaffEventsError('코칭스태프 일정 현황을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setCoachingStaffEventsLoading(false)
    }
  }

  // 스태프 요청 관련 함수들
  const loadStaffRequests = async () => {
    if (!isCoachingStaff) return
    
    try {
      setStaffRequestsLoading(true)
      
      // 현재 사용자의 ID 찾기
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('name', user.name)
        .eq('number', user.number)
        .single()

      if (userError || !userData) {
        console.error('사용자 정보 조회 실패:', userError)
        return
      }

      const requests = await staffRequestService.getUserStaffRequests(userData.id)
      setStaffRequests(requests)
    } catch (error) {
      console.error('스태프 요청 로드 오류:', error)
    } finally {
      setStaffRequestsLoading(false)
    }
  }

  const loadUpcomingEvents = async () => {
    try {
      const events = await eventService.getUpcomingEvents()
      setUpcomingEvents(events)
    } catch (error) {
      console.error('이벤트 로드 오류:', error)
    }
  }

  const loadCoachingStaff = async () => {
    try {
      const staff = await staffRequestService.getCoachingStaff()
      setCoachingStaff(staff)
    } catch (error) {
      console.error('코칭스태프 로드 오류:', error)
    }
  }

  const handleCreateStaffRequest = async () => {
    if (!newStaffRequest.event_id || !newStaffRequest.reason_detail) {
      alert('이벤트와 사유를 입력해주세요.')
      return
    }

    // request_type에 따른 필수 필드 검증
    if (newStaffRequest.request_type === 'late_arrival' && !newStaffRequest.late_arrival_time) {
      alert('지각 예상 시간을 입력해주세요.')
      return
    }

    if (newStaffRequest.request_type === 'early_departure' && !newStaffRequest.early_departure_time) {
      alert('조기 퇴장 시간을 입력해주세요.')
      return
    }

    if (newStaffRequest.request_type === 'partial_absence' && 
        (!newStaffRequest.partial_start_time || !newStaffRequest.partial_end_time)) {
      alert('부분 불참 시작/종료 시간을 모두 입력해주세요.')
      return
    }

    try {
      // 현재 사용자의 ID 찾기
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('name', user.name)
        .eq('number', user.number)
        .single()

      if (userError || !userData) {
        alert('사용자 정보를 찾을 수 없습니다.')
        return
      }

      // request_type에 따라 필요없는 시간 필드는 제거
      const requestData = {
        requester_id: userData.id,
        event_id: newStaffRequest.event_id,
        request_type: newStaffRequest.request_type,
        reason_category: newStaffRequest.reason_category,
        reason_detail: newStaffRequest.reason_detail,
        priority: newStaffRequest.priority,
        has_substitute: newStaffRequest.has_substitute,
        substitute_user_id: newStaffRequest.has_substitute ? newStaffRequest.substitute_user_id : undefined,
        substitute_notes: newStaffRequest.has_substitute ? newStaffRequest.substitute_notes : undefined,
        expires_at: newStaffRequest.expires_at || undefined,
        
        // request_type에 따라 해당하는 시간 필드만 포함
        ...(newStaffRequest.request_type === 'late_arrival' && { 
          late_arrival_time: newStaffRequest.late_arrival_time 
        }),
        ...(newStaffRequest.request_type === 'early_departure' && { 
          early_departure_time: newStaffRequest.early_departure_time 
        }),
        ...(newStaffRequest.request_type === 'partial_absence' && { 
          partial_start_time: newStaffRequest.partial_start_time,
          partial_end_time: newStaffRequest.partial_end_time 
        })
      }

      const { request, error } = await staffRequestService.createStaffRequest(requestData)

      if (error) {
        if (error.includes('이미 처리 중인')) {
          alert(error) // 사용자 친화적 오류 메시지
        } else {
          alert(`요청 생성 실패: ${error}`)
        }
        return
      }

      alert('일정 요청이 생성되었습니다!')
      
      // 폼 초기화
      setNewStaffRequest({
        event_id: '',
        request_type: 'absence',
        late_arrival_time: '',
        early_departure_time: '',
        partial_start_time: '',
        partial_end_time: '',
        reason_category: 'personal',
        reason_detail: '',
        priority: 'medium',
        has_substitute: false,
        substitute_user_id: '',
        substitute_notes: '',
        expires_at: ''
      })

      // 요청 목록 새로고침
      loadStaffRequests()
    } catch (error) {
      console.error('스태프 요청 생성 오류:', error)
      alert('요청 생성 중 오류가 발생했습니다.')
    }
  }

  const handleWithdrawRequest = async (requestId: string) => {
    try {
      const result = await staffRequestService.withdrawStaffRequest(requestId)
      
      if (result.success) {
        alert('요청이 철회되었습니다.')
        
        // 즉시 UI에서 해당 요청 제거
        setStaffRequests(prevRequests => 
          prevRequests.filter(request => request.id !== requestId)
        )
        
        // 스태프 요청 관리 목록도 새로고침
        if (canManageStaffRequests) {
          await loadAllStaffRequests()
        }
      } else {
        alert(result.error || '요청 철회에 실패했습니다.')
      }
    } catch (error) {
      console.error('요청 철회 오류:', error)
      alert('요청 철회 중 오류가 발생했습니다.')
    }
  }

  // 모든 스태프 요청 로드 (관리자용)
  const loadAllStaffRequests = async () => {
    if (!canManageStaffRequests) return
    
    try {
      setAllStaffRequestsLoading(true)
      
      console.log('스태프 요청 관리 로딩 시작...') // 디버깅용
      
      // 현재 사용자의 ID 찾기
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('name', user.name)
        .eq('number', user.number)
        .single()

      if (userError || !userData) {
        console.error('사용자 정보 조회 실패:', userError)
        return
      }

      console.log('사용자 정보 조회 성공:', userData.id) // 디버깅용

      // 대기 중인 요청만 가져오기 (철회된 요청 자동 제외)
      const requests = await staffRequestService.getPendingStaffRequests()
      console.log('받아온 요청 목록:', requests.length, '개') // 디버깅용
      
      // 권한에 따라 필터링
      let filteredRequests = requests
      if (user.tag === '단장') {
        // 단장은 감독의 요청만 볼 수 있음
        filteredRequests = requests.filter(request => request.requester?.tag === '감독')
        console.log('단장 권한으로 필터링된 요청:', filteredRequests.length, '개') // 디버깅용
      } else if (user.tag === '감독') {
        // 감독은 코치진의 요청만 볼 수 있음
        const coachTags = ['수석코치', '투수코치', '배터리코치', '수비코치']
        filteredRequests = requests.filter(request => 
          request.requester?.tag && coachTags.includes(request.requester.tag)
        )
        console.log('감독 권한으로 필터링된 요청:', filteredRequests.length, '개') // 디버깅용
      }
      
      setAllStaffRequests(filteredRequests)
      console.log('스태프 요청 관리 로딩 완료') // 디버깅용
    } catch (error) {
      console.error('스태프 요청 목록 로드 오류:', error)
    } finally {
      setAllStaffRequestsLoading(false)
    }
  }

  // 스태프 요청 승인
  const handleApproveStaffRequest = async (requestId: string, requesterId: string) => {
    if (!confirm('이 요청을 승인하시겠습니까? 승인 시 해당 이벤트에 자동으로 불참 처리됩니다.')) return

    try {
      // 현재 사용자의 ID 찾기
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('name', user.name)
        .eq('number', user.number)
        .single()

      if (userError || !userData) {
        alert('사용자 정보를 찾을 수 없습니다.')
        return
      }

      // 권한 확인
      const { canApprove, reason } = await staffRequestService.canApproveRequest(userData.id, requesterId)
      if (!canApprove) {
        alert(reason || '승인 권한이 없습니다.')
        return
      }

      const { success, error } = await staffRequestService.approveRequestWithAttendanceUpdate(
        requestId, 
        userData.id,
        '승인되었습니다.'
      )
      
      if (error) {
        alert(`승인 실패: ${error}`)
        return
      }

      alert('요청이 승인되었고 해당 이벤트에 불참 처리되었습니다.')
      loadAllStaffRequests()
    } catch (error) {
      console.error('스태프 요청 승인 오류:', error)
      alert('승인 처리 중 오류가 발생했습니다.')
    }
  }

  // 스태프 요청 거부
  const handleRejectStaffRequest = async (requestId: string, requesterId: string) => {
    const rejectReason = prompt('거부 사유를 입력하세요:')
    if (!rejectReason) return

    try {
      // 현재 사용자의 ID 찾기
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('name', user.name)
        .eq('number', user.number)
        .single()

      if (userError || !userData) {
        alert('사용자 정보를 찾을 수 없습니다.')
        return
      }

      // 권한 확인
      const { canApprove, reason } = await staffRequestService.canApproveRequest(userData.id, requesterId)
      if (!canApprove) {
        alert(reason || '거부 권한이 없습니다.')
        return
      }

      const { success, error } = await staffRequestService.updateRequestStatus(
        requestId, 
        'rejected',
        rejectReason
      )
      
      if (error) {
        alert(`거부 실패: ${error}`)
        return
      }

      alert('요청이 거부되었습니다.')
      loadAllStaffRequests()
    } catch (error) {
      console.error('스태프 요청 거부 오류:', error)
      alert('거부 처리 중 오류가 발생했습니다.')
    }
  }

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadVotingStatus()
    loadCoachingStaffEventsData()
    if (isCoachingStaff) {
      loadStaffRequests()
      loadUpcomingEvents()
      loadCoachingStaff()
    }
    if (canManageStaffRequests) {
      loadAllStaffRequests()
    }
  }, [isCoachingStaff, canManageStaffRequests])

  // 날짜 포맷팅 함수 (hydration 문제 방지)
  const formatDate = (dateString: string): string => {
    const parts = dateString.split('-')
    if (parts.length === 3) {
      return `${parts[0]}년 ${parseInt(parts[1])}월 ${parseInt(parts[2])}일`
    }
    return dateString
  }

  const formatDateTime = (dateString: string, timeString: string): string => {
    const date = formatDate(dateString)
    const time = timeString.substring(0, 5) // HH:MM 형태로 자르기
    return `${date} ${time}`
  }

  const getEventTypeText = (type: string): string => {
    switch (type) {
      case 'regular':
        return '정기 모임'
      case 'guerrilla':
        return '게릴라 훈련'
      case 'league':
        return '리그 경기'
      case 'mercenary':
        return '용병 경기'
      case 'tournament':
        return '토너먼트'
      default:
        return type
    }
  }

  const getEventTypeColor = (type: string): string => {
    switch (type) {
      case 'regular':
        return 'bg-blue-600'
      case 'guerrilla':
        return 'bg-orange-600'
      case 'league':
        return 'bg-green-600'
      case 'mercenary':
        return 'bg-purple-600'
      case 'tournament':
        return 'bg-red-600'
      default:
        return 'bg-gray-600'
    }
  }

  const getAvailableStaff = (date: string): number => {
    return staffSchedules.filter(
      (staff) =>
        !staff.requests.some((req) => req.date === date && req.status === "approved" && req.type === "unavailable"),
    ).length
  }

  const handleAddRequest = () => {
    if (!newRequest.date || !newRequest.reason) {
      alert("모든 필드를 입력해주세요.")
      return
    }

    const userStaff = staffSchedules.find((staff) => staff.number === user.number)
    if (userStaff) {
      const updatedSchedules = staffSchedules.map((staff) => {
        if (staff.number === user.number) {
          return {
            ...staff,
            requests: [
              ...staff.requests,
              {
                id: ++requestIdCounter,
                ...newRequest,
                status: "pending" as const,
              },
            ],
          }
        }
        return staff
      })
      setStaffSchedules(updatedSchedules)
    }

    setNewRequest({ date: "", type: "unavailable", reason: "" })
    setIsDialogOpen(false)
  }

  const handleApproveRequest = (staffId: number, requestId: number) => {
    const updatedSchedules = staffSchedules.map((staff) => {
      if (staff.id === staffId) {
        return {
          ...staff,
          requests: staff.requests.map((req) => 
            req.id === requestId ? { ...req, status: "approved" as const } : req
          ),
        }
      }
      return staff
    })
    setStaffSchedules(updatedSchedules)
  }

  const handleRejectRequest = (staffId: number, requestId: number) => {
    const updatedSchedules = staffSchedules.map((staff) => {
      if (staff.id === staffId) {
        return {
          ...staff,
          requests: staff.requests.map((req) => 
            req.id === requestId ? { ...req, status: "rejected" as const } : req
          ),
        }
      }
      return staff
    })
    setStaffSchedules(updatedSchedules)
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "pending":
        return "bg-yellow-600"
      case "approved":
        return "bg-green-600"
      case "rejected":
        return "bg-red-600"
      default:
        return "bg-gray-600"
    }
  }

  const getStatusText = (status: string): string => {
    switch (status) {
      case "pending":
        return "대기중"
      case "approved":
        return "승인됨"
      case "rejected":
        return "거부됨"
      default:
        return "알 수 없음"
    }
  }

  const getTypeText = (type: string): string => {
    switch (type) {
      case "unavailable":
        return "불참"
      case "late":
        return "지각"
      case "early_leave":
        return "조기 퇴장"
      default:
        return type
    }
  }

  // 누락된 함수들 추가
  const getRequestTypeText = (type: string): string => {
    switch (type) {
      case 'absence': return '불참'
      case 'late_arrival': return '지각'
      case 'early_departure': return '조기 퇴장'
      case 'partial_absence': return '부분 불참'
      case 'role_change': return '역할 변경'
      case 'substitute_needed': return '대체자 필요'
      default: return type
    }
  }

  const getReasonCategoryText = (category: string): string => {
    switch (category) {
      case 'work': return '업무'
      case 'family': return '가족'
      case 'health': return '건강'
      case 'personal': return '개인'
      case 'travel': return '여행'
      case 'emergency': return '응급'
      case 'transportation': return '교통'
      case 'weather': return '날씨'
      case 'conflict': return '일정 충돌'
      case 'other': return '기타'
      default: return category
    }
  }

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'emergency': return 'bg-red-700'
      case 'urgent': return 'bg-orange-600'
      case 'high': return 'bg-yellow-600'
      case 'medium': return 'bg-blue-600'
      case 'low': return 'bg-gray-600'
      default: return 'bg-gray-600'
    }
  }

  const getPriorityText = (priority: string): string => {
    switch (priority) {
      case 'emergency': return '응급'
      case 'urgent': return '긴급'
      case 'high': return '높음'
      case 'medium': return '보통'
      case 'low': return '낮음'
      default: return priority
    }
  }

  // 현재 선택된 이벤트의 투표 현황
  const currentEventVoting = eventVotingData[currentEventIndex]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="max-w-md mx-auto flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-bold text-lg">관리자 페이지</h1>
            <p className="text-sm text-gray-400">코칭 스태프 일정 관리</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 pb-8 space-y-6">
        {/* 상단 카드들 */}
        <div className="space-y-4">
          {/* 전체 선수단 실시간 투표 현황 */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Vote className="w-5 h-5 text-blue-500" />
                  <span>전체 선수단 실시간 투표 현황</span>
                </div>
                {isLoading && (
                  <Clock className="w-4 h-4 text-gray-400 animate-spin" />
                )}
              </CardTitle>
              
              {/* 이벤트 네비게이션 */}
              {eventVotingData.length > 0 && (
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentEventIndex(Math.max(0, currentEventIndex - 1))}
                    disabled={currentEventIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <div className="text-center flex-1">
                    <div className="text-xs text-gray-400">
                      {currentEventIndex + 1} / {eventVotingData.length}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentEventIndex(Math.min(eventVotingData.length - 1, currentEventIndex + 1))}
                    disabled={currentEventIndex === eventVotingData.length - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {currentEventVoting && (
                <CardDescription className="text-gray-400">
                  <div className="flex items-center space-x-2 mb-1">
                    <Badge className={`${getEventTypeColor(currentEventVoting.event.type)} text-white text-xs`}>
                      {getEventTypeText(currentEventVoting.event.type)}
                    </Badge>
                    <span className="font-semibold">{currentEventVoting.event.title}</span>
                  </div>
                  <div>{formatDateTime(currentEventVoting.event.date, currentEventVoting.event.time)}</div>
                  <div className="text-xs text-gray-500">{currentEventVoting.event.location}</div>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center text-gray-400 py-8">
                  <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p>데이터를 불러오는 중...</p>
                </div>
              ) : eventVotingData.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <Vote className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>다가오는 이벤트가 없습니다</p>
                </div>
              ) : currentEventVoting ? (
                <div className="space-y-4">
                  {/* 투표 통계 - 모바일 최적화 */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-green-900/30 rounded-lg border border-green-800">
                      <div className="text-green-400 font-bold text-base">{currentEventVoting.attendingUsers.length}</div>
                      <div className="text-xs text-gray-400">참석</div>
                    </div>
                    <div className="p-2 bg-red-900/30 rounded-lg border border-red-800">
                      <div className="text-red-400 font-bold text-base">{currentEventVoting.absentUsers.length}</div>
                      <div className="text-xs text-gray-400">불참</div>
                    </div>
                    <div className="p-2 bg-yellow-900/30 rounded-lg border border-yellow-800">
                      <div className="text-yellow-400 font-bold text-base">{currentEventVoting.pendingUsers.length}</div>
                      <div className="text-xs text-gray-400">미투표</div>
                    </div>
                  </div>

                  {/* 참석 인원 */}
                  {currentEventVoting.attendingUsers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-green-400 font-semibold flex items-center space-x-2">
                        <UserCheck className="w-4 h-4" />
                        <span>참석 인원 ({currentEventVoting.attendingUsers.length}명)</span>
                      </h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {currentEventVoting.attendingUsers.map((user) => (
                          <div key={user.id} className="flex items-center justify-between p-2 bg-green-900/20 rounded">
                            <span className="text-sm text-white">#{user.number} {user.name}</span>
                            <Badge className="bg-green-600 text-white text-xs">참석</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 불참 인원 */}
                  {currentEventVoting.absentUsers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-red-400 font-semibold flex items-center space-x-2">
                        <UserX className="w-4 h-4" />
                        <span>불참 인원 ({currentEventVoting.absentUsers.length}명)</span>
                      </h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {currentEventVoting.absentUsers.map((user) => (
                          <div key={user.id} className="p-2 bg-red-900/20 rounded border border-red-800/30">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-white">#{user.number} {user.name}</span>
                              <Badge className="bg-red-600 text-white text-xs">불참</Badge>
                            </div>
                            {user.attendance.absence_reason && (
                              <div className="text-xs text-gray-400">
                                사유: {user.attendance.absence_reason}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 미투표 인원 */}
                  {currentEventVoting.pendingUsers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-yellow-400 font-semibold flex items-center space-x-2">
                        <Clock className="w-4 h-4" />
                        <span>미투표 인원 ({currentEventVoting.pendingUsers.length}명)</span>
                      </h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {currentEventVoting.pendingUsers.map((user) => (
                          <div key={user.id} className="flex items-center justify-between p-2 bg-yellow-900/20 rounded">
                            <span className="text-sm text-white">#{user.number} {user.name}</span>
                            <Badge className="bg-yellow-600 text-white text-xs">미투표</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 새로고침 버튼 */}
                  <div className="flex justify-center pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadVotingStatus}
                      disabled={isLoading}
                      className="text-xs"
                    >
                      {isLoading ? '새로고침 중...' : '새로고침'}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* 새로운 코칭스태프 중요 일정 현황 컴포넌트 */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <span>코칭스태프 일정 현황</span>
              </CardTitle>
              <CardDescription className="text-gray-400">
                향후 5개 일정의 코칭스태프 출석 현황
              </CardDescription>
            </CardHeader>
            <CardContent>
              {coachingStaffEventsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-3"></div>
                  <p className="text-gray-400 text-sm">일정 현황 로딩 중...</p>
                </div>
              ) : coachingStaffEventsError ? (
                <div className="text-center py-8">
                  <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                  <p className="text-red-400 text-sm">{coachingStaffEventsError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadCoachingStaffEventsData}
                    className="mt-3 border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    다시 시도
                  </Button>
                </div>
              ) : coachingStaffEventsData.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">아직 일정이 생성되지 않았어요.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {coachingStaffEventsData.map((eventStatus, index) => (
                    <div key={eventStatus.event.id} className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/50 hover:bg-gray-800/70 transition-colors">
                      {/* 메인 정보 섹션 - 한 줄로 핵심 정보 표시 */}
                      <div className="flex items-center justify-between mb-2">
                        {/* 왼쪽: 이벤트 기본 정보 */}
                        <div className="flex items-center space-x-2">
                          <Badge className={`${getEventTypeColor(eventStatus.event.type)} text-white text-xs shrink-0`}>
                            {getEventTypeText(eventStatus.event.type)}
                          </Badge>
                          <div>
                            <h3 className="text-white font-medium text-sm leading-tight">
                              {eventStatus.event.title}
                            </h3>
                            <div className="flex items-center space-x-2 text-xs text-gray-400">
                              <span>{new Date(eventStatus.event.date).toLocaleDateString("ko-KR", { 
                                month: 'short', 
                                day: 'numeric',
                                weekday: 'short'
                              })}</span>
                              <span>•</span>
                              <span>{eventStatus.event.time}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* 오른쪽: 출석률 - 가장 중요한 정보를 크게 표시 */}
                        <div className="text-right">
                          <div className="text-xl font-bold text-white leading-none">
                            <span className={eventStatus.attendingCount >= 3 ? 'text-green-400' : 'text-yellow-400'}>
                              {eventStatus.attendingCount}
                            </span>
                            <span className="text-gray-400">/{eventStatus.totalStaff}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            코칭스태프
                          </div>
                        </div>
                      </div>

                      {/* 상세 정보 섹션 - 컴팩트하게 정리 */}
                      <div className="grid grid-cols-3 gap-1.5 text-xs">
                        {/* 참석 예정 */}
                        <div className="bg-green-900/20 border border-green-800/30 rounded p-1.5">
                          <div className="flex items-center space-x-1 mb-1">
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            <span className="text-green-400 font-medium">참석 {eventStatus.attendingCount}</span>
                          </div>
                          {eventStatus.attendingStaff.length > 0 ? (
                            <div className="space-y-1">
                              {eventStatus.attendingStaff.map((staff) => (
                                <div key={staff.id} className="text-green-200 text-xs">
                                  {staff.tag || staff.name}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-green-300/50 text-xs">없음</div>
                          )}
                        </div>

                        {/* 불참 예정 */}
                        <div className="bg-red-900/20 border border-red-800/30 rounded p-1.5">
                          <div className="flex items-center space-x-1 mb-1">
                            <XCircle className="w-3 h-3 text-red-400" />
                            <span className="text-red-400 font-medium">불참 {eventStatus.absentCount}</span>
                          </div>
                          {eventStatus.absentStaff.length > 0 ? (
                            <div className="space-y-1">
                              {eventStatus.absentStaff.map((staff) => (
                                <div key={staff.id} className="text-red-200">
                                  <div className="text-xs">{staff.tag || staff.name}</div>
                                  {staff.attendance.absence_reason && (
                                    <div className="text-xs text-red-300/70 truncate" title={staff.attendance.absence_reason}>
                                      {staff.attendance.absence_reason.length > 8 
                                        ? staff.attendance.absence_reason.substring(0, 8) + '...'
                                        : staff.attendance.absence_reason}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-red-300/50 text-xs">없음</div>
                          )}
                        </div>

                        {/* 미투표 */}
                        <div className="bg-gray-700/20 border border-gray-600/30 rounded p-1.5">
                          <div className="flex items-center space-x-1 mb-1">
                            <Vote className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-400 font-medium">미투표 {eventStatus.pendingCount}</span>
                          </div>
                          {eventStatus.pendingStaff.length > 0 ? (
                            <div className="space-y-1">
                              {eventStatus.pendingStaff.map((staff) => (
                                <div key={staff.id} className="text-gray-300 text-xs">
                                  {staff.tag || staff.name}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-gray-400/50 text-xs">없음</div>
                          )}
                        </div>
                      </div>

                      {/* 시각적 진행률 바 */}
                      <div className="mt-2">
                        <div className="flex rounded-full overflow-hidden h-1.5 bg-gray-700">
                          {eventStatus.attendingCount > 0 && (
                            <div 
                              className="bg-green-500 transition-all duration-300" 
                              style={{ width: `${(eventStatus.attendingCount / eventStatus.totalStaff) * 100}%` }}
                            />
                          )}
                          {eventStatus.absentCount > 0 && (
                            <div 
                              className="bg-red-500 transition-all duration-300" 
                              style={{ width: `${(eventStatus.absentCount / eventStatus.totalStaff) * 100}%` }}
                            />
                          )}
                          {eventStatus.pendingCount > 0 && (
                            <div 
                              className="bg-gray-500 transition-all duration-300" 
                              style={{ width: `${(eventStatus.pendingCount / eventStatus.totalStaff) * 100}%` }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* 새로고침 버튼 */}
                  <div className="flex justify-center pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadCoachingStaffEventsData}
                      disabled={coachingStaffEventsLoading}
                      className="text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
                    >
                      {coachingStaffEventsLoading ? '새로고침 중...' : '새로고침'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 메인 콘텐츠 영역 */}
        <div className="grid grid-cols-1 gap-6">
          {/* 고도화된 내 일정 요청 컴포넌트 */}
          {isCoachingStaff ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center space-x-2">
                    <Calendar className="w-5 h-5" />
                    <span>내 일정 요청</span>
                  </CardTitle>
                  <Dialog open={isStaffRequestDialogOpen} onOpenChange={setIsStaffRequestDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-1" />
                        새 요청
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>스태프 일정 요청</DialogTitle>
                        <DialogDescription className="text-gray-400">
                          코칭스태프 일정 변경 또는 특별 요청사항을 등록합니다.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        {/* 이벤트 선택 */}
                        <div className="space-y-2">
                          <Label htmlFor="event">이벤트 선택</Label>
                          <Select
                            value={newStaffRequest.event_id}
                            onValueChange={(value) => setNewStaffRequest({ ...newStaffRequest, event_id: value })}
                          >
                            <SelectTrigger className="bg-gray-800 border-gray-700">
                              <SelectValue placeholder="이벤트를 선택하세요" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              {upcomingEvents.map((event) => (
                                <SelectItem key={event.id} value={event.id}>
                                  {event.title} - {event.date} {event.time}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 요청 유형 */}
                        <div className="space-y-2">
                          <Label htmlFor="request_type">요청 유형</Label>
                          <Select
                            value={newStaffRequest.request_type}
                            onValueChange={(value) => setNewStaffRequest({ ...newStaffRequest, request_type: value })}
                          >
                            <SelectTrigger className="bg-gray-800 border-gray-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="absence">불참</SelectItem>
                              <SelectItem value="late_arrival">지각</SelectItem>
                              <SelectItem value="early_departure">조기 퇴장</SelectItem>
                              <SelectItem value="partial_absence">부분 불참</SelectItem>
                              <SelectItem value="role_change">역할 변경</SelectItem>
                              <SelectItem value="substitute_needed">대체자 필요</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 시간 관련 필드들 */}
                        {newStaffRequest.request_type === 'late_arrival' && (
                          <div className="space-y-2">
                            <Label htmlFor="late_arrival_time">지각 예상 시간</Label>
                            <Input
                              id="late_arrival_time"
                              type="time"
                              value={newStaffRequest.late_arrival_time}
                              onChange={(e) => setNewStaffRequest({ ...newStaffRequest, late_arrival_time: e.target.value })}
                              className="bg-gray-800 border-gray-700"
                            />
                          </div>
                        )}

                        {newStaffRequest.request_type === 'early_departure' && (
                          <div className="space-y-2">
                            <Label htmlFor="early_departure_time">조기 퇴장 시간</Label>
                            <Input
                              id="early_departure_time"
                              type="time"
                              value={newStaffRequest.early_departure_time}
                              onChange={(e) => setNewStaffRequest({ ...newStaffRequest, early_departure_time: e.target.value })}
                              className="bg-gray-800 border-gray-700"
                            />
                          </div>
                        )}

                        {newStaffRequest.request_type === 'partial_absence' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="partial_start_time">부분 불참 시작</Label>
                              <Input
                                id="partial_start_time"
                                type="time"
                                value={newStaffRequest.partial_start_time}
                                onChange={(e) => setNewStaffRequest({ ...newStaffRequest, partial_start_time: e.target.value })}
                                className="bg-gray-800 border-gray-700"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="partial_end_time">부분 불참 종료</Label>
                              <Input
                                id="partial_end_time"
                                type="time"
                                value={newStaffRequest.partial_end_time}
                                onChange={(e) => setNewStaffRequest({ ...newStaffRequest, partial_end_time: e.target.value })}
                                className="bg-gray-800 border-gray-700"
                              />
                            </div>
                          </div>
                        )}

                        {/* 사유 카테고리 */}
                        <div className="space-y-2">
                          <Label htmlFor="reason_category">사유 카테고리</Label>
                          <Select
                            value={newStaffRequest.reason_category}
                            onValueChange={(value) => setNewStaffRequest({ ...newStaffRequest, reason_category: value })}
                          >
                            <SelectTrigger className="bg-gray-800 border-gray-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="work">업무</SelectItem>
                              <SelectItem value="family">가족</SelectItem>
                              <SelectItem value="health">건강</SelectItem>
                              <SelectItem value="personal">개인</SelectItem>
                              <SelectItem value="travel">여행</SelectItem>
                              <SelectItem value="emergency">응급</SelectItem>
                              <SelectItem value="transportation">교통</SelectItem>
                              <SelectItem value="weather">날씨</SelectItem>
                              <SelectItem value="conflict">일정 충돌</SelectItem>
                              <SelectItem value="other">기타</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 상세 사유 */}
                        <div className="space-y-2">
                          <Label htmlFor="reason_detail">상세 사유</Label>
                          <Textarea
                            id="reason_detail"
                            value={newStaffRequest.reason_detail}
                            onChange={(e) => setNewStaffRequest({ ...newStaffRequest, reason_detail: e.target.value })}
                            className="bg-gray-800 border-gray-700"
                            placeholder="상세한 사유를 입력하세요"
                            rows={3}
                          />
                        </div>

                        {/* 우선순위 */}
                        <div className="space-y-2">
                          <Label htmlFor="priority">우선순위</Label>
                          <Select
                            value={newStaffRequest.priority}
                            onValueChange={(value) => setNewStaffRequest({ ...newStaffRequest, priority: value })}
                          >
                            <SelectTrigger className="bg-gray-800 border-gray-700">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-700">
                              <SelectItem value="low">낮음</SelectItem>
                              <SelectItem value="medium">보통</SelectItem>
                              <SelectItem value="high">높음</SelectItem>
                              <SelectItem value="urgent">긴급</SelectItem>
                              <SelectItem value="emergency">응급</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 대체자 관련 */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="has_substitute"
                              checked={newStaffRequest.has_substitute}
                              onChange={(e) => setNewStaffRequest({ ...newStaffRequest, has_substitute: e.target.checked })}
                              className="w-4 h-4"
                            />
                            <Label htmlFor="has_substitute">대체자 필요</Label>
                          </div>

                          {newStaffRequest.has_substitute && (
                            <>
                              <div className="space-y-2">
                                <Label htmlFor="substitute_user_id">대체자 선택</Label>
                                <Select
                                  value={newStaffRequest.substitute_user_id}
                                  onValueChange={(value) => setNewStaffRequest({ ...newStaffRequest, substitute_user_id: value })}
                                >
                                  <SelectTrigger className="bg-gray-800 border-gray-700">
                                    <SelectValue placeholder="대체자를 선택하세요" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-gray-800 border-gray-700">
                                    {coachingStaff.map((staff) => (
                                      <SelectItem key={staff.id} value={staff.id}>
                                        {staff.tag || staff.name} ({staff.number})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="substitute_notes">대체자 메모</Label>
                                <Textarea
                                  id="substitute_notes"
                                  value={newStaffRequest.substitute_notes}
                                  onChange={(e) => setNewStaffRequest({ ...newStaffRequest, substitute_notes: e.target.value })}
                                  className="bg-gray-800 border-gray-700"
                                  placeholder="대체자에 대한 메모를 입력하세요"
                                  rows={2}
                                />
                              </div>
                            </>
                          )}
                        </div>

                        <Button onClick={handleCreateStaffRequest} className="w-full bg-blue-600 hover:bg-blue-700">
                          요청 제출
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {staffRequestsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                    <p className="text-gray-400 text-sm">요청 내역 로딩 중...</p>
                  </div>
                ) : staffRequests.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>등록된 요청이 없습니다.</p>
                    <p className="text-sm">새 요청 버튼을 눌러 일정 요청을 등록하세요.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {staffRequests.map((request) => (
                      <div key={request.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                        {/* 헤더 */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge className="bg-blue-600 text-white text-xs">
                                {request.requester?.tag || request.requester?.name}
                              </Badge>
                              <span className="text-white font-semibold text-sm">
                                {request.event?.title || '이벤트 정보 없음'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-gray-400">
                              <span>{request.event?.date}</span>
                              <span>•</span>
                              <span>{request.event?.time}</span>
                            </div>
                          </div>
                        </div>

                        {/* 요청 내용 */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 text-sm">
                            <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                              {getRequestTypeText(request.request_type)}
                            </Badge>
                            <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                              {getReasonCategoryText(request.reason_category)}
                            </Badge>
                          </div>

                          <div className="text-sm text-gray-300">
                            <p className="font-medium">상세 사유:</p>
                            <p className="text-gray-400">{request.reason_detail}</p>
                          </div>

                          {/* 시간 정보 */}
                          {(request.late_arrival_time || request.early_departure_time || request.partial_start_time) && (
                            <div className="text-sm text-gray-300">
                              <p className="font-medium">시간 정보:</p>
                              <div className="text-gray-400 space-y-1">
                                {request.late_arrival_time && <p>지각 시간: {request.late_arrival_time}</p>}
                                {request.early_departure_time && <p>조기 퇴장: {request.early_departure_time}</p>}
                                {request.partial_start_time && request.partial_end_time && (
                                  <p>부분 불참: {request.partial_start_time} ~ {request.partial_end_time}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 대체자 정보 */}
                          {request.has_substitute && (
                            <div className="text-sm text-gray-300">
                              <p className="font-medium">대체자 정보:</p>
                              <div className="text-gray-400">
                                {request.substitute ? (
                                  <p>{request.substitute.tag || request.substitute.name} ({request.substitute.number})</p>
                                ) : (
                                  <p>대체자 미지정</p>
                                )}
                                {request.substitute_notes && <p>메모: {request.substitute_notes}</p>}
                              </div>
                            </div>
                          )}

                          {/* 제출 정보 */}
                          <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
                            <p>요청자: {request.requester?.name} ({request.requester?.tag})</p>
                            <p>제출일: {new Date(request.created_at).toLocaleDateString('ko-KR')}</p>
                            {request.submitted_at && (
                              <p>제출 시각: {new Date(request.submitted_at).toLocaleString('ko-KR')}</p>
                            )}
                            <p>상태: <span className={`font-medium ${getStatusColor(request.status) === 'bg-green-600' ? 'text-green-400' : getStatusColor(request.status) === 'bg-red-600' ? 'text-red-400' : getStatusColor(request.status) === 'bg-blue-600' ? 'text-blue-400' : 'text-gray-400'}`}>
                              {getStatusText(request.status)}
                            </span></p>
                          </div>
                        </div>

                        {/* 액션 버튼들 - 철회 버튼만 유지 */}
                        {request.status === 'submitted' && (
                          <div className="flex justify-end space-x-2 mt-3 pt-3 border-t border-gray-700">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleWithdrawRequest(request.id)}
                              className="text-xs border-gray-600 text-gray-300 hover:bg-gray-800"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              철회
                            </Button>
                          </div>
                        )}

                        {/* 처리 완료된 요청의 결과 표시 */}
                        {['approved', 'rejected'].includes(request.status) && (
                          <div className="mt-3 pt-3 border-t border-gray-700">
                            <div className={`p-2 rounded text-xs ${
                              request.status === 'approved' 
                                ? 'bg-green-900/30 border border-green-800/50 text-green-300'
                                : 'bg-red-900/30 border border-red-800/50 text-red-300'
                            }`}>
                              <p className="font-medium">
                                {request.status === 'approved' ? '✅ 승인됨' : '❌ 거부됨'}
                              </p>
                              {request.status === 'approved' && (
                                <p>해당 이벤트에 자동으로 불참 처리되었습니다.</p>
                              )}
                              {request.substitute_notes && (
                                <p>메모: {request.substitute_notes}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  <span>접근 제한</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                  <p className="text-gray-400 mb-2">이 기능은 코칭스태프만 사용할 수 있습니다.</p>
                  <p className="text-sm text-gray-500">
                    감독, 수석코치, 투수코치, 배터리코치, 수비코치, 타격코치만 접근 가능합니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 고도화된 전체 스태프 요청 관리 */}
          {canManageStaffRequests ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>스태프 요청 관리</span>
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {user.tag === '단장' ? '감독의 일정 요청을 관리합니다' : '코치진의 일정 요청을 관리합니다'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allStaffRequestsLoading ? (  // 변경: staffRequestsManagementLoading → allStaffRequestsLoading
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                    <p className="text-gray-400 text-sm">요청 관리 로딩 중...</p>
                  </div>
                ) : allStaffRequests.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>관리할 요청이 없습니다.</p>
                    <p className="text-sm">
                      {user.tag === '단장' ? '감독의 일정 요청이 없습니다.' : '코치진의 일정 요청이 없습니다.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allStaffRequests.map((request) => (
                      <div key={request.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                        {/* 헤더 */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge className="bg-blue-600 text-white text-xs">
                                {request.requester?.tag || request.requester?.name}
                              </Badge>
                              <span className="text-white font-semibold text-sm">
                                {request.event?.title || '이벤트 정보 없음'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-gray-400">
                              <span>{request.event?.date}</span>
                              <span>•</span>
                              <span>{request.event?.time}</span>
                            </div>
                          </div>
                        </div>

                        {/* 요청 내용 */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 text-sm">
                            <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                              {getRequestTypeText(request.request_type)}
                            </Badge>
                            <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                              {getReasonCategoryText(request.reason_category)}
                            </Badge>
                          </div>

                          <div className="text-sm text-gray-300">
                            <p className="font-medium">상세 사유:</p>
                            <p className="text-gray-400">{request.reason_detail}</p>
                          </div>

                          {/* 시간 정보 */}
                          {(request.late_arrival_time || request.early_departure_time || request.partial_start_time) && (
                            <div className="text-sm text-gray-300">
                              <p className="font-medium">시간 정보:</p>
                              <div className="text-gray-400 space-y-1">
                                {request.late_arrival_time && <p>지각 시간: {request.late_arrival_time}</p>}
                                {request.early_departure_time && <p>조기 퇴장: {request.early_departure_time}</p>}
                                {request.partial_start_time && request.partial_end_time && (
                                  <p>부분 불참: {request.partial_start_time} ~ {request.partial_end_time}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 대체자 정보 */}
                          {request.has_substitute && (
                            <div className="text-sm text-gray-300">
                              <p className="font-medium">대체자 정보:</p>
                              <div className="text-gray-400">
                                {request.substitute ? (
                                  <p>{request.substitute.tag || request.substitute.name} ({request.substitute.number})</p>
                                ) : (
                                  <p>대체자 미지정</p>
                                )}
                                {request.substitute_notes && <p>메모: {request.substitute_notes}</p>}
                              </div>
                            </div>
                          )}

                          {/* 제출 정보 */}
                          <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
                            <p>요청자: {request.requester?.name} ({request.requester?.tag})</p>
                            <p>제출일: {new Date(request.created_at).toLocaleDateString('ko-KR')}</p>
                            {request.submitted_at && (
                              <p>제출 시각: {new Date(request.submitted_at).toLocaleString('ko-KR')}</p>
                            )}
                            <p>상태: <span className={`font-medium ${getStatusColor(request.status) === 'bg-green-600' ? 'text-green-400' : getStatusColor(request.status) === 'bg-red-600' ? 'text-red-400' : getStatusColor(request.status) === 'bg-blue-600' ? 'text-blue-400' : 'text-gray-400'}`}>
                              {getStatusText(request.status)}
                            </span></p>
                          </div>
                        </div>

                        {/* 액션 버튼들 */}
                        {['submitted', 'under_review'].includes(request.status) && (
                          <div className="flex justify-end space-x-2 mt-3 pt-3 border-t border-gray-700">
                            <Button
                              size="sm"
                              onClick={() => handleApproveStaffRequest(request.id, request.requester_id)}
                              className="bg-green-600 hover:bg-green-700 text-xs"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              승인
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleRejectStaffRequest(request.id, request.requester_id)}
                              className="bg-red-600 hover:bg-red-700 text-xs"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              거부
                            </Button>
                          </div>
                        )}

                        {/* 처리 완료된 요청의 결과 표시 */}
                        {['approved', 'rejected'].includes(request.status) && (
                          <div className="mt-3 pt-3 border-t border-gray-700">
                            <div className={`p-2 rounded text-xs ${
                              request.status === 'approved' 
                                ? 'bg-green-900/30 border border-green-800/50 text-green-300'
                                : 'bg-red-900/30 border border-red-800/50 text-red-300'
                            }`}>
                              <p className="font-medium">
                                {request.status === 'approved' ? '✅ 승인됨' : '❌ 거부됨'}
                              </p>
                              {request.status === 'approved' && (
                                <p>해당 이벤트에 자동으로 불참 처리되었습니다.</p>
                              )}
                              {request.substitute_notes && (
                                <p>메모: {request.substitute_notes}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  <span>접근 제한</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                  <p className="text-gray-400 mb-2">이 기능은 단장과 감독만 사용할 수 있습니다.</p>
                  <p className="text-sm text-gray-500">
                    스태프 요청 관리 권한이 없습니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}