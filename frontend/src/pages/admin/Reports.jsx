import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { FileText, Download } from 'lucide-react'

export default function Reports() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const { data } = await supabase.rpc('admin_stats')
    setStats(data)
    setLoading(false)
  }

  if (loading) return <div className="text-white">Loading...</div>

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6 flex items-center">
        <FileText className="h-8 w-8 text-gold-500 mr-3" />
        Reports
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Revenue</h2>
          <p className="text-3xl font-bold text-gold-500">${stats?.revenue || 0}</p>
          <p className="text-gray-400">Last 30 days</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Top Services</h2>
          <div className="space-y-2">
            {stats?.top_services?.map((service, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="text-white">{service.name}</span>
                <span className="text-gold-500">{service.count} bookings</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
