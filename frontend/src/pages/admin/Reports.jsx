import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { FileText, Download } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

export default function Reports() {
  const { t, formatPrice } = useLanguage()
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

  if (loading) return <div className="text-white">{t('a.loading')}</div>

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6 flex items-center">
        <FileText className="h-8 w-8 text-gold-500 mr-3" />
        {t('a.menu.reports')}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">{t('a.rp.revenue')}</h2>
          <p className="text-3xl font-bold text-gold-500">{formatPrice(stats?.revenue || 0)}</p>
          <p className="text-gray-400">{t('a.rp.last30')}</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">{t('a.ov.topServices')}</h2>
          <div className="space-y-2">
            {stats?.top_services?.map((service, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="text-white">{service.name}</span>
                <span className="text-gold-500">{service.count} {t('a.bookings')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
