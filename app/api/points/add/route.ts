export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { userId, adminId, category, reason, points } = body || {}

    if (!userId || !adminId || !category || typeof points !== 'number' || !reason) {
      return NextResponse.json({ error: '필수 값이 누락되었습니다.' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()

    // 포인트 로그 삽입
    const { error: insertError } = await supabase
      .from('point_logs')
      .insert({
        user_id: userId,
        admin_id: adminId,
        category,
        reason,
        points
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    // 총 포인트 반영
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('total_points')
      .eq('id', userId)
      .single()

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }

    const currentTotal = userRow?.total_points ?? 0
    const newTotal = currentTotal + points

    const { error: updateError } = await supabase
      .from('users')
      .update({ total_points: newTotal })
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, newTotal })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}


