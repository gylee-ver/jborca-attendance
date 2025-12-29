export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

const PENALTY_POINTS = -7

export async function POST(req: Request) {
  try {
    const secret = process.env.CRON_SECRET
    const headerSecret = req.headers.get('x-cron-secret')

    if (secret && headerSecret !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const supabase = createAdminSupabaseClient()
    const now = new Date()
    const today = now.toISOString().split('T')[0] // YYYY-MM-DD
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM

    // 시작 시간이 지난 upcoming 이벤트 조회
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'upcoming')
      .or(`date.lt.${today},and(date.eq.${today},time.lte.${currentTime})`)

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 400 })
    }

    const results: Array<{ eventId: string; penalized: number }> = []

    for (const event of events || []) {
      // 미투표자 찾기
      const { data: pendingAttendance, error: pendingError } = await supabase
        .from('attendance')
        .select('id, user_id, voted_status, actual_status')
        .eq('event_id', event.id)
        .eq('voted_status', 'pending')

      if (pendingError) {
        console.error(`이벤트 ${event.id} 미투표 조회 오류:`, pendingError)
        continue
      }

      let penalizedCount = 0

      for (const att of pendingAttendance || []) {
        // 중복 삽입 방지: 동일 reason 존재 여부 확인
        const reason = `미투표 -7 (event ${event.id})`
        const { data: existingLog, error: logError } = await supabase
          .from('point_logs')
          .select('id')
          .eq('user_id', att.user_id)
          .eq('reason', reason)
          .limit(1)
          .maybeSingle()

        if (logError) {
          console.error(`포인트 중복 체크 실패:`, logError)
        }

        if (!existingLog) {
          const { error: insertError } = await supabase
            .from('point_logs')
            .insert({
              user_id: att.user_id,
              admin_id: null,
              category: 'participation',
              reason,
              points: PENALTY_POINTS
            })

          if (insertError) {
            console.error(`포인트 삽입 실패 user ${att.user_id}:`, insertError)
          } else {
            // 총 포인트 갱신
            const { data: userRow } = await supabase
              .from('users')
              .select('total_points')
              .eq('id', att.user_id)
              .single()

            const newTotal = (userRow?.total_points ?? 0) + PENALTY_POINTS
            const { error: updateError } = await supabase
              .from('users')
              .update({ total_points: newTotal })
              .eq('id', att.user_id)

            if (updateError) {
              console.error(`총 포인트 갱신 실패 user ${att.user_id}:`, updateError)
            }

            penalizedCount += 1
          }
        }

        // 출석 상태를 불참으로 전환
        const { error: attendanceUpdateError } = await supabase
          .from('attendance')
          .update({
            actual_status: 'absent',
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', att.id)

        if (attendanceUpdateError) {
          console.error(`attendance 업데이트 실패 ${att.id}:`, attendanceUpdateError)
        }
      }

      // 이벤트 상태를 ongoing으로 변경 (중복 실행 방지용)
      if (penalizedCount > 0 || (pendingAttendance && pendingAttendance.length > 0)) {
        const { error: statusError } = await supabase
          .from('events')
          .update({ status: 'ongoing' })
          .eq('id', event.id)

        if (statusError) {
          console.error(`이벤트 상태 업데이트 실패 ${event.id}:`, statusError)
        }
      }

      results.push({ eventId: event.id, penalized: penalizedCount })
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('auto-penalize 오류:', error)
    return NextResponse.json({ error: error?.message || '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}


