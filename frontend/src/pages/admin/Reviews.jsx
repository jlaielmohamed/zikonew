import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLanguage } from '../../i18n/LanguageContext'

export default function Reviews() {
  const { t } = useLanguage()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReviews()
  }, [])

  const fetchReviews = async () => {
    const { data } = await supabase.from('reviews').select('*, profiles(full_name), barbers(display_name)').order('created_at', { ascending: false })
    setReviews(data || [])
    setLoading(false)
  }

  const toggleVisibility = async (id, current) => {
    const { error } = await supabase.from('reviews').update({ is_visible: !current }).eq('id', id)
    if (!error) {
      toast.success(t('a.updated'))
      fetchReviews()
    }
  }

  if (loading) return <div className="text-white">{t('a.loading')}</div>

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6 flex items-center">
        <Star className="h-8 w-8 text-gold-500 mr-3" />
        {t('a.menu.reviews')}
      </h1>

      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="card">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'text-gold-500 fill-gold-500' : 'text-gray-600'}`} />
                  ))}
                </div>
                <p className="text-white mb-2">{review.comment}</p>
                <p className="text-gray-400 text-sm">
                  {review.profiles?.full_name} {review.barbers && `- ${review.barbers.display_name}`}
                </p>
              </div>
              <button onClick={() => toggleVisibility(review.id, review.is_visible)} className={`px-2 py-1 rounded text-xs ${review.is_visible ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                {review.is_visible ? t('a.rv.visible') : t('a.rv.hidden')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
