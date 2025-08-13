import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server.js'

// CORS handling
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

export async function GET(request) {
  try {
    const supabase = createSupabaseServer()
    const { pathname } = new URL(request.url)
    const path = pathname.replace('/api/', '')

    // Health check endpoint
    if (path === 'health') {
      return handleCORS(NextResponse.json({ 
        status: 'ok',
        message: 'TrimTime API is running',
        timestamp: new Date().toISOString()
      }))
    }

    // Get current user
    if (path === 'auth/user') {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        return handleCORS(NextResponse.json({ error: error.message }, { status: 401 }))
      }
      return handleCORS(NextResponse.json({ user }))
    }

    // Get barber shops (for customers)
    if (path === 'shops') {
      const { data, error } = await supabase
        .from('barber_shops')
        .select('*')
        .eq('verify', true)
        .order('createdAt', { ascending: false })

      if (error) {
        return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      }

      return handleCORS(NextResponse.json({ shops: data || [] }))
    }

    // Get bookings for a user
    if (path === 'bookings') {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (!user) {
        return handleCORS(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
      }

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          barber_shops (
            shopName,
            areaName
          )
        `)
        .eq('userId', user.id)
        .order('joinedAt', { ascending: false })

      if (error) {
        return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      }

      return handleCORS(NextResponse.json({ bookings: data || [] }))
    }

    // Get queue for a specific shop
    if (path.startsWith('queue/')) {
      const shopId = path.split('/')[1]
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          users (
            name,
            email
          )
        `)
        .eq('shopId', shopId)
        .eq('status', 'waiting')
        .order('joinedAt', { ascending: true })

      if (error) {
        return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      }

      return handleCORS(NextResponse.json({ queue: data || [] }))
    }

    return handleCORS(NextResponse.json({ error: 'Endpoint not found' }, { status: 404 }))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 }))
  }
}

export async function POST(request) {
  try {
    const supabase = createSupabaseServer()
    const { pathname } = new URL(request.url)
    const path = pathname.replace('/api/', '')
    const body = await request.json()

    // Authentication endpoints
    if (path === 'auth/signup') {
      const { email, password } = body
      const { data, error } = await supabase.auth.signUp({ email, password })
      
      if (error) {
        return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
      }
      
      return handleCORS(NextResponse.json({ user: data.user }))
    }

    if (path === 'auth/signin') {
      const { email, password } = body
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      
      if (error) {
        return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
      }
      
      return handleCORS(NextResponse.json({ user: data.user }))
    }

    if (path === 'auth/signout') {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        return handleCORS(NextResponse.json({ error: error.message }, { status: 400 }))
      }
      
      return handleCORS(NextResponse.json({ message: 'Signed out successfully' }))
    }

    // Protected endpoints - require authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user) {
      return handleCORS(NextResponse.json({ error: "Unauthorized - Please log in" }, { status: 401 }))
    }

    // Join queue (customer)
    if (path === 'bookings') {
      const { shopId, service } = body
      
      // Check if user already has an active booking at this shop
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('userId', user.id)
        .eq('shopId', shopId)
        .eq('status', 'waiting')
        .single()

      if (existingBooking) {
        return handleCORS(NextResponse.json({ 
          error: 'You already have an active booking at this shop' 
        }, { status: 400 }))
      }

      const booking = {
        id: `booking_${Date.now()}_${user.id}`,
        userId: user.id,
        shopId,
        service,
        status: 'waiting',
        joinedAt: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('bookings')
        .insert([booking])
        .select()
        .single()

      if (error) {
        return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      }

      return handleCORS(NextResponse.json({ booking: data }))
    }

    // Update booking status (barber)
    if (path.startsWith('bookings/') && path.includes('/status')) {
      const bookingId = path.split('/')[1]
      const { status } = body

      const { data, error } = await supabase
        .from('bookings')
        .update({ 
          status,
          updatedAt: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select()
        .single()

      if (error) {
        return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      }

      return handleCORS(NextResponse.json({ booking: data }))
    }

    // Add review
    if (path === 'reviews') {
      const { shopId, rating, reviewText } = body
      
      const review = {
        id: `review_${Date.now()}_${user.id}`,
        shopId,
        userId: user.id,
        rating,
        reviewText: reviewText || '',
        createdAt: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('reviews')
        .insert([review])
        .select()
        .single()

      if (error) {
        return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      }

      // Update shop's average rating
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('shopId', shopId)

      if (reviews && reviews.length > 0) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        
        await supabase
          .from('barber_shops')
          .update({ 
            ratingAvg: parseFloat(avgRating.toFixed(1)),
            totalReviews: reviews.length
          })
          .eq('id', shopId)
      }

      return handleCORS(NextResponse.json({ review: data }))
    }

    return handleCORS(NextResponse.json({ error: 'Endpoint not found' }, { status: 404 }))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 }))
  }
}

export async function PUT(request) {
  try {
    const supabase = createSupabaseServer()
    const { pathname } = new URL(request.url)
    const path = pathname.replace('/api/', '')
    const body = await request.json()

    // Protected endpoints - require authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user) {
      return handleCORS(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    }

    // Update barber shop details
    if (path.startsWith('shops/')) {
      const shopId = path.split('/')[1]
      
      // Verify ownership
      const { data: shop } = await supabase
        .from('barber_shops')
        .select('userId')
        .eq('id', shopId)
        .single()

      if (!shop || shop.userId !== user.id) {
        return handleCORS(NextResponse.json({ error: "Unauthorized" }, { status: 403 }))
      }

      const { data, error } = await supabase
        .from('barber_shops')
        .update({
          ...body,
          updatedAt: new Date().toISOString()
        })
        .eq('id', shopId)
        .select()
        .single()

      if (error) {
        return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      }

      return handleCORS(NextResponse.json({ shop: data }))
    }

    return handleCORS(NextResponse.json({ error: 'Endpoint not found' }, { status: 404 }))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 }))
  }
}

export async function DELETE(request) {
  try {
    const supabase = createSupabaseServer()
    const { pathname } = new URL(request.url)
    const path = pathname.replace('/api/', '')

    // Protected endpoints - require authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user) {
      return handleCORS(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    }

    // Cancel booking
    if (path.startsWith('bookings/')) {
      const bookingId = path.split('/')[1]
      
      const { data, error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .eq('user_id', user.id) // Ensure user owns the booking
        .select()
        .single()

      if (error) {
        return handleCORS(NextResponse.json({ error: error.message }, { status: 500 }))
      }

      return handleCORS(NextResponse.json({ booking: data }))
    }

    return handleCORS(NextResponse.json({ error: 'Endpoint not found' }, { status: 404 }))

  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 }))
  }
}