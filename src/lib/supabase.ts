import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * RELAY runs in demo mode by default. It only reaches for Supabase when both
 * environment variables are present, so the deployed demo never depends on a
 * backend being configured.
 *
 * Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in `.env.local` and apply
 * `supabase/schema.sql` to a project to activate the hosted path.
 *
 * The client is imported lazily so the Supabase SDK is not shipped in the
 * initial demo bundle.
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabaseProjectUrl = url ?? null

let client: SupabaseClient | null = null
let pending: Promise<SupabaseClient> | null = null

export async function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured || !url || !anonKey) return null
  if (client) return client
  if (!pending) {
    pending = import('@supabase/supabase-js').then(({ createClient }) => {
      client = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
      return client
    })
  }
  return pending
}

/**
 * Human-readable backend mode used in Settings and the README. Never reports
 * "connected" until a real client can be created.
 */
export const backendMode: 'demo' | 'supabase' = isSupabaseConfigured ? 'supabase' : 'demo'
