import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Edit } from 'lucide-react'
import { useLanguage } from '../../i18n/LanguageContext'

const emptyForm = {
  display_name: '',
  bio: '',
  specialties: '',
  phone: '',
  email: '',
  password: '',
  is_active: true,
  sort_order: 0,
}

export default function Barbers() {
  const { t } = useLanguage()
  const [barbers, setBarbers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchBarbers()
  }, [])

  const fetchBarbers = async () => {
    const { data } = await supabase.from('barbers').select('*').order('sort_order')
    setBarbers(data || [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (barber) => {
    setEditing(barber)
    setForm({
      display_name: barber.display_name || '',
      bio: barber.bio || '',
      specialties: (barber.specialties || []).join(', '),
      phone: '',
      email: '',
      password: '',
      is_active: barber.is_active,
      sort_order: barber.sort_order || 0,
    })
    setShowModal(true)
  }

  const toggleActive = async (id, current) => {
    const { error } = await supabase.from('barbers').update({ is_active: !current }).eq('id', id)
    if (!error) {
      toast.success(t('a.updated'))
      fetchBarbers()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const payload = {
        display_name: form.display_name.trim(),
        bio: form.bio.trim() || null,
        specialties: form.specialties
          ? form.specialties.split(',').map((s) => s.trim()).filter(Boolean)
          : null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      }

      let barberId = editing?.id
      if (barberId) {
        const { error } = await supabase.from('barbers').update(payload).eq('id', barberId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('barbers')
          .insert([payload])
          .select()
          .single()
        if (error) throw error
        barberId = data.id
      }

      // Create the login (or reset credentials) through the admin-only function.
      if (form.email.trim() || form.password || form.phone.trim()) {
        const { error: functionError } = await supabase.functions.invoke('create-barber-account', {
          body: {
            barber_id: barberId,
            email: form.email.trim() || undefined,
            password: form.password || undefined,
            full_name: payload.display_name,
            phone: form.phone.trim() || undefined,
          },
        })

        if (functionError) {
          // Do not leave an unusable barber behind when adding a new one.
          if (!editing) {
            await supabase.from('barbers').delete().eq('id', barberId)
          }
          console.error(functionError)
          toast.error(t('a.br.createError'))
          return
        }
      }

      toast.success(editing ? t('a.br.updated') : t('a.br.added'))
      setShowModal(false)
      fetchBarbers()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-white">{t('a.loading')}</div>

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{t('a.menu.barbers')}</h1>
        <button onClick={openAdd} className="btn-primary flex items-center whitespace-nowrap">
          <Plus className="h-4 w-4 mr-2" /> {t('a.br.add')}
        </button>
      </div>

      <div className="card hidden sm:block overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 pb-3">{t('a.name')}</th>
              <th className="text-left text-gray-400 pb-3">{t('a.br.bio')}</th>
              <th className="text-left text-gray-400 pb-3">{t('a.status')}</th>
              <th className="text-left text-gray-400 pb-3">{t('a.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {barbers.map((barber) => (
              <tr key={barber.id} className="border-b border-gray-700/50">
                <td className="py-3">
                  <div className="text-white">{barber.display_name}</div>
                  {barber.profile_id && (
                    <span className="text-xs text-green-500">{t('a.br.linked')}</span>
                  )}
                </td>
                <td className="py-3 text-gray-300 max-w-xs truncate">{barber.bio}</td>
                <td className="py-3">
                  <button onClick={() => toggleActive(barber.id, barber.is_active)} className={`px-2 py-1 rounded text-xs ${barber.is_active ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                    {barber.is_active ? t('a.active') : t('a.inactive')}
                  </button>
                </td>
                <td className="py-3">
                  <button
                    onClick={() => openEdit(barber)}
                    className="text-xs bg-blue-500 text-white px-2 py-1 rounded flex items-center"
                  >
                    <Edit className="h-3 w-3 mr-1" /> {t('a.edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards for phones */}
      <div className="sm:hidden space-y-3">
        {barbers.map((barber) => (
          <div key={barber.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white font-semibold break-words">{barber.display_name}</p>
                {barber.profile_id && (
                  <span className="text-xs text-green-500">{t('a.br.linked')}</span>
                )}
                {barber.bio && <p className="text-gray-400 text-sm mt-1 break-words">{barber.bio}</p>}
              </div>
              <button
                onClick={() => toggleActive(barber.id, barber.is_active)}
                className={`px-2 py-1 rounded text-xs flex-shrink-0 ${barber.is_active ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}
              >
                {barber.is_active ? t('a.active') : t('a.inactive')}
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700">
              <button
                onClick={() => openEdit(barber)}
                className="text-xs bg-blue-500 text-white px-2 py-1 rounded flex items-center"
              >
                <Edit className="h-3 w-3 mr-1" /> {t('a.edit')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4">
              {editing ? t('a.edit') : t('a.br.add')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('a.name')}</label>
                <input
                  type="text"
                  required
                  className="input w-full"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('a.br.bio')}</label>
                <textarea
                  className="input w-full"
                  rows="2"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('a.br.specialties')}</label>
                <input
                  type="text"
                  className="input w-full"
                  value={form.specialties}
                  onChange={(e) => setForm({ ...form, specialties: e.target.value })}
                />
              </div>

              <div className="border-t border-gray-700 pt-4">
                <p className="text-sm text-gold-500 font-semibold mb-3">{t('a.br.account')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t('a.br.email')}</label>
                    <input
                      type="email"
                      required={!editing?.profile_id}
                      className="input w-full"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t('a.br.password')}</label>
                    <input
                      type="password"
                      required={!editing?.profile_id}
                      minLength={6}
                      className="input w-full"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                    {editing?.profile_id && (
                      <p className="text-xs text-gray-500 mt-1">{t('a.br.passwordHint')}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t('a.phone')}</label>
                    <input
                      type="tel"
                      className="input w-full"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
                  {saving ? t('a.wt.saving') : t('a.save')}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  {t('a.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
