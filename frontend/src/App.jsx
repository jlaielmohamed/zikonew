import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import {
  BARBER_GOOGLE_LOGIN_FLAG,
  BARBER_GOOGLE_WRONG_ROLE_FLAG,
} from './config/authFlags'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Booking from './pages/Booking'
import Login from './pages/Login'
import BarberLogin from './pages/BarberLogin'
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

  // Google sign-in from the barber page returns to the allowed site root.
  // Continue to the barber dashboard only if the account is really a barber.
  useEffect(() => {
    if (loading || !sessionStorage.getItem(BARBER_GOOGLE_LOGIN_FLAG)) return

    sessionStorage.removeItem(BARBER_GOOGLE_LOGIN_FLAG)

    if (!user) return

    if (profile?.role === 'barber') {
      navigate('/barber', { replace: true })
    } else {
      sessionStorage.setItem(BARBER_GOOGLE_WRONG_ROLE_FLAG, '1')
      signOut()
      navigate('/barber-login', { replace: true })
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
        <Route path="/barber-login" element={<BarberLogin />} />
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
