import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Calendar, DollarSign, Users, Scissors, Clock } from 'lucide-react'
import { format } from 'date-fns'

export default function Overview() {
  const [stats, setStats] = useState(null)
  const [todayBookings, setTodayBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [statsRes, todayRes] = await Promise.all([
        supabase.rpc('admin_stats'),
        supabase
          .from('bookings')
          .select(`
            *,
            services(name),
            barbers(display_name),
            profiles(full_name)
          `)
          .gte('starts_at', format(new Date(), 'yyyy-MM-dd'))
          .lt('starts_at', format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'))
          .order('starts_at')
      ])

      if (statsRes.data) setStats(statsRes.data)
      if (todayRes.data) setTodayBookings(todayRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-white">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Overview</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Revenue (30 days)</p>
              <p className="text-2xl font-bold text-gold-500">${stats?.revenue || 0}</p>
            </div>
            <DollarSign className="h-8 w-8 text-gold-500" />
          </div>
        </div>
        
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
                {stats?.bookings_by_status?.pending || 0}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Completed</p>
              <p className="text-2xl font-bold text-green-500">
                {stats?.bookings_by_status?.completed || 0}
              </p>
            </div>
            <Users className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Today's Appointments</h2>
          {todayBookings.length === 0 ? (
            <p className="text-gray-400">No appointments today</p>
          ) : (
            <div className="space-y-3">
              {todayBookings.map((booking) => (
                <div key={booking.id} className="flex justify-between items-center p-3 bg-dark-700 rounded">
                  <div>
                    <p className="text-white font-semibold">
                      {booking.profiles?.full_name || booking.guest_name}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {booking.services?.name} with {booking.barbers?.display_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gold-500">{format(new Date(booking.starts_at), 'HH:mm')}</p>
                    <span className={`text-xs px-2 py-1 rounded ${
                      booking.status === 'accepted' ? 'bg-green-500/10 text-green-500' :
                      booking.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-gray-500/10 text-gray-500'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Services */}
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Top Services</h2>
          {stats?.top_services?.length > 0 ? (
            <div className="space-y-3">
              {stats.top_services.map((service, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div className="flex items-center">
                    <Scissors className="h-4 w-4 text-gold-500 mr-2" />
                    <span className="text-white">{service.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-white">{service.count} bookings</p>
                    <p className="text-gold-500 text-sm">${service.revenue}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No data yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
