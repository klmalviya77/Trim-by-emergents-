'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Scissors, MapPin, Clock, Star, Users, ChevronRight } from 'lucide-react'

export default function TrimTime() {
  const [currentPage, setCurrentPage] = useState('landing')
  const [selectedRole, setSelectedRole] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState('')
  
  const supabase = createClient()

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      setLoading(false)
      
      // If user is logged in, determine their role and redirect
      if (session?.user) {
        try {
          const { data: userData, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()
          
          if (userData?.role === 'customer') {
            setCurrentPage('customerDashboard')
          } else if (userData?.role === 'barber') {
            setCurrentPage('barberDashboard')
          }
        } catch (err) {
          console.error('Error fetching user role:', err)
        }
      }
    }
    
    checkAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null)
      }
    )
    
    return () => subscription.unsubscribe()
  }, [])

  // Role selection handler
  const handleRoleSelection = (role) => {
    setSelectedRole(role)
    localStorage.setItem('selectedRole', role)
    setCurrentPage(role === 'customer' ? 'customerAuth' : 'barberAuth')
  }

  // Authentication handlers
  const handleAuth = async (email, password, name = '', isSignUp = false, additionalData = {}) => {
    setAuthLoading(true)
    setError('')
    
    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        
        if (signUpError) throw signUpError
        
        // Insert user data into our users table
        if (data.user) {
          const { error: insertError } = await supabase
            .from('users')
            .insert([{
              id: data.user.id,
              email: email,
              name: name,
              role: selectedRole,
              createdAt: new Date().toISOString()
            }])
          
          if (insertError) {
            console.error('Error inserting user data:', insertError)
            throw insertError
          }
          
          // If barber, also insert into barber_shops table
          if (selectedRole === 'barber') {
            const { error: barberError } = await supabase
              .from('barber_shops')
              .insert([{
                id: `shop_${data.user.id}`,
                userId: data.user.id,
                shopName: additionalData.shopName || '',
                category: additionalData.category || '',
                areaName: additionalData.areaName || '',
                locationLink: additionalData.locationLink || '',
                services: [],
                ratingAvg: 0,
                totalReviews: 0,
                bookingsCount: 0,
                verify: false,
                createdAt: new Date().toISOString()
              }])
            
            if (barberError) {
              console.error('Error inserting barber shop data:', barberError)
              throw barberError
            }
          }
        }
        
        alert('Registration successful! Please check your email to verify your account.')
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        
        if (signInError) throw signInError
        
        // Check user role and redirect
        const { data: userData, error: roleError } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.user.id)
          .single()
        
        if (roleError) throw roleError
        
        if (userData.role === 'customer') {
          setCurrentPage('customerDashboard')
        } else if (userData.role === 'barber') {
          // Check if barber is verified
          const { data: barberData, error: verifyError } = await supabase
            .from('barber_shops')
            .select('verify')
            .eq('user_id', data.user.id)
            .single()
          
          if (verifyError || !barberData.verify) {
            throw new Error('Your barber account is not yet verified. Please wait for admin approval.')
          }
          
          setCurrentPage('barberDashboard')
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setCurrentPage('landing')
    setSelectedRole(null)
    localStorage.removeItem('selectedRole')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Scissors className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading TrimTime...</p>
        </div>
      </div>
    )
  }

  // Landing Page - Role Selection
  if (currentPage === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-16">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center mb-6">
              <Scissors className="w-16 h-16 text-blue-600 mr-4" />
              <h1 className="text-6xl font-bold text-gray-900">TrimTime</h1>
            </div>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Skip the wait, book your spot. Real-time barber shop queue management.
            </p>
          </div>

          {/* Role Selection Cards */}
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 mb-16">
            <Card 
              className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border-2 hover:border-blue-500"
              onClick={() => handleRoleSelection('customer')}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-12 h-12 text-blue-600" />
                </div>
                <CardTitle className="text-2xl text-gray-900">I am a Customer</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-6">
                  Find nearby barber shops, join queues remotely, and track your position in real-time.
                </p>
                <div className="space-y-3 text-sm text-gray-500">
                  <div className="flex items-center justify-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span>Discover nearby shops</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>Real-time wait tracking</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <Star className="w-4 h-4 mr-2" />
                    <span>Rate & review services</span>
                  </div>
                </div>
                <Button className="mt-6 bg-blue-600 hover:bg-blue-700">
                  Get Started <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border-2 hover:border-green-500"
              onClick={() => handleRoleSelection('barber')}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Scissors className="w-12 h-12 text-green-600" />
                </div>
                <CardTitle className="text-2xl text-gray-900">I am a Barber</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-6">
                  Manage your shop's queue efficiently, serve customers better, and grow your business.
                </p>
                <div className="space-y-3 text-sm text-gray-500">
                  <div className="flex items-center justify-center">
                    <Users className="w-4 h-4 mr-2" />
                    <span>Manage customer queues</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>Optimize service times</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <Star className="w-4 h-4 mr-2" />
                    <span>Build your reputation</span>
                  </div>
                </div>
                <Button className="mt-6 bg-green-600 hover:bg-green-700">
                  Get Started <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Features Preview */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Why Choose TrimTime?</h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Real-Time Updates</h3>
                <p className="text-gray-600">Live queue positions and estimated wait times</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Location-Based</h3>
                <p className="text-gray-600">Find the nearest barber shops instantly</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Quality Assured</h3>
                <p className="text-gray-600">Verified reviews and ratings system</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Customer Authentication Page
  if (currentPage === 'customerAuth') {
    return <AuthPage 
      role="customer" 
      onAuth={handleAuth} 
      onBack={() => setCurrentPage('landing')}
      loading={authLoading}
      error={error}
    />
  }

  // Barber Authentication Page
  if (currentPage === 'barberAuth') {
    return <BarberAuthPage 
      role="barber" 
      onAuth={handleAuth} 
      onBack={() => setCurrentPage('landing')}
      loading={authLoading}
      error={error}
    />
  }

  // Customer Dashboard
  if (currentPage === 'customerDashboard') {
    return <CustomerDashboard user={user} onSignOut={handleSignOut} />
  }

  // Barber Dashboard
  if (currentPage === 'barberDashboard') {
    return <BarberDashboard user={user} onSignOut={handleSignOut} />
  }

  return null
}

