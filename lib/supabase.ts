import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 업데이트된 타입 정의
export interface User {
  id: string
  name: string
  number: string
  role: 'player' | 'manager'
  tag?: string  // 새로 추가된 필드
  profile_image_url?: string
  phone?: string
  position?: string
  join_date?: string  // 입단 날짜 추가
  is_active: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  title: string
  description?: string
  date: string
  time: string
  location: string
  type: 'regular' | 'guerrilla' | 'league' | 'mercenary' | 'tournament'
  is_mandatory: boolean
  required_staff_count: number
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Attendance {
  id: string
  user_id: string
  event_id: string
  voted_status: 'attending' | 'absent' | 'pending'
  voted_at?: string
  actual_status: 'attended' | 'absent' | 'late' | 'early_leave' | 'unknown'
  confirmed_at?: string
  absence_reason?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface UserStats {
  id: string
  user_id: string
  year: number
  total_events: number
  attended_events: number
  attendance_rate: number
  current_streak: number
  created_at: string
  updated_at: string
}

// 확장된 타입 정의
export interface UserWithStats extends User {
  stats?: UserStats
}

export interface EventWithAttendance extends Event {
  attendance?: Attendance[]
}

export interface AttendanceWithEvent extends Attendance {
  event?: Event
}

// StaffRequest 관련 타입 추가
export interface StaffRequest {
  id: string
  requester_id: string
  event_id: string
  request_type: 'absence' | 'late_arrival' | 'early_departure' | 'partial_absence' | 'role_change' | 'substitute_needed'
  late_arrival_time?: string
  early_departure_time?: string
  partial_start_time?: string
  partial_end_time?: string
  reason_category: 'work' | 'family' | 'health' | 'personal' | 'travel' | 'emergency' | 'transportation' | 'weather' | 'conflict' | 'other'
  reason_detail: string
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'emergency'
  has_substitute: boolean
  substitute_user_id?: string
  substitute_notes?: string
  attachment_urls?: string[]
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'conditionally_approved' | 'rejected' | 'withdrawn' | 'expired'
  submitted_at?: string
  expires_at?: string
  created_at: string
  updated_at: string
}

export interface StaffRequestWithEvent extends StaffRequest {
  event?: Event
  requester?: User
  substitute?: User
}

// 인증 관련 함수들
export const authService = {
  // 로그인 (이름 + 등번호 조합)
  async login(name: string, number: string): Promise<{ user: User | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('name', name)
        .eq('number', number)
        .eq('is_active', true)
        .single()

      if (error) {
        return { user: null, error: '등록되지 않은 사용자이거나 이름/등번호가 일치하지 않습니다.' }
      }

      // 마지막 로그인 시간 업데이트
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', data.id)

      return { user: data, error: null }
    } catch (err) {
      return { user: null, error: '로그인 중 오류가 발생했습니다.' }
    }
  },

  // 회원가입 - 입단 날짜 추가
  async signUp(name: string, number: string, role: 'player' | 'manager', position?: string, joinDate?: string): Promise<{ user: User | null; error: string | null }> {
    try {
      // 등번호 중복 확인
      const { data: existingUser } = await supabase
        .from('users')
        .select('number')
        .eq('number', number)
        .single()

      if (existingUser) {
        return { user: null, error: '이미 사용 중인 등번호입니다.' }
      }

      // 새 사용자 생성
      const { data, error } = await supabase
        .from('users')
        .insert({
          name,
          number,
          role,
          position: position || '선수',
          join_date: joinDate || new Date().toISOString().split('T')[0], // 입단 날짜 (기본값: 오늘)
          is_active: true,
          last_login_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        return { user: null, error: '회원가입 중 오류가 발생했습니다.' }
      }

      return { user: data, error: null }
    } catch (err) {
      return { user: null, error: '회원가입 중 오류가 발생했습니다.' }
    }
  },

  // 사용자 정보 조회
  async getUser(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      return error ? null : data
    } catch {
      return null
    }
  },

  // 등번호 중복 확인
  async checkNumberAvailability(number: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('users')
        .select('number')
        .eq('number', number)
        .single()

      return !data // 데이터가 없으면 사용 가능
    } catch {
      return true // 오류 발생 시 사용 가능으로 처리
    }
  }
}

