import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import {
  STAFF_GOOGLE_LOGIN_FLAG,
  STAFF_LOGIN_WRONG_ROLE_FLAG,
} from './config/authFlags'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Booking from './pages/Booking'
import Login from './pages/Login'
import MyBookings from './pages/MyBookings'
import AdminDashboard from './pages/admin/Dashboard'
import BarberDashboard from './pages/barber/Dashboard'
import Loading from './components/Loading'

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, profile, loading } = useAuth()
  
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" />
  if (requiredRole && profile?.role !== requiredRole) {
    if (profile?.role === 'admin') return <Navigate to="/admin" />
    if (profile?.role === 'barber') return <Navigate to="/barber" />
    return <Navigate to="/" />
  }
  
  return children
}

function AppRoutes() {
  const { user, profile, loading, signOut } = useAuth()
  const navigate = useNavigate()

  // Google sign-in returns to the allowed site root. Continue to the right
  // staff dashboard based on the role stored in the profile.
  useEffect(() => {
    if (loading || !sessionStorage.getItem(STAFF_GOOGLE_LOGIN_FLAG)) return

    sessionStorage.removeItem(STAFF_GOOGLE_LOGIN_FLAG)

    if (!user) return

    if (profile?.role === 'admin') {
      navigate('/admin', { replace: true })
    } else if (profile?.role === 'barber') {
      navigate('/barber', { replace: true })
    } else {
      sessionStorage.setItem(STAFF_LOGIN_WRONG_ROLE_FLAG, '1')
      signOut()
      navigate('/login', { replace: true })
    }
  }, [loading, user, profile, navigate, signOut])
  
  if (loading) return <Loading />
  
  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="/login" element={<Login />} />
        <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
        <Route path="/admin/*" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/barber/*" element={<ProtectedRoute requiredRole="barber"><BarberDashboard /></ProtectedRoute>} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
