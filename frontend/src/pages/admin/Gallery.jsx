import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Image, Plus } from 'lucide-react'

export default function Gallery() {
  const [gallery, setGallery] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGallery()
  }, [])

  const fetchGallery = async () => {
    const { data } = await supabase.from('gallery').select('*').order('sort_order')
    setGallery(data || [])
    setLoading(false)
  }

  if (loading) return <div className="text-white">Loading...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center">
          <Image className="h-8 w-8 text-gold-500 mr-3" />
          Gallery
        </h1>
        <button className="btn-primary flex items-center">
          <Plus className="h-4 w-4 mr-2" /> Add Photo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {gallery.map((item) => (
          <div key={item.id} className="card p-2">
            <img src={item.image_url} alt={item.caption} className="w-full h-48 object-cover rounded" />
            {item.caption && <p className="text-gray-300 text-sm mt-2">{item.caption}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
