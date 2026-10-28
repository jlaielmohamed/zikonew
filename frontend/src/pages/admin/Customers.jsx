import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Users } from 'lucide-react'

export default function Customers() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'customer').order('created_at', { ascending: false })
    setProfiles(data || [])
    setLoading(false)
  }

  if (loading) return <div className="text-white">Loading...</div>

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6 flex items-center">
        <Users className="h-8 w-8 text-gold-500 mr-3" />
        Customers
      </h1>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 pb-3">Name</th>
              <th className="text-left text-gray-400 pb-3">Phone</th>
              <th className="text-left text-gray-400 pb-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-b border-gray-700/50">
                <td className="py-3 text-white">{profile.full_name || 'N/A'}</td>
                <td className="py-3 text-gray-300">{profile.phone || 'N/A'}</td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded text-xs ${profile.is_blocked ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                    {profile.is_blocked ? 'Blocked' : 'Active'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