// 이벤트 관련 함수들
export const eventService = {
  // 모든 이벤트 조회
  async getAllEvents(): Promise<Event[]> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false })

      return error ? [] : data
    } catch {
      return []
    }
  },

  // 다가오는 이벤트 조회 (시간순 정렬)
  async getUpcomingEvents(): Promise<Event[]> {
    try {
      const now = new Date()
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('date', now.toISOString().split('T')[0])
        .eq('status', 'upcoming')
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      return error ? [] : data
    } catch {
      return []
    }
  },

  // 바로 다음 이벤트 조회
  async getNextUpcomingEvent(): Promise<Event | null> {
    try {
      const now = new Date()
      const currentDate = now.toISOString().split('T')[0]
      const currentTime = now.toTimeString().slice(0, 5) // HH:MM 형식

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'upcoming')
        .or(`date.gt.${currentDate},and(date.eq.${currentDate},time.gt.${currentTime})`)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(1)
        .single()

      return error ? null : data
    } catch {
      return null
    }
  },

  // 특정 기간의 이벤트 조회
  async getEventsByDateRange(startDate: string, endDate: string): Promise<Event[]> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })

      return error ? [] : data
    } catch {
      return []
    }
  },

  // 새 이벤트 생성 (매니저만 가능)
  async createEvent(eventData: {
    title: string
    description?: string
    date: string
    time: string
    location: string
    type: 'regular' | 'guerrilla' | 'league' | 'mercenary' | 'tournament'
    is_mandatory?: boolean
    required_staff_count?: number
    created_by: string
  }): Promise<{ event: Event | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          title: eventData.title,
          description: eventData.description || null,
          date: eventData.date,
          time: eventData.time,
          location: eventData.location,
          type: eventData.type,
          is_mandatory: eventData.is_mandatory ?? true,
          required_staff_count: eventData.required_staff_count ?? 15,
          status: 'upcoming',
          created_by: eventData.created_by
        })
        .select()
        .single()

      if (error) {
        console.error('이벤트 생성 오류:', error)
        return { event: null, error: '이벤트 생성 중 오류가 발생했습니다.' }
      }

      // 모든 사용자에 대해 출석 레코드 생성
      const { success: attendanceSuccess, error: attendanceError } = await attendanceService.createAttendanceRecordsForEvent(data.id)
      
      if (!attendanceSuccess) {
        console.warn('출석 레코드 생성 실패:', attendanceError)
        // 이벤트는 생성되었으므로 경고만 출력
      }

      return { event: data, error: null }
    } catch (err) {
      console.error('이벤트 생성 예외:', err)
      return { event: null, error: '이벤트 생성 중 오류가 발생했습니다.' }
    }
  },

  // 이벤트 수정 (매니저만 가능)
  async updateEvent(eventId: string, eventData: Partial<Event>, userId: string): Promise<{ event: Event | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', eventId)
        .select()
        .single()

      if (error) {
        return { event: null, error: '이벤트 수정 중 오류가 발생했습니다.' }
      }

      return { event: data, error: null }
    } catch (err) {
      return { event: null, error: '이벤트 수정 중 오류가 발생했습니다.' }
    }
  },

  // PostgreSQL 함수를 사용한 이벤트 삭제
  async deleteEvent(eventId: string, userId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { data, error } = await supabase
        .rpc('delete_event_with_attendance', {
          event_id_param: eventId,
          user_id_param: userId
        })

      if (error) {
        return { success: false, error: error.message }
      }

      if (!data.success) {
        return { success: false, error: data.error }
      }

      return { success: true, error: null }
    } catch (err) {
      return { success: false, error: `삭제 중 오류: ${err}` }
    }
  },

  // 이벤트 상태를 자동으로 업데이트 (ongoing, completed)
  async updateEventStatus(eventId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { data: event, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (fetchError || !event) {
        return { success: false, error: '이벤트를 찾을 수 없습니다.' }
      }

      const now = new Date()
      const eventDateTime = new Date(`${event.date}T${event.time}`)
      const eventEndTime = new Date(eventDateTime.getTime() + 3 * 60 * 60 * 1000) // 3시간 후

      let newStatus = event.status
      
      if (now >= eventDateTime && now < eventEndTime && event.status === 'upcoming') {
        newStatus = 'ongoing'
        // 이벤트가 시작되면 즉시 투표를 실제 출석으로 변환 (투표 미참여자는 불참 처리)
        await attendanceService.convertVotesToActualAttendance(eventId)
      } else if (now >= eventEndTime && event.status !== 'completed') {
        newStatus = 'completed'
      }

      if (newStatus !== event.status) {
        const { error: updateError } = await supabase
          .from('events')
          .update({ status: newStatus })
          .eq('id', eventId)

        return { success: !updateError, error: updateError?.message || null }
      }

      return { success: true, error: null }
    } catch (err) {
      return { success: false, error: '이벤트 상태 업데이트 중 오류가 발생했습니다.' }
    }
  },

  // 모든 upcoming 이벤트의 상태를 체크하고 업데이트
  async checkAndUpdateAllEventStatuses(): Promise<void> {
    try {
      const { data: upcomingEvents } = await supabase
        .from('events')
        .select('id')
        .in('status', ['upcoming', 'ongoing'])

      if (upcomingEvents) {
        for (const event of upcomingEvents) {
          await this.updateEventStatus(event.id)
        }
      }
    } catch (error) {
      console.error('이벤트 상태 일괄 업데이트 오류:', error)
    }
  }
}

