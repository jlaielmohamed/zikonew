import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Plus, Edit, Trash2 } from 'lucide-react'

export default function Services() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '', duration_minutes: 30, price: 0, category: '', is_active: true })

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('*').order('sort_order')
    setServices(data || [])
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('services').insert([formData])
      if (error) throw error
      toast.success('Service added')
      setShowModal(false)
      fetchServices()
      setFormData({ name: '', description: '', duration_minutes: 30, price: 0, category: '', is_active: true })
    } catch (error) {
      toast.error(error.message)
    }
  }

  const toggleActive = async (id, current) => {
    const { error } = await supabase.from('services').update({ is_active: !current }).eq('id', id)
    if (!error) {
      toast.success('Updated')
      fetchServices()
    }
  }

  if (loading) return <div className="text-white">Loading...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Services</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center">
          <Plus className="h-4 w-4 mr-2" /> Add Service
        </button>
      </div>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 pb-3">Name</th>
              <th className="text-left text-gray-400 pb-3">Duration</th>
              <th className="text-left text-gray-400 pb-3">Price</th>
              <th className="text-left text-gray-400 pb-3">Status</th>
              <th className="text-left text-gray-400 pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} className="border-b border-gray-700/50">
                <td className="py-3 text-white">{service.name}</td>
                <td className="py-3 text-gray-300">{service.duration_minutes} min</td>
                <td className="py-3 text-gold-500">${service.price}</td>
                <td className="py-3">
                  <button onClick={() => toggleActive(service.id, service.is_active)} className={`px-2 py-1 rounded text-xs ${service.is_active ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                    {service.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="py-3">
                  <button className="p-1 text-blue-500 hover:bg-blue-500/10 rounded"><Edit className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="card w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Add Service</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Name" required className="input w-full" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              <textarea placeholder="Description" className="input w-full" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              <input type="number" placeholder="Duration (minutes)" required className="input w-full" value={formData.duration_minutes} onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value)})} />
              <input type="number" step="0.01" placeholder="Price" required className="input w-full" value={formData.price} onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})} />
              <input type="text" placeholder="Category" className="input w-full" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
              <div className="flex space-x-2">
                <button type="submit" className="btn-primary flex-1">Save</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
