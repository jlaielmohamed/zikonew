import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  BarChart3, Calendar, Scissors, Users, Clock, Settings,
  FileText, Menu, X, Bell, User
} from 'lucide-react'
import Overview from './Overview'
import Appointments from './Appointments'
import Services from './Services'
import Barbers from './Barbers'
import WorkingTime from './WorkingTime'
import ShopSettings from './ShopSettings'
import Reports from './Reports'
import Account from './Account'
import { useLanguage } from '../../i18n/LanguageContext'

const menuItems = [
  { path: '/admin', labelKey: 'a.menu.overview', icon: BarChart3 },
  { path: '/admin/appointments', labelKey: 'a.menu.appointments', icon: Calendar },
  { path: '/admin/services', labelKey: 'a.menu.services', icon: Scissors },
  { path: '/admin/barbers', labelKey: 'a.menu.barbers', icon: Users },
  { path: '/admin/working-time', labelKey: 'a.menu.workingTime', icon: Clock },
  { path: '/admin/settings', labelKey: 'a.menu.settings', icon: Settings },
  { path: '/admin/reports', labelKey: 'a.menu.reports', icon: FileText },
  { path: '/admin/account', labelKey: 'a.menu.account', icon: User },
]

export default function AdminDashboard() {
  const location = useLocation()
  const { t } = useLanguage()
  const [pendingCount, setPendingCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  // Close the mobile drawer whenever the admin navigates to another section.
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Allow closing the drawer with Escape.
  useEffect(() => {
    if (!sidebarOpen) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen])

  const fetchPendingCount = async () => {
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
    setPendingCount(count || 0)
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <Link to="/admin" className="text-xl font-bold text-gold-500">
          {t('nav.adminDashboard')}
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1 text-gray-300 hover:text-white"
          aria-label={t('a.closeMenu')}
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      <nav className="mt-4 flex-1 overflow-y-auto pb-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center px-4 py-3 text-sm lg:text-base text-gray-300 hover:bg-dark-700 hover:text-white transition-colors ${
                isActive ? 'bg-dark-700 text-gold-500 border-l-2 lg:border-r-2 lg:border-l-0 border-gold-500' : ''
              }`}
            >
              <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
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
  )

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Mobile top bar with menu button */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-700 bg-dark-800 px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-gold-500 hover:bg-dark-700 rounded"
          aria-label={t('a.openMenu')}
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="text-lg font-bold text-white truncate">{t('nav.adminDashboard')}</span>
        <Link
          to="/admin/account"
          className="p-2 text-gold-500 hover:bg-dark-700 rounded flex-shrink-0"
          aria-label={t('a.menu.account')}
          title={t('a.menu.account')}
        >
          <User className="h-6 w-6" />
        </Link>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-0 h-screen bg-dark-800 border-r border-gray-700 overflow-y-auto">
            {sidebarContent}
          </div>
        </aside>

        {/* Mobile drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label={t('a.closeMenu')}
              className="absolute inset-0 bg-black/60 w-full h-full"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="relative h-full w-72 max-w-[85vw] bg-dark-800 border-r border-gray-700 shadow-2xl overflow-y-auto">
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="services" element={<Services />} />
            <Route path="barbers" element={<Barbers />} />
            <Route path="working-time" element={<WorkingTime />} />
            <Route path="settings" element={<ShopSettings />} />
            <Route path="reports" element={<Reports />} />
            <Route path="account" element={<Account />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