// Customer Authentication Component
function AuthPage({ role, onAuth, onBack, loading, error }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onAuth(formData.email, formData.password, formData.name, isSignUp)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-blue-600 mr-2" />
            <h2 className="text-2xl font-bold">Customer {isSignUp ? 'Sign Up' : 'Sign In'}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
            </div>
            
            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                {error}
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
          
          <div className="mt-4 text-center">
            <button
              onClick={onBack}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              ← Back to Role Selection
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Barber Authentication Component
function BarberAuthPage({ role, onAuth, onBack, loading, error }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    shopName: '',
    category: '',
    areaName: '',
    locationLink: ''
  })

  const categories = [
    'Traditional Barber',
    'Modern Salon',
    'Unisex Salon',
    'Men\'s Grooming',
    'Hair & Beard Specialist'
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    const additionalData = {
      shopName: formData.shopName,
      category: formData.category,
      areaName: formData.areaName,
      locationLink: formData.locationLink
    }
    onAuth(formData.email, formData.password, formData.name, isSignUp, additionalData)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Scissors className="w-8 h-8 text-green-600 mr-2" />
            <h2 className="text-2xl font-bold">Barber {isSignUp ? 'Registration' : 'Sign In'}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="shopName">Shop Name</Label>
                  <Input
                    id="shopName"
                    type="text"
                    value={formData.shopName}
                    onChange={(e) => setFormData({...formData, shopName: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="areaName">Area Name</Label>
                  <Input
                    id="areaName"
                    type="text"
                    value={formData.areaName}
                    onChange={(e) => setFormData({...formData, areaName: e.target.value})}
                    placeholder="e.g., Downtown, Suburb Name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="locationLink">Google Maps Link</Label>
                  <Input
                    id="locationLink"
                    type="url"
                    value={formData.locationLink}
                    onChange={(e) => setFormData({...formData, locationLink: e.target.value})}
                    placeholder="Paste Google Maps link here"
                    required
                  />
                </div>
              </>
            )}
            
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
            </div>
            
            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                {error}
              </div>
            )}
            
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
              {loading ? 'Processing...' : (isSignUp ? 'Register Shop' : 'Sign In')}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-green-600 hover:text-green-800 text-sm"
            >
              {isSignUp ? 'Already registered? Sign In' : "Don't have an account? Register"}
            </button>
          </div>
          
          <div className="mt-4 text-center">
            <button
              onClick={onBack}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              ← Back to Role Selection
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Customer Dashboard Component
function CustomerDashboard({ user, onSignOut }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Scissors className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">TrimTime</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600" />
                <span className="text-sm text-gray-600">{user?.email}</span>
              </div>
              <Button variant="outline" onClick={onSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Your Dashboard!</h2>
          <p className="text-gray-600 mb-8">Find nearby barber shops and join queues remotely.</p>
          <div className="bg-blue-50 p-8 rounded-lg">
            <MapPin className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-700">
              Customer features coming soon: Shop discovery, real-time queue management, and more!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Barber Dashboard Component
function BarberDashboard({ user, onSignOut }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Scissors className="w-8 h-8 text-green-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">TrimTime Barber</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-gray-600" />
                <span className="text-sm text-gray-600">{user?.email}</span>
              </div>
              <Button variant="outline" onClick={onSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Your Barber Dashboard!</h2>
          <p className="text-gray-600 mb-8">Manage your shop's queue and serve customers efficiently.</p>
          <div className="bg-green-50 p-8 rounded-lg">
            <Users className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <p className="text-gray-700">
              Barber features coming soon: Queue management, customer tracking, and analytics!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}