import { createClient } from '@supabase/supabase-js'

// เปลี่ยนจากใส่รหัสตรงๆ มาเป็นแบบนี้ครับ
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
