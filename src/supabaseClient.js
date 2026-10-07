// NUEVO (desde CDN)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase se carga globalmente desde CDN
export const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey)