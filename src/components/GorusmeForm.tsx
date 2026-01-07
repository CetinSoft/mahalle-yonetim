'use client'

import { useState } from 'react'
import { createGorusme } from '@/app/actions/gorusme'
import { useRouter } from 'next/navigation'

interface GorusmeFormProps {
    citizenId: string
    citizenName: string
}

export default function GorusmeForm({ citizenId, citizenName }: GorusmeFormProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const router = useRouter()

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)
        setSuccess(false)

        formData.set('citizenId', citizenId)

        const result = await createGorusme(formData)

        if (result.error) {
            setError(result.error)
            setLoading(false)
        } else {
            setLoading(false)
            setSuccess(true)
            router.refresh()
            // Formu resetle
            setTimeout(() => setSuccess(false), 3000)
        }
    }

    return (
        <div>
            {error && (
                <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg mb-4 text-sm">
                    ✓ Görüşme başarıyla kaydedildi!
                </div>
            )}

            <form action={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Görüşme Tarihi
                        </label>
                        <input
                            type="date"
                            name="gorusmeTarihi"
                            defaultValue={new Date().toISOString().split('T')[0]}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sonuç
                        </label>
                        <div className="flex gap-4 h-[42px] items-center">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="sonuc" value="olumlu" className="text-green-600 w-4 h-4" required />
                                <span className="text-sm text-green-700 font-medium">Olumlu</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="sonuc" value="olumsuz" className="text-red-600 w-4 h-4" />
                                <span className="text-sm text-red-700 font-medium">Olumsuz</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="sonuc" value="belirsiz" className="text-gray-600 w-4 h-4" />
                                <span className="text-sm text-gray-700 font-medium">Belirsiz</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Açıklama / Notlar
                    </label>
                    <textarea
                        name="aciklama"
                        rows={3}
                        placeholder="Görüşme hakkında notlar..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        required
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 font-medium"
                    >
                        {loading ? 'Kaydediliyor...' : 'Görüşme Kaydet'}
                    </button>
                </div>
            </form>
        </div>
    )
}
