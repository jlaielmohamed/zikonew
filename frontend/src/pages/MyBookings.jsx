import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Calendar, Clock, User, Scissors } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

export default function MyBookings() {
  const { user } = useAuth()
  const { t, formatPrice, dateLocale } = useLanguage()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBookings()
    
    // Subscribe to realtime changes
    const subscription = supabase
      .channel('my-bookings')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'bookings', filter: `customer_id=eq.${user.id}` },
        () => {
          fetchBookings()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user])

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services(name, price),
          barbers(display_name)
        `)
        .eq('customer_id', user.id)
        .order('starts_at', { ascending: false })
      
      if (error) throw error
      setBookings(data || [])
    } catch (error) {
      console.error('Error fetching bookings:', error)
      toast.error(t('my.fetchError'))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (bookingId) => {
    if (!confirm(t('my.confirmCancel'))) return
    
    try {
      const { error } = await supabase.rpc('cancel_booking', { booking_id: bookingId })
      if (error) throw error
      toast.success(t('my.cancelled'))
      fetchBookings()
    } catch (error) {
      toast.error(error.message)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted': return 'text-green-500 bg-green-500/10'
      case 'pending': return 'text-yellow-500 bg-yellow-500/10'
      case 'denied': return 'text-red-500 bg-red-500/10'
      case 'cancelled': return 'text-gray-500 bg-gray-500/10'
      case 'completed': return 'text-blue-500 bg-blue-500/10'
      case 'no_show': return 'text-red-600 bg-red-600/10'
      default: return 'text-gray-500 bg-gray-500/10'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">{t('my.title')}</h1>
        
        {bookings.length === 0 ? (
          <div className="card text-center py-12">
            <Calendar className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">{t('my.none')}</p>
            <a href="/booking" className="btn-primary">{t('nav.bookNow')}</a>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div key={booking.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white flex items-center">
                      <Scissors className="h-5 w-5 text-gold-500 mr-2" />
                      {booking.services?.name}
                    </h3>
                    <span className={`inline-block px-2 py-1 rounded text-sm mt-2 uppercase ${getStatusColor(booking.status)}`}>
                      {t(`status.${booking.status}`)}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gold-500">
                      {formatPrice(booking.price_at_booking)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center text-gray-300">
                    <Calendar className="h-5 w-5 text-gold-500 mr-2" />
                    {format(new Date(booking.starts_at), t('fmt.longDate'), { locale: dateLocale })}
                  </div>
                  <div className="flex items-center text-gray-300">
                    <Clock className="h-5 w-5 text-gold-500 mr-2" />
                    {format(new Date(booking.starts_at), 'HH:mm')} - {format(new Date(booking.ends_at), 'HH:mm')}
                  </div>
                  <div className="flex items-center text-gray-300">
                    <User className="h-5 w-5 text-gold-500 mr-2" />
                    {booking.barbers?.display_name}
                  </div>
                </div>

                {booking.notes && (
                  <div className="bg-dark-700 p-3 rounded mb-4">
                    <p className="text-sm text-gray-400">{t('my.notes')}</p>
                    <p className="text-white">{booking.notes}</p>
                  </div>
                )}

                {booking.status === 'denied' && booking.denial_reason && (
                  <div className="bg-red-500/10 border border-red-500 p-3 rounded mb-4">
                    <p className="text-sm text-red-500 font-semibold">{t('my.denialReason')}</p>
                    <p className="text-white">{booking.denial_reason}</p>
                  </div>
                )}

                {(booking.status === 'pending' || booking.status === 'accepted') && (
                  <button
                    onClick={() => handleCancel(booking.id)}
                    className="btn-secondary text-red-500 border-red-500 hover:bg-red-500 hover:text-white"
                  >
                    {t('my.cancel')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
