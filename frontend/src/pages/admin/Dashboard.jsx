import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart3, Calendar, Scissors, Users, Clock, Settings,
  Star, FileText, Plus, Bell
} from 'lucide-react'
import Overview from './Overview'
import Appointments from './Appointments'
import Services from './Services'
import Barbers from './Barbers'
import WorkingTime from './WorkingTime'
import Customers from './Customers'
import ShopSettings from './ShopSettings'
import Reviews from './Reviews'
import Reports from './Reports'
import { useLanguage } from '../../i18n/LanguageContext'

const menuItems = [
  { path: '/admin', labelKey: 'a.menu.overview', icon: BarChart3 },
  { path: '/admin/appointments', labelKey: 'a.menu.appointments', icon: Calendar },
  { path: '/admin/services', labelKey: 'a.menu.services', icon: Scissors },
  { path: '/admin/barbers', labelKey: 'a.menu.barbers', icon: Users },
  { path: '/admin/working-time', labelKey: 'a.menu.workingTime', icon: Clock },
  { path: '/admin/customers', labelKey: 'a.menu.customers', icon: Users },
  { path: '/admin/settings', labelKey: 'a.menu.settings', icon: Settings },
  { path: '/admin/reviews', labelKey: 'a.menu.reviews', icon: Star },
  { path: '/admin/reports', labelKey: 'a.menu.reports', icon: FileText },
]

export default function AdminDashboard() {
  const location = useLocation()
  const { t } = useLanguage()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    fetchPendingCount()

    // Subscribe to realtime bookings
    const subscription = supabase
      .channel('admin-bookings')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchPendingCount()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    setPendingCount(count || 0)
  }

  return (
    <div className="min-h-screen bg-dark-900">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-dark-800 min-h-screen border-r border-gray-700">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-gold-500">{t('nav.adminDashboard')}</h2>
          </div>
          <nav className="mt-4">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-3 text-gray-300 hover:bg-dark-700 hover:text-white ${
                    isActive ? 'bg-dark-700 text-gold-500 border-r-2 border-gold-500' : ''
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  <span>{t(item.labelKey)}</span>
                  {item.path === '/admin/appointments' && pendingCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1 flex items-center">
                      <Bell className="h-3 w-3 mr-1" />
                      {pendingCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="services" element={<Services />} />
            <Route path="barbers" element={<Barbers />} />
            <Route path="working-time" element={<WorkingTime />} />
            <Route path="customers" element={<Customers />} />
            <Route path="settings" element={<ShopSettings />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="reports" element={<Reports />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