// 출석 관련 함수들
export const attendanceService = {
  // 특정 사용자의 출석 기록 조회 - SQL 함수 사용하여 정확한 최신순 정렬
  async getUserAttendance(userId: string): Promise<AttendanceWithEvent[]> {
    try {
      // Supabase RPC를 통해 PostgreSQL 함수 호출
      const { data, error } = await supabase
        .rpc('get_user_attendance_sorted', {
          p_user_id: userId
        })

      if (error) {
        console.error('사용자 출석 기록 조회 오류:', error)
        return []
      }

      if (!data || data.length === 0) {
        return []
      }

      // 반환된 데이터를 AttendanceWithEvent 타입으로 변환
      const attendanceWithEvents: AttendanceWithEvent[] = data.map((record: any) => ({
        id: record.id,
        user_id: record.user_id,
        event_id: record.event_id,
        voted_status: record.voted_status,
        voted_at: record.voted_at,
        actual_status: record.actual_status,
        confirmed_at: record.confirmed_at,
        absence_reason: record.absence_reason,
        notes: record.notes,
        created_at: record.created_at,
        updated_at: record.updated_at,
        event: record.event // JSON으로 반환된 이벤트 정보
      }))

      return attendanceWithEvents
    } catch (error) {
      console.error('사용자 출석 기록 조회 중 예외 발생:', error)
      return []
    }
  },

  // 특정 이벤트의 출석 현황 조회
  async getEventAttendance(eventId: string): Promise<Attendance[]> {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('event_id', eventId)

      return error ? [] : data
    } catch {
      return []
    }
  },

  // 출석 투표 제출
  async submitVote(userId: string, eventId: string, votedStatus: 'attending' | 'absent', absenceReason?: string): Promise<{ success: boolean; error: string | null }> {
    try {
      // 기존 레코드 확인
      const { data: existingRecord } = await supabase
        .from('attendance')
        .select('id')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .single()

      if (existingRecord) {
        // 기존 레코드가 있으면 업데이트
        const { error } = await supabase
          .from('attendance')
          .update({
            voted_status: votedStatus,
            voted_at: new Date().toISOString(),
            absence_reason: absenceReason || null,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('event_id', eventId)

        return { success: !error, error: error?.message || null }
      } else {
        // 기존 레코드가 없으면 새로 삽입
        const { error } = await supabase
          .from('attendance')
          .insert({
            user_id: userId,
            event_id: eventId,
            voted_status: votedStatus,
            voted_at: new Date().toISOString(),
            absence_reason: absenceReason || null,
            actual_status: 'unknown'
          })

        return { success: !error, error: error?.message || null }
      }
    } catch (err) {
      return { success: false, error: '투표 제출 중 오류가 발생했습니다.' }
    }
  },

  // 사용자의 특정 이벤트 출석 상태 조회
  async getUserEventAttendance(userId: string, eventId: string): Promise<Attendance | null> {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .single()

      return error ? null : data
    } catch {
      return null
    }
  },

  // 이벤트 종료 시 투표를 실제 출석으로 변환 (투표 미참여자는 불참 처리)
  async convertVotesToActualAttendance(eventId: string): Promise<{ success: boolean; error: string | null; updatedCount: number }> {
    try {
      // 해당 이벤트의 모든 투표를 actual_status로 변환
      // 투표 미참여자(pending)와 투표하지 않은 사용자는 불참 처리
      
      // 1. 참석 예정이었던 사용자들을 출석 처리
      const { data: attendingData, error: attendingError } = await supabase
        .from('attendance')
        .update({
          actual_status: 'attended',
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('event_id', eventId)
        .eq('voted_status', 'attending')
        .in('actual_status', ['unknown', 'late', 'early_leave'])
        .select()

      // 2. 불참 선택한 사용자들을 불참 처리
      const { data: absentData, error: absentError } = await supabase
        .from('attendance')
        .update({
          actual_status: 'absent',
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('event_id', eventId)
        .eq('voted_status', 'absent')
        .in('actual_status', ['unknown', 'late', 'early_leave'])
        .select()

      // 3. 투표 미참여자들을 불참 처리
      const { data: pendingData, error: pendingError } = await supabase
        .from('attendance')
        .update({
          actual_status: 'absent',
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('event_id', eventId)
        .eq('voted_status', 'pending')
        .in('actual_status', ['unknown', 'late', 'early_leave'])
        .select()

      const totalUpdated = (attendingData?.length || 0) + (absentData?.length || 0) + (pendingData?.length || 0)
      const hasError = attendingError || absentError || pendingError
      
      return { 
        success: !hasError, 
        error: hasError ? (attendingError?.message || absentError?.message || pendingError?.message || '출석 상태 변환 중 오류가 발생했습니다.') : null, 
        updatedCount: totalUpdated 
      }
    } catch (err) {
      return { 
        success: false, 
        error: '출석 상태 변환 중 오류가 발생했습니다.',
        updatedCount: 0
      }
    }
  },

  // 모든 사용자에 대해 이벤트 출석 레코드 생성 (이벤트 생성 시)
  async createAttendanceRecordsForEvent(eventId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      // 모든 활성 사용자 가져오기
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('is_active', true)

      if (usersError || !users) {
        return { success: false, error: '사용자 목록을 가져오는데 실패했습니다.' }
      }

      // 각 사용자에 대해 출석 레코드 생성 (pending 상태로)
      const attendanceRecords = users.map(user => ({
        user_id: user.id,
        event_id: eventId,
        voted_status: 'pending' as const,
        actual_status: 'unknown' as const
      }))

      const { error: insertError } = await supabase
        .from('attendance')
        .insert(attendanceRecords)

      return { success: !insertError, error: insertError?.message || null }
    } catch (err) {
      return { success: false, error: '출석 레코드 생성 중 오류가 발생했습니다.' }
    }
  },

  // 출석 상태 업데이트 함수 - 새로 추가
  async updateAttendanceStatus(
    attendanceId: string, 
    newStatus: 'attended' | 'absent'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('attendance')
        .update({
          actual_status: newStatus,
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', attendanceId)

      if (error) {
        console.error('출석 상태 업데이트 오류:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('출석 상태 업데이트 중 예외 발생:', error)
      return false
    }
  }
}

// 통계 관련 함수들
export const statsService = {
  // 모든 사용자의 통계 조회 (출석률 순) - 입단일 기준으로 수정
  async getAllUserStats(year: number = 2025): Promise<UserWithStats[]> {
    try {
      // 먼저 모든 활성 사용자를 가져오고
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('number')

      if (usersError) {
        console.error('사용자 데이터 조회 오류:', usersError)
        return []
      }

      // 각 사용자별로 통계를 계산
      const usersWithStats: UserWithStats[] = []

      for (const user of users) {
        // 입단일 이후의 이벤트만 조회
        let eventDateFilter = {}
        if (user.join_date) {
          eventDateFilter = { gte: user.join_date }
        }

        // 사용자별 출석 데이터 조회 (입단일 이후)
        const attendanceQuery = supabase
          .from('attendance')
          .select(`
            *,
            event:events!inner(*)
          `)
          .eq('user_id', user.id)
          .neq('events.status', 'cancelled')
          .neq('events.status', 'upcoming')

        // 입단일이 있으면 해당 날짜 이후 이벤트만 필터링
        if (user.join_date) {
          attendanceQuery.gte('events.date', user.join_date)
        }

        const { data: attendanceData } = await attendanceQuery

        const totalEvents = attendanceData?.length || 0
        const attendedEvents = attendanceData?.filter(a => a.actual_status === 'attended').length || 0
        const attendanceRate = totalEvents > 0 ? Math.round((attendedEvents / totalEvents) * 100) : 0

        // 임시 통계 객체 생성
        const stats: UserStats = {
          id: `temp-${user.id}`,
          user_id: user.id,
          year: year,
          total_events: totalEvents,
          attended_events: attendedEvents,
          attendance_rate: attendanceRate,
          current_streak: 0, // 나중에 계산
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        usersWithStats.push({
          ...user,
          stats
        })
      }

      // 출석률 순으로 정렬
      return usersWithStats.sort((a, b) => (b.stats?.attendance_rate || 0) - (a.stats?.attendance_rate || 0))

    } catch (error) {
      console.error('통계 데이터 조회 오류:', error)
      return []
    }
  },

  // 특정 사용자의 통계 조회 - 입단일 기준으로 수정
  async getUserStats(userId: string, year: number = 2025): Promise<UserStats | null> {
    try {
      // 사용자 정보 먼저 조회 (입단일 확인용)
      const { data: user } = await supabase
        .from('users')
        .select('join_date')
        .eq('id', userId)
        .single()

      // user_stats 테이블에서 먼저 조회
      const { data: existingStats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('year', year)
        .single()

      if (existingStats) {
        return existingStats
      }

      // 없으면 실시간 계산 (입단일 이후)
      const attendanceQuery = supabase
        .from('attendance')
        .select(`
          *,
          event:events!inner(*)
        `)
        .eq('user_id', userId)
        .neq('events.status', 'cancelled')
        .neq('events.status', 'upcoming')

      // 입단일이 있으면 해당 날짜 이후 이벤트만 필터링
      if (user?.join_date) {
        attendanceQuery.gte('events.date', user.join_date)
      }

      const { data: attendanceData } = await attendanceQuery

      const totalEvents = attendanceData?.length || 0
      const attendedEvents = attendanceData?.filter(a => a.actual_status === 'attended').length || 0
      const attendanceRate = totalEvents > 0 ? Math.round((attendedEvents / totalEvents) * 100) : 0

      return {
        id: `temp-${userId}`,
        user_id: userId,
        year: year,
        total_events: totalEvents,
        attended_events: attendedEvents,
        attendance_rate: attendanceRate,
        current_streak: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

    } catch (error) {
      console.error('사용자 통계 조회 오류:', error)
      return null
    }
  },

  // 사용자 개인 출석 현황 조회 - 입단일 기준으로 수정
  async getUserAttendanceStats(userId: string): Promise<{
    monthlyAttended: boolean
    consecutiveAttendance: number
    totalAttendance: number
    totalEvents: number
    attendanceRate: number
  }> {
    try {
      // 사용자 정보 조회 (입단일 확인용)
      const { data: user } = await supabase
        .from('users')
        .select('join_date')
        .eq('id', userId)
        .single()

      // 현재 날짜 기준 설정
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1
      const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
      const lastDayOfMonth = new Date(currentYear, currentMonth, 0)

      // 이번 달 출석 여부 확인 (입단일 이후)
      const monthlyQuery = supabase
        .from('attendance')
        .select(`
          id,
          actual_status,
          event:events!inner(
            id,
            date,
            status
          )
        `)
        .eq('user_id', userId)
        .eq('actual_status', 'attended')
        .gte('events.date', firstDayOfMonth.toISOString().split('T')[0])
        .lte('events.date', lastDayOfMonth.toISOString().split('T')[0])
        .neq('events.status', 'cancelled')

      // 입단일이 있으면 추가 필터링
      if (user?.join_date) {
        monthlyQuery.gte('events.date', user.join_date)
      }

      const { data: monthlyAttendance } = await monthlyQuery
      const monthlyAttended = (monthlyAttendance?.length || 0) > 0

      // 전체 출석 데이터 조회 (취소되지 않은 이벤트만, 입단일 이후)
      const allAttendanceQuery = supabase
        .from('attendance')
        .select(`
          id,
          actual_status,
          voted_status,
          event:events!inner(
            id,
            date,
            time,
            status
          )
        `)
        .eq('user_id', userId)
        .neq('events.status', 'cancelled')
        .neq('events.status', 'upcoming')
        .order('events.date', { ascending: true })
        .order('events.time', { ascending: true })

      // 입단일이 있으면 추가 필터링
      if (user?.join_date) {
        allAttendanceQuery.gte('events.date', user.join_date)
      }

      const { data: allAttendance } = await allAttendanceQuery

      const totalEvents = allAttendance?.length || 0
      const totalAttendance = allAttendance?.filter(a => a.actual_status === 'attended').length || 0
      const attendanceRate = totalEvents > 0 ? Math.round((totalAttendance / totalEvents) * 100) : 0

      // 연속 출석 계산 (최근 완료된 이벤트부터 역순으로 체크)
      let consecutiveAttendance = 0
      const completedEvents = allAttendance?.filter((a): a is any => 
        a.event?.status === 'completed' || 
        (a.event?.status === 'ongoing' && a.actual_status !== 'unknown')
      ).reverse() || []

      for (const attendance of completedEvents) {
        if (attendance.actual_status === 'attended') {
          consecutiveAttendance++
        } else {
          break
        }
      }

      return {
        monthlyAttended,
        consecutiveAttendance,
        totalAttendance,
        totalEvents,
        attendanceRate
      }
    } catch (error) {
      console.error('사용자 출석 통계 조회 오류:', error)
      return {
        monthlyAttended: false,
        consecutiveAttendance: 0,
        totalAttendance: 0,
        totalEvents: 0,
        attendanceRate: 0
      }
    }
  },

  // 간단한 사용자 출석 통계 조회 - 입단일 기준으로 수정
  async getSimpleUserAttendanceStats(userId: string): Promise<{
    monthlyAttended: boolean
    consecutiveAttendance: number
    totalAttendance: number
    totalEvents: number
    attendanceRate: number
  }> {
    try {
      // 사용자 정보 조회 (입단일 확인용)
      const { data: user } = await supabase
        .from('users')
        .select('join_date')
        .eq('id', userId)
        .single()

      const attendanceQuery = supabase
        .from('attendance')
        .select(`
          actual_status,
          event:events!inner(date, status)
        `)
        .eq('user_id', userId)
        .neq('events.status', 'cancelled')

      // 입단일이 있으면 해당 날짜 이후 이벤트만 필터링
      if (user?.join_date) {
        attendanceQuery.gte('events.date', user.join_date)
      }

      const { data: attendanceData } = await attendanceQuery

      const totalEvents = attendanceData?.length || 0
      const totalAttendance = attendanceData?.filter(a => a.actual_status === 'attended').length || 0
      const attendanceRate = totalEvents > 0 ? Math.round((totalAttendance / totalEvents) * 100) : 0

      return {
        monthlyAttended: false, // 간단 버전에서는 계산하지 않음
        consecutiveAttendance: 0, // 간단 버전에서는 계산하지 않음
        totalAttendance,
        totalEvents,
        attendanceRate
      }
    } catch (error) {
      console.error('사용자 출석 통계 조회 오류:', error)
      return {
        monthlyAttended: false,
        consecutiveAttendance: 0,
        totalAttendance: 0,
        totalEvents: 0,
        attendanceRate: 0
      }
    }
  },

  // 사용자의 원시 출석 데이터 가져오기 (대안 방법)
  async getUserRawAttendanceData(userId: string): Promise<{
    attendanceRecords: AttendanceWithEvent[]
    error: string | null
  }> {
    try {
      // 1단계: 출석 데이터만 먼저 가져오기
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)

      if (attendanceError) {
        console.error('출석 데이터 조회 오류:', attendanceError)
        return { attendanceRecords: [], error: attendanceError.message }
      }

      if (!attendanceData || attendanceData.length === 0) {
        return { attendanceRecords: [], error: null }
      }

      // 2단계: 이벤트 데이터 가져오기
      const eventIds = attendanceData.map(a => a.event_id)
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .in('id', eventIds)

      if (eventsError) {
        console.error('이벤트 데이터 조회 오류:', eventsError)
        return { attendanceRecords: [], error: eventsError.message }
      }

      // 3단계: 데이터 결합
      const attendanceRecords: AttendanceWithEvent[] = attendanceData.map(attendance => ({
        ...attendance,
        event: eventsData?.find(event => event.id === attendance.event_id) || null
      })).filter(record => record.event !== null) // 이벤트 정보가 있는 것만 필터링

      // 4단계: 날짜순 정렬
      attendanceRecords.sort((a, b) => {
        const dateTimeA = new Date(`${a.event?.date}T${a.event?.time || '00:00'}:00`)
        const dateTimeB = new Date(`${b.event?.date}T${b.event?.time || '00:00'}:00`)
        return dateTimeA.getTime() - dateTimeB.getTime()
      })

      console.log('결합된 출석 데이터:', {
        총개수: attendanceRecords.length,
        샘플: attendanceRecords.slice(0, 3).map(r => ({
          title: r.event?.title,
          date: r.event?.date,
          actual_status: r.actual_status,
          event_status: r.event?.status
        }))
      })

      return { attendanceRecords, error: null }
    } catch (error) {
      console.error('원시 출석 데이터 조회 예외:', error)
      return { attendanceRecords: [], error: '데이터 조회 중 오류가 발생했습니다.' }
    }
  }
}

// 디버깅 및 데이터 검증 함수들
export const debugService = {
  // 사용자의 모든 출석 데이터 조회 (디버깅용)
  async getUserAllAttendanceData(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          event:events(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      console.log('사용자 전체 출석 데이터:', data)
      return { data, error }
    } catch (error) {
      console.error('디버깅 데이터 조회 오류:', error)
      return { data: null, error }
    }
  },

  // 사용자 정보 확인
  async checkUserData(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      console.log('사용자 정보:', data)
      return { data, error }
    } catch (error) {
      console.error('사용자 정보 조회 오류:', error)
      return { data: null, error }
    }
  },

  // 이벤트 목록 확인
  async checkEventsData(): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false })

      console.log('전체 이벤트 목록:', data)
      return { data, error }
    } catch (error) {
      console.error('이벤트 데이터 조회 오류:', error)
      return { data: null, error }
    }
  }
}

// 관리자용 서비스 추가
export const adminService = {
  // 코칭스태프 중요 일정 현황 조회 (향후 5개 이벤트, 코칭스태프만)
  async getCoachingStaffEventsStatus(): Promise<{
    events: Array<{
      event: Event
      attendingStaff: Array<User & { attendance: Attendance }>
      absentStaff: Array<User & { attendance: Attendance }>
      pendingStaff: User[]
      totalStaff: number
      attendingCount: number
      absentCount: number
      pendingCount: number
    }>
    error: string | null
  }> {
    try {
      // 1. 다가오는 이벤트 5개 조회 (status = 'upcoming', 가까운 순으로 정렬)
      const { data: upcomingEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'upcoming')
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(5)

      if (eventsError) {
        return { events: [], error: eventsError.message }
      }

      if (!upcomingEvents || upcomingEvents.length === 0) {
        return { events: [], error: null }
      }

      // 2. 코칭스태프만 조회 (감독, 수석코치, 투수코치, 배터리코치, 수비코치)
      const coachingStaffTags = ['감독', '수석코치', '투수코치', '배터리코치', '수비코치']
      const { data: coachingStaff, error: staffError } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .eq('role', 'manager')
        .in('tag', coachingStaffTags)
        .order('tag')

      if (staffError) {
        return { events: [], error: staffError.message }
      }

      console.log('조회된 코칭스태프:', coachingStaff?.map(staff => ({ name: staff.name, tag: staff.tag })))

      // 3. 각 이벤트별로 코칭스태프 출석 현황 조회
      const eventsWithStatus = await Promise.all(
        upcomingEvents.map(async (event) => {
          // 해당 이벤트의 출석 데이터 조회
          const { data: attendanceData, error: attendanceError } = await supabase
            .from('attendance')
            .select('*')
            .eq('event_id', event.id)

          if (attendanceError) {
            console.error(`이벤트 ${event.id} 출석 데이터 조회 오류:`, attendanceError)
          }

          const attendance = attendanceData || []

          // 코칭스태프별 출석 상태 분류
          const attendingStaff: Array<User & { attendance: Attendance }> = []
          const absentStaff: Array<User & { attendance: Attendance }> = []
          const pendingStaff: User[] = []

          for (const staff of coachingStaff || []) {
            const staffAttendance = attendance.find(att => att.user_id === staff.id)
            
            if (staffAttendance) {
              if (staffAttendance.voted_status === 'attending') {
                attendingStaff.push({ ...staff, attendance: staffAttendance })
              } else if (staffAttendance.voted_status === 'absent') {
                absentStaff.push({ ...staff, attendance: staffAttendance })
              } else {
                // voted_status가 'pending'인 경우
                pendingStaff.push(staff)
              }
            } else {
              // 출석 레코드가 없는 경우 (미투표)
              pendingStaff.push(staff)
            }
          }

          return {
            event,
            attendingStaff,
            absentStaff,
            pendingStaff,
            totalStaff: coachingStaff?.length || 0,
            attendingCount: attendingStaff.length,
            absentCount: absentStaff.length,
            pendingCount: pendingStaff.length
          }
        })
      )

      return { events: eventsWithStatus, error: null }
    } catch (error) {
      console.error('코칭스태프 중요 일정 조회 오류:', error)
      return { events: [], error: '코칭스태프 일정 현황을 조회하는 중 오류가 발생했습니다.' }
    }
  },

  // 관리자용 중요 일정 현황 조회 (향후 5개 이벤트, 출석 현황 포함)
  async getCriticalEventsStatus(): Promise<{
    events: Array<{
      event: Event
      attendingUsers: Array<User & { attendance: Attendance }>
      absentUsers: Array<User & { attendance: Attendance }>
      pendingUsers: User[]
      totalUsers: number
      attendingCount: number
      absentCount: number
      pendingCount: number
    }>
    error: string | null
  }> {
    try {
      // 1. 다가오는 이벤트 5개 조회 (status = 'upcoming', 가까운 순으로 정렬)
      const { data: upcomingEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'upcoming')
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(5)

      if (eventsError) {
        return { events: [], error: eventsError.message }
      }

      if (!upcomingEvents || upcomingEvents.length === 0) {
        return { events: [], error: null }
      }

      // 2. 모든 활성 사용자 조회
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('number')

      if (usersError) {
        return { events: [], error: usersError.message }
      }

      // 3. 각 이벤트별로 출석 현황 조회
      const eventsWithStatus = await Promise.all(
        upcomingEvents.map(async (event) => {
          // 해당 이벤트의 출석 데이터 조회
          const { data: attendanceData, error: attendanceError } = await supabase
            .from('attendance')
            .select('*')
            .eq('event_id', event.id)

          if (attendanceError) {
            console.error(`이벤트 ${event.id} 출석 데이터 조회 오류:`, attendanceError)
          }

          const attendance = attendanceData || []

          // 사용자별 출석 상태 분류
          const attendingUsers: Array<User & { attendance: Attendance }> = []
          const absentUsers: Array<User & { attendance: Attendance }> = []
          const pendingUsers: User[] = []

          for (const user of allUsers || []) {
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
            totalUsers: allUsers?.length || 0,
            attendingCount: attendingUsers.length,
            absentCount: absentUsers.length,
            pendingCount: pendingUsers.length
          }
        })
      )

      return { events: eventsWithStatus, error: null }
    } catch (error) {
      console.error('관리자 중요 일정 조회 오류:', error)
      return { events: [], error: '중요 일정 현황을 조회하는 중 오류가 발생했습니다.' }
    }
  }
}

// 스태프 요청 관련 서비스 추가
export const staffRequestService = {
  // 사용자의 스태프 요청 목록 조회 (철회된 요청 제외)
  async getUserStaffRequests(userId: string): Promise<StaffRequestWithEvent[]> {
    try {
      const { data, error } = await supabase
        .from('staff_requests')
        .select(`
          *,
          event:events(*),
          requester:users!staff_requests_requester_id_fkey(*),
          substitute:users!staff_requests_substitute_user_id_fkey(*)
        `)
        .eq('requester_id', userId)
        .neq('status', 'withdrawn')  // 철회된 요청 제외
        .order('created_at', { ascending: false })

      return error ? [] : data
    } catch {
      return []
    }
  },

  // 스태프 요청 생성 (중복 처리 로직 포함)
  async createStaffRequest(requestData: {
    requester_id: string
    event_id: string
    request_type: string
    late_arrival_time?: string
    early_departure_time?: string
    partial_start_time?: string
    partial_end_time?: string
    reason_category: string
    reason_detail: string
    priority?: string
    has_substitute?: boolean
    substitute_user_id?: string
    substitute_notes?: string
    expires_at?: string
  }): Promise<{ request: StaffRequest | null; error: string | null }> {
    try {
      // 1. 먼저 동일한 요청이 이미 존재하는지 확인
      const { data: existingRequest, error: checkError } = await supabase
        .from('staff_requests')
        .select('*')
        .eq('requester_id', requestData.requester_id)
        .eq('event_id', requestData.event_id)
        .eq('request_type', requestData.request_type)
        .single()

      // 2. 기존 요청이 있는 경우 처리
      if (existingRequest && !checkError) {
        // 기존 요청의 상태 확인
        if (['submitted', 'under_review'].includes(existingRequest.status)) {
          return { 
            request: null, 
            error: '이미 처리 중인 같은 유형의 요청이 있습니다. 기존 요청을 철회한 후 다시 시도해주세요.' 
          }
        } else if (['rejected', 'withdrawn', 'expired'].includes(existingRequest.status)) {
          // 거부/철회/만료된 요청이 있으면 기존 요청을 업데이트
          const cleanedData = {
            late_arrival_time: requestData.late_arrival_time?.trim() || null,
            early_departure_time: requestData.early_departure_time?.trim() || null,
            partial_start_time: requestData.partial_start_time?.trim() || null,
            partial_end_time: requestData.partial_end_time?.trim() || null,
            reason_category: requestData.reason_category,
            reason_detail: requestData.reason_detail,
            priority: requestData.priority || 'medium',
            has_substitute: requestData.has_substitute || false,
            substitute_user_id: requestData.substitute_user_id?.trim() || null,
            substitute_notes: requestData.substitute_notes?.trim() || null,
            expires_at: requestData.expires_at?.trim() || null,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          const { data: updatedRequest, error: updateError } = await supabase
            .from('staff_requests')
            .update(cleanedData)
            .eq('id', existingRequest.id)
            .select()
            .single()

          if (updateError) {
            console.error('기존 스태프 요청 업데이트 오류:', updateError)
            return { request: null, error: updateError.message }
          }

          return { request: updatedRequest, error: null }
        }
      }

      // 3. 새로운 요청 생성 (기존 요청이 없거나 승인된 경우)
      const cleanedData = {
        requester_id: requestData.requester_id,
        event_id: requestData.event_id,
        request_type: requestData.request_type,
        late_arrival_time: requestData.late_arrival_time?.trim() || null,
        early_departure_time: requestData.early_departure_time?.trim() || null,
        partial_start_time: requestData.partial_start_time?.trim() || null,
        partial_end_time: requestData.partial_end_time?.trim() || null,
        reason_category: requestData.reason_category,
        reason_detail: requestData.reason_detail,
        priority: requestData.priority || 'medium',
        has_substitute: requestData.has_substitute || false,
        substitute_user_id: requestData.substitute_user_id?.trim() || null,
        substitute_notes: requestData.substitute_notes?.trim() || null,
        expires_at: requestData.expires_at?.trim() || null,
        status: 'submitted'
      }

      const { data, error } = await supabase
        .from('staff_requests')
        .insert(cleanedData)
        .select()
        .single()

      if (error) {
        console.error('스태프 요청 생성 오류:', error)
        return { request: null, error: error.message }
      }

      return { request: data, error: null }
    } catch (err) {
      console.error('스태프 요청 생성 예외:', err)
      return { request: null, error: '스태프 요청 생성 중 오류가 발생했습니다.' }
    }
  },

  // 스태프 요청 업데이트
  async updateStaffRequest(requestId: string, updates: Partial<StaffRequest>): Promise<{ request: StaffRequest | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('staff_requests')
        .update(updates)
        .eq('id', requestId)
        .select()
        .single()

      if (error) {
        return { request: null, error: error.message }
      }

      return { request: data, error: null }
    } catch (err) {
      return { request: null, error: '스태프 요청 업데이트 중 오류가 발생했습니다.' }
    }
  },

  // 스태프 요청 삭제 (철회)
  async withdrawStaffRequest(requestId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase
        .from('staff_requests')
        .update({ status: 'withdrawn' })
        .eq('id', requestId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, error: null }
    } catch (err) {
      return { success: false, error: '스태프 요청 철회 중 오류가 발생했습니다.' }
    }
  },

  // 모든 스태프 요청 조회 (관리자용)
  async getAllStaffRequests(): Promise<StaffRequestWithEvent[]> {
    try {
      const { data, error } = await supabase
        .from('staff_requests')
        .select(`
          *,
          event:events(*),
          requester:users!staff_requests_requester_id_fkey(*),
          substitute:users!staff_requests_substitute_user_id_fkey(*)
        `)
        .order('created_at', { ascending: false })

      return error ? [] : data
    } catch {
      return []
    }
  },

  // 특정 이벤트의 스태프 요청 조회
  async getEventStaffRequests(eventId: string): Promise<StaffRequestWithEvent[]> {
    try {
      const { data, error } = await supabase
        .from('staff_requests')
        .select(`
          *,
          event:events(*),
          requester:users!staff_requests_requester_id_fkey(*),
          substitute:users!staff_requests_substitute_user_id_fkey(*)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      return error ? [] : data
    } catch {
      return []
    }
  },

  // 대기 중인 스태프 요청 조회 (관리자용, 철회된 요청 제외)
  async getPendingStaffRequests(): Promise<StaffRequestWithEvent[]> {
    try {
      const { data, error } = await supabase
        .from('staff_requests')
        .select(`
          *,
          event:events(*),
          requester:users!staff_requests_requester_id_fkey(*),
          substitute:users!staff_requests_substitute_user_id_fkey(*)
        `)
        .in('status', ['submitted', 'under_review'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })

      return error ? [] : data
    } catch {
      return []
    }
  },

  // 스태프 요청 상태 업데이트 (관리자용)
  async updateRequestStatus(requestId: string, status: string, notes?: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const updateData: any = { status }
      if (notes) {
        updateData.substitute_notes = notes
      }

      const { error } = await supabase
        .from('staff_requests')
        .update(updateData)
        .eq('id', requestId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, error: null }
    } catch (err) {
      return { success: false, error: '스태프 요청 상태 업데이트 중 오류가 발생했습니다.' }
    }
  },

  // 코칭스태프 조회 (대체자 선택용)
  async getCoachingStaff(): Promise<User[]> {
    try {
      const coachingStaffTags = ['감독', '수석코치', '투수코치', '배터리코치', '수비코치']
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .eq('role', 'manager')
        .in('tag', coachingStaffTags)
        .order('tag')

      return error ? [] : data
    } catch {
      return []
    }
  },

  // 스태프 요청 승인 시 attendance 업데이트 (관리자용)
  async approveRequestWithAttendanceUpdate(
    requestId: string, 
    approverId: string,
    notes?: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      // 1. 요청 정보 조회
      const { data: request, error: requestError } = await supabase
        .from('staff_requests')
        .select('*')
        .eq('id', requestId)
        .single()

      if (requestError || !request) {
        return { success: false, error: '요청을 찾을 수 없습니다.' }
      }

      // 2. 트랜잭션으로 요청 승인과 attendance 업데이트 동시 처리
      const { error: updateError } = await supabase.rpc('approve_staff_request_with_attendance', {
        request_id: requestId,
        approver_id: approverId,
        approval_notes: notes || null
      })

      if (updateError) {
        // RPC가 없다면 수동으로 처리
        console.log('RPC 함수가 없어서 수동으로 처리합니다.')
        
        // 3a. 요청 상태를 승인으로 변경
        const { error: statusError } = await supabase
          .from('staff_requests')
          .update({ 
            status: 'approved',
            substitute_notes: notes 
          })
          .eq('id', requestId)

        if (statusError) {
          return { success: false, error: statusError.message }
        }

        // 3b. attendance 테이블에서 해당 사용자의 해당 이벤트를 불참으로 업데이트
        const { data: existingAttendance, error: attendanceCheckError } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', request.requester_id)
          .eq('event_id', request.event_id)
          .single()

        if (attendanceCheckError && attendanceCheckError.code !== 'PGRST116') {
          console.error('Attendance 조회 오류:', attendanceCheckError)
        }

        if (existingAttendance) {
          // 기존 attendance 업데이트
          const { error: attendanceUpdateError } = await supabase
            .from('attendance')
            .update({ 
              voted_status: 'absent',
              actual_status: 'absent',
              absence_reason: `스태프 요청 승인: ${request.reason_detail}`,
              voted_at: new Date().toISOString()
            })
            .eq('id', existingAttendance.id)

          if (attendanceUpdateError) {
            console.error('Attendance 업데이트 오류:', attendanceUpdateError)
            return { success: false, error: 'attendance 업데이트 중 오류가 발생했습니다.' }
          }
        } else {
          // 새로운 attendance 레코드 생성
          const { error: attendanceCreateError } = await supabase
            .from('attendance')
            .insert({
              user_id: request.requester_id,
              event_id: request.event_id,
              voted_status: 'absent',
              actual_status: 'absent',
              absence_reason: `스태프 요청 승인: ${request.reason_detail}`,
              voted_at: new Date().toISOString()
            })

          if (attendanceCreateError) {
            console.error('Attendance 생성 오류:', attendanceCreateError)
            return { success: false, error: 'attendance 생성 중 오류가 발생했습니다.' }
          }
        }
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('스태프 요청 승인 처리 오류:', err)
      return { success: false, error: '승인 처리 중 오류가 발생했습니다.' }
    }
  },

  // 권한 확인 함수
  async canApproveRequest(approverId: string, requesterId: string): Promise<{ canApprove: boolean; reason?: string }> {
    try {
      // 승인자와 요청자 정보 조회
      const { data: approver, error: approverError } = await supabase
        .from('users')
        .select('*')
        .eq('id', approverId)
        .single()

      const { data: requester, error: requesterError } = await supabase
        .from('users')
        .select('*')
        .eq('id', requesterId)
        .single()

      if (approverError || requesterError || !approver || !requester) {
        return { canApprove: false, reason: '사용자 정보를 찾을 수 없습니다.' }
      }

      // 권한 체계 확인
      if (approver.tag === '단장') {
        // 단장은 감독만 승인 가능
        if (requester.tag === '감독') {
          return { canApprove: true }
        } else {
          return { canApprove: false, reason: '단장은 감독의 요청만 승인할 수 있습니다.' }
        }
      } else if (approver.tag === '감독') {
        // 감독은 수석코치, 투수코치, 배터리코치, 수비코치 승인 가능
        const coachTags = ['수석코치', '투수코치', '배터리코치', '수비코치']
        if (coachTags.includes(requester.tag || '')) {
          return { canApprove: true }
        } else {
          return { canApprove: false, reason: '감독은 코치진의 요청만 승인할 수 있습니다.' }
        }
      } else {
        return { canApprove: false, reason: '승인 권한이 없습니다.' }
      }
    } catch (error) {
      return { canApprove: false, reason: '권한 확인 중 오류가 발생했습니다.' }
    }
  }
} 