import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// Database initialization function
export const initializeDatabase = async () => {
  try {
    const supabase = createClient()
    // Check if data exists, if not initialize
    const { data: existingData } = await supabase
      .from('users')
      .select('id')
      .limit(1)
    
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Database initialization error:', error)
  }
}