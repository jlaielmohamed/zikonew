import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Calendar, DollarSign, Users, Scissors, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { useLanguage } from '../../i18n/LanguageContext'

export default function Overview() {
  const { t, formatPrice } = useLanguage()
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
    return <div className="text-white">{t('a.loading')}</div>
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">{t('a.menu.overview')}</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-gray-400 text-xs sm:text-sm">{t('a.ov.revenue30')}</p>
              <p className="text-xl sm:text-2xl font-bold text-gold-500 break-words">{formatPrice(stats?.revenue || 0)}</p>
            </div>
            <DollarSign className="h-7 w-7 sm:h-8 sm:w-8 text-gold-500 flex-shrink-0" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-gray-400 text-xs sm:text-sm">{t('a.ov.today')}</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{todayBookings.length}</p>
            </div>
            <Calendar className="h-7 w-7 sm:h-8 sm:w-8 text-gold-500 flex-shrink-0" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-gray-400 text-xs sm:text-sm">{t('status.pending')}</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-500">
                {stats?.bookings_by_status?.pending || 0}
              </p>
            </div>
            <Clock className="h-7 w-7 sm:h-8 sm:w-8 text-yellow-500 flex-shrink-0" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-gray-400 text-xs sm:text-sm">{t('status.completed')}</p>
              <p className="text-xl sm:text-2xl font-bold text-green-500">
                {stats?.bookings_by_status?.completed || 0}
              </p>
            </div>
            <Users className="h-7 w-7 sm:h-8 sm:w-8 text-green-500 flex-shrink-0" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Today's Appointments */}
        <div className="card min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">{t('a.ov.today')}</h2>
          {todayBookings.length === 0 ? (
            <p className="text-gray-400">{t('a.ov.noToday')}</p>
          ) : (
            <div className="space-y-3">
              {todayBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 bg-dark-700 rounded"
                >
                  <div className="min-w-0">
                    <p className="text-white font-semibold break-words">
                      {booking.profiles?.full_name || booking.guest_name}
                    </p>
                    <p className="text-gray-400 text-sm break-words">
                      {booking.services?.name} {t('a.with')} {booking.barbers?.display_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1 sm:text-right flex-shrink-0">
                    <p className="text-gold-500">{format(new Date(booking.starts_at), 'HH:mm')}</p>
                    <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                      booking.status === 'accepted' ? 'bg-green-500/10 text-green-500' :
                      booking.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-gray-500/10 text-gray-500'
                    }`}>
                      {t(`status.${booking.status}`)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Services */}
        <div className="card min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">{t('a.ov.topServices')}</h2>
          {stats?.top_services?.length > 0 ? (
            <div className="space-y-3">
              {stats.top_services.map((service, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3">
                  <div className="flex items-center min-w-0">
                    <Scissors className="h-4 w-4 text-gold-500 mr-2 flex-shrink-0" />
                    <span className="text-white break-words">{service.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white text-sm sm:text-base">{service.count} {t('a.bookings')}</p>
                    <p className="text-gold-500 text-sm">{formatPrice(service.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">{t('a.ov.noData')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
