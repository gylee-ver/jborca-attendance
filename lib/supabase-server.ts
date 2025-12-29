import { createClient } from '@supabase/supabase-js'

export const createAdminSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service role 환경 변수가 설정되지 않았습니다.')
  }

  return createClient(supabaseUrl, serviceKey)
}


