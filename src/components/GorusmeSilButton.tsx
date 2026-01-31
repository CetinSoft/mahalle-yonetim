'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteGorusme } from '@/app/actions/gorusme'

interface GorusmeSilButtonProps {
    gorusmeId: string
    citizenId: string
    gorusmeTarihi: string
}

export default function GorusmeSilButton({ gorusmeId, citizenId, gorusmeTarihi }: GorusmeSilButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const result = await deleteGorusme(gorusmeId, citizenId)
            if (result.error) {
                alert(result.error)
            }
            setShowConfirm(false)
        } catch (error) {
            alert("Silme işlemi sırasında hata oluştu")
        } finally {
            setIsDeleting(false)
        }
    }

    if (showConfirm) {
        return (
            <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">
                    {gorusmeTarihi} tarihli görüşmeyi silmek istediğinize emin misiniz?
                </span>
                <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                    {isDeleting ? 'Siliniyor...' : 'Evet, Sil'}
                </button>
                <button
                    onClick={() => setShowConfirm(false)}
                    disabled={isDeleting}
                    className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 transition-colors"
                >
                    İptal
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={() => setShowConfirm(true)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="Görüşmeyi Sil"
        >
            <Trash2 size={16} />
        </button>
    )
}
