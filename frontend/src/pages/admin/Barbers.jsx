import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'

export default function Barbers() {
  const [barbers, setBarbers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBarbers()
  }, [])

  const fetchBarbers = async () => {
    const { data } = await supabase.from('barbers').select('*').order('sort_order')
    setBarbers(data || [])
    setLoading(false)
  }

  const toggleActive = async (id, current) => {
    const { error } = await supabase.from('barbers').update({ is_active: !current }).eq('id', id)
    if (!error) {
      toast.success('Updated')
      fetchBarbers()
    }
  }

  if (loading) return <div className="text-white">Loading...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Barbers</h1>
        <button className="btn-primary flex items-center">
          <Plus className="h-4 w-4 mr-2" /> Add Barber
        </button>
      </div>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 pb-3">Name</th>
              <th className="text-left text-gray-400 pb-3">Bio</th>
              <th className="text-left text-gray-400 pb-3">Status</th>
              <th className="text-left text-gray-400 pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {barbers.map((barber) => (
              <tr key={barber.id} className="border-b border-gray-700/50">
                <td className="py-3 text-white">{barber.display_name}</td>
                <td className="py-3 text-gray-300 max-w-xs truncate">{barber.bio}</td>
                <td className="py-3">
                  <button onClick={() => toggleActive(barber.id, barber.is_active)} className={`px-2 py-1 rounded text-xs ${barber.is_active ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                    {barber.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="py-3">
                  <button className="text-xs bg-blue-500 text-white px-2 py-1 rounded">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
