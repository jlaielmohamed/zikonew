import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Scissors, Clock, MapPin, Phone, Instagram, Facebook } from 'lucide-react'

export default function Home() {
  const [shopSettings, setShopSettings] = useState(null)
  const [services, setServices] = useState([])
  const [barbers, setBarbers] = useState([])
  const [reviews, setReviews] = useState([])
  const [shopHours, setShopHours] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [settingsRes, servicesRes, barbersRes, reviewsRes, hoursRes] = await Promise.all([
        supabase.from('shop_settings').select('*').single(),
        supabase.from('services').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('barbers').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('reviews').select('*, profiles(full_name), barbers(display_name)').eq('is_visible', true),
        supabase.from('shop_hours').select('*').order('weekday')
      ])

      if (settingsRes.data) setShopSettings(settingsRes.data)
      if (servicesRes.data) setServices(servicesRes.data)
      if (barbersRes.data) setBarbers(barbersRes.data)
      if (reviewsRes.data) setReviews(reviewsRes.data)
      if (hoursRes.data) setShopHours(hoursRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDayName = (weekday) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[weekday]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Announcement Banner */}
      {shopSettings?.announcement_text && (
        <div className="bg-gold-500 text-black text-center py-2 px-4">
          <p className="font-semibold">{shopSettings.announcement_text}</p>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-dark-900 to-dark-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <Scissors className="h-16 w-16 text-gold-500" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            {shopSettings?.shop_name || 'ZIKO TEST VERSION'}
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            {shopSettings?.description || 'Premium barbershop experience with skilled professionals'}
          </p>
          <Link to="/booking" className="btn-primary text-lg px-8 py-3 inline-block">
            Book Now
          </Link>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 bg-dark-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">Our Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <div key={service.id} className="card hover:border-gold-500 transition-colors">
                <h3 className="text-xl font-semibold text-white mb-2">{service.name}</h3>
                <p className="text-gray-400 mb-4">{service.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-gold-500 font-semibold">{service.duration_minutes} min</span>
                  <span className="text-2xl font-bold text-gold-500">
                    {shopSettings?.currency || '$'}{service.price}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Barbers Section */}
      <section className="py-16 bg-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">Our Barbers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {barbers.map((barber) => (
              <div key={barber.id} className="card text-center">
                <div className="w-24 h-24 bg-gold-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Scissors className="h-12 w-12 text-black" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{barber.display_name}</h3>
                <p className="text-gray-400 mb-4">{barber.bio}</p>
                {barber.specialties && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {barber.specialties.map((specialty, idx) => (
                      <span key={idx} className="bg-dark-700 text-gold-500 px-2 py-1 rounded text-sm">
                        {specialty}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      {reviews.length > 0 && (
        <section className="py-16 bg-dark-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-12 text-white">Customer Reviews</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map((review) => (
                <div key={review.id} className="card">
                  <div className="flex items-center mb-2">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={i < review.rating ? 'text-gold-500' : 'text-gray-600'}>★</span>
                    ))}
                  </div>
                  <p className="text-gray-300 mb-4">{review.comment}</p>
                  <div className="text-sm text-gray-400">
                    <p className="font-semibold">{review.profiles?.full_name || 'Customer'}</p>
                    {review.barbers && <p>by {review.barbers.display_name}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Info Section */}
      <section className="py-16 bg-dark-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Opening Hours */}
            <div>
              <h2 className="text-3xl font-bold mb-6 text-white flex items-center">
                <Clock className="h-8 w-8 text-gold-500 mr-3" />
                Opening Hours
              </h2>
              <div className="card">
                {shopHours.map((hours) => (
                  <div key={hours.weekday} className="flex justify-between py-2 border-b border-gray-700 last:border-b-0">
                    <span className="text-gray-300">{getDayName(hours.weekday)}</span>
                    <span className="text-white">
                      {hours.is_open ? `${hours.open_time} - ${hours.close_time}` : 'Closed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <h2 className="text-3xl font-bold mb-6 text-white flex items-center">
                <MapPin className="h-8 w-8 text-gold-500 mr-3" />
                Location & Contact
              </h2>
              <div className="card space-y-4">
                {shopSettings?.address && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 text-gold-500 mt-1" />
                    <div>
                      <p className="text-white">{shopSettings.address}</p>
                      {shopSettings.city && <p className="text-gray-400">{shopSettings.city}</p>}
                    </div>
                  </div>
                )}
                {shopSettings?.phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="h-5 w-5 text-gold-500" />
                    <p className="text-white">{shopSettings.phone}</p>
                  </div>
                )}
                {shopSettings?.instagram && (
                  <div className="flex items-center space-x-3">
                    <Instagram className="h-5 w-5 text-gold-500" />
                    <p className="text-white">{shopSettings.instagram}</p>
                  </div>
                )}
                {shopSettings?.facebook && (
                  <div className="flex items-center space-x-3">
                    <Facebook className="h-5 w-5 text-gold-500" />
                    <p className="text-white">{shopSettings.facebook}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-gold-600 to-gold-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-black mb-4">Ready to Look Your Best?</h2>
          <p className="text-xl text-black mb-8">Book your appointment today</p>
          <Link to="/booking" className="bg-black text-white hover:bg-gray-900 font-semibold py-3 px-8 rounded transition-colors inline-block">
            Book Now
          </Link>
        </div>
      </section>
    </div>
  )
}
