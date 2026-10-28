import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Menu, X, Scissors } from 'lucide-react'
import { useState } from 'react'

export default function Navbar() {
  const { user, profile, signOut, isAdmin, isBarber } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    setIsOpen(false)
  }

  return (
    <nav className="bg-dark-800 border-b border-gold-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <Scissors className="h-8 w-8 text-gold-500" />
              <span className="text-xl font-bold text-white">ZIKO</span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link to="/" className="text-gray-300 hover:text-gold-500 px-3 py-2">Home</Link>
              <Link to="/booking" className="text-gray-300 hover:text-gold-500 px-3 py-2">Book Now</Link>
              {user ? (
                <>
                  <Link to="/my-bookings" className="text-gray-300 hover:text-gold-500 px-3 py-2">My Bookings</Link>
                  {isAdmin && <Link to="/admin" className="text-gold-500 px-3 py-2">Admin</Link>}
                  {isBarber && <Link to="/barber" className="text-gold-500 px-3 py-2">Barber</Link>}
                  <span className="text-gray-400 px-3 py-2">{profile?.full_name || user.email}</span>
                  <button onClick={handleSignOut} className="btn-primary">Sign Out</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-gray-300 hover:text-gold-500 px-3 py-2">Login</Link>
                  <Link to="/register" className="btn-primary">Register</Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-300 hover:text-white">
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-dark-800">
            <Link to="/" onClick={() => setIsOpen(false)} className="text-gray-300 hover:text-gold-500 block px-3 py-2">Home</Link>
            <Link to="/booking" onClick={() => setIsOpen(false)} className="text-gray-300 hover:text-gold-500 block px-3 py-2">Book Now</Link>
            {user ? (
              <>
                <Link to="/my-bookings" onClick={() => setIsOpen(false)} className="text-gray-300 hover:text-gold-500 block px-3 py-2">My Bookings</Link>
                {isAdmin && <Link to="/admin" onClick={() => setIsOpen(false)} className="text-gold-500 block px-3 py-2">Admin Dashboard</Link>}
                {isBarber && <Link to="/barber" onClick={() => setIsOpen(false)} className="text-gold-500 block px-3 py-2">Barber Dashboard</Link>}
                <div className="text-gray-400 px-3 py-2">{profile?.full_name || user.email}</div>
                <button onClick={handleSignOut} className="w-full text-left btn-primary mx-3">Sign Out</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setIsOpen(false)} className="text-gray-300 hover:text-gold-500 block px-3 py-2">Login</Link>
                <Link to="/register" onClick={() => setIsOpen(false)} className="btn-primary block mx-3 text-center">Register</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
