import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SESSION_EXPIRED_FLAG } from '../config/authFlags'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

// A token can outlive its auth user (for example after an email change or an
// account being recreated). Supabase then rejects every query with one of these.
const isInvalidSessionError = (error) => {
  const message = String(error?.message || '').toLowerCase()
  return (
    message.includes('user from sub claim') ||
    message.includes('jwt') ||
    message.includes('invalid token') ||
    message.includes('session not found')
  )
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function clearInvalidSession() {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (error) {
      console.error('Could not clear invalid session:', error)
    }
    sessionStorage.setItem(SESSION_EXPIRED_FLAG, '1')
    setUser(null)
    setProfile(null)
    setLoading(false)
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
      if (isInvalidSessionError(error)) await clearInvalidSession()
    } finally {
      setLoading(false)
    }
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    })
    return { data, error }
  }

  const signInWithGoogle = async (redirectTo) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo || window.location.origin
      }
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    refreshProfile,
    isAdmin: profile?.role === 'admin',
    isBarber: profile?.role === 'barber',
    isCustomer: profile?.role === 'customer'
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
