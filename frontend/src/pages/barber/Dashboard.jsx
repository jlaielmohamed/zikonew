import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Calendar, Clock, Check, X } from 'lucide-react'

export default function BarberDashboard() {
  const { user } = useAuth()
  const [barber, setBarber] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('day')

  useEffect(() => {
    fetchBarberData()
  }, [user])

  const fetchBarberData = async () => {
    try {
      const { data: barberData } = await supabase
        .from('barbers')
        .select('*')
        .eq('profile_id', user.id)
        .single()
      
      setBarber(barberData)
      
      if (barberData) {
        const { data: bookingsData } = await supabase
          .from('bookings')
          .select(`
            *,
            services(name, price),
            profiles(full_name, phone)
          `)
          .eq('barber_id', barberData.id)
          .order('starts_at')
        
        setBookings(bookingsData || [])
      }
    } catch (error) {
      console.error('Error fetching barber data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (bookingId, status) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId)
      if (error) throw error
      toast.success('Status updated')
      fetchBarberData()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const todayBookings = bookings.filter(b => 
    format(new Date(b.starts_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500"></div>
      </div>
    )
  }

  if (!barber) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card text-center">
          <p className="text-white">No barber profile linked to your account</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Barber Dashboard</h1>
          <p className="text-gray-400">Welcome, {barber.display_name}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Today's Appointments</p>
                <p className="text-2xl font-bold text-white">{todayBookings.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-gold-500" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pending</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {bookings.filter(b => b.status === 'pending').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Accepted</p>
                <p className="text-2xl font-bold text-green-500">
                  {bookings.filter(b => b.status === 'accepted').length}
                </p>
              </div>
              <Check className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Today's Schedule</h2>
          {todayBookings.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No appointments today</p>
          ) : (
            <div className="space-y-3">
              {todayBookings.map((booking) => (
                <div key={booking.id} className="flex justify-between items-center p-4 bg-dark-700 rounded">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-2">
                      <span className="text-gold-500 font-semibold">
                        {format(new Date(booking.starts_at), 'HH:mm')} - {format(new Date(booking.ends_at), 'HH:mm')}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        booking.status === 'accepted' ? 'bg-green-500/10 text-green-500' :
                        booking.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-gray-500/10 text-gray-500'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                    <p className="text-white font-semibold">
                      {booking.profiles?.full_name || booking.guest_name}
                    </p>
                    <p className="text-gray-400">{booking.services?.name} - ${booking.price_at_booking}</p>
                    {booking.profiles?.phone && (
                      <p className="text-gray-400 text-sm">{booking.profiles.phone}</p>
                    )}
                    {booking.guest_phone && (
                      <p className="text-gray-400 text-sm">{booking.guest_phone}</p>
                    )}
                    {booking.notes && (
                      <p className="text-gray-300 text-sm mt-1">Note: {booking.notes}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {booking.status === 'accepted' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(booking.id, 'completed')}
                          className="btn-primary text-sm"
                        >
                          Mark Complete
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(booking.id, 'no_show')}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                        >
                          No Show
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
