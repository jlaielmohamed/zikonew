import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Clock } from 'lucide-react'

export default function WorkingTime() {
  const [shopHours, setShopHours] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data } = await supabase.from('shop_hours').select('*').order('weekday')
    setShopHours(data || [])
    setLoading(false)
  }

  const getDayName = (weekday) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[weekday]
  }

  if (loading) return <div className="text-white">Loading...</div>

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6 flex items-center">
        <Clock className="h-8 w-8 text-gold-500 mr-3" />
        Working Time
      </h1>

      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Shop Hours</h2>
        <div className="space-y-2">
          {shopHours.map((hours) => (
            <div key={hours.weekday} className="flex justify-between items-center p-3 bg-dark-700 rounded">
              <span className="text-white">{getDayName(hours.weekday)}</span>
              <span className="text-gray-300">
                {hours.is_open ? `${hours.open_time} - ${hours.close_time}` : 'Closed'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
