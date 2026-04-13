'use client'

import { useState, useEffect } from 'react'
import { getFilteredMembers, sendBulkSMS, SMSMember, SMSResult } from '@/app/actions/sms'
import { formatPhoneNumber } from '@/lib/utils'

interface SMSInterfaceProps {
    isSuperAdmin: boolean
}

export default function SMSInterface({ isSuperAdmin }: SMSInterfaceProps) {
    const [members, setMembers] = useState<SMSMember[]>([])
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState('')
    const [showPreview, setShowPreview] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [results, setResults] = useState<SMSResult[]>([])
    const [showResults, setShowResults] = useState(false)

    // Filters
    const [mahalle, setMahalle] = useState('')
    const [cinsiyet, setCinsiyet] = useState('E')
    const [yargitay, setYargitay] = useState('')
    const [gorevi, setGorevi] = useState('')
    const [arama, setArama] = useState('')

    // Load members
    const loadMembers = async () => {
        setLoading(true)
        setError('')
        const { members: loadedMembers, error: loadError } = await getFilteredMembers({
            mahalle: mahalle || undefined,
            cinsiyet: cinsiyet === 'all' ? undefined : cinsiyet,
            yargitay: yargitay || undefined,
            gorevi: gorevi || undefined,
            arama: arama || undefined,
        })

        if (loadError) {
            setError(loadError)
        } else {
            setMembers(loadedMembers)
        }
        setLoading(false)
    }

    // Load members on mount and filter change
    useEffect(() => {
        loadMembers()
    }, [mahalle, cinsiyet, yargitay, gorevi])

    // Handle select all
    const handleSelectAll = () => {
        if (selectedMemberIds.size === members.length) {
            setSelectedMemberIds(new Set())
        } else {
            setSelectedMemberIds(new Set(members.map(m => m.id)))
        }
    }

    // Handle individual selection
    const handleSelectMember = (memberId: string) => {
        const newSelection = new Set(selectedMemberIds)
        if (newSelection.has(memberId)) {
            newSelection.delete(memberId)
        } else {
            newSelection.add(memberId)
        }
        setSelectedMemberIds(newSelection)
    }

    // Handle send SMS
    const handleSendSMS = async () => {
        if (selectedMemberIds.size === 0) {
            setError('Lütfen en az bir üye seçin')
            return
        }

        if (!message.trim()) {
            setError('Lütfen mesaj yazın')
            return
        }

        setSending(true)
        setError('')
        setShowConfirm(false)

        const { results: smsResults, error: sendError } = await sendBulkSMS(
            Array.from(selectedMemberIds),
            message
        )

        if (sendError) {
            setError(sendError)
        } else {
            setResults(smsResults)
            setShowResults(true)
            // Clear selection and message after successful send
            setSelectedMemberIds(new Set())
            setMessage('')
        }

        setSending(false)
    }

    // Get selected members for preview
    const getSelectedMembers = () => {
        return members.filter(m => selectedMemberIds.has(m.id))
    }

    // Personalize message for preview
    const personalizeMessage = (msg: string, member: SMSMember) => {
        return msg.replace(/{AD}/g, member.ad).replace(/{SOYAD}/g, member.soyad)
    }

    // Character count
    const charCount = message.length
    const maxChars = 500

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtreler</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Cinsiyet */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cinsiyet</label>
                        <select
                            value={cinsiyet}
                            onChange={(e) => setCinsiyet(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="E">Erkek (E)</option>
                            <option value="K">Kadın (K)</option>
                            <option value="all">Tümü</option>
                        </select>
                    </div>

                    {/* Görevi */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Görevi</label>
                        <select
                            value={gorevi}
                            onChange={(e) => setGorevi(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Tümü</option>
                            <option value="var">Görevi Var</option>
                            <option value="yok">Görevi Yok</option>
                            <option value="basmusahit">Başmüşahit</option>
                        </select>
                    </div>

                    {/* Arama */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Arama</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={arama}
                                onChange={(e) => setArama(e.target.value)}
                                placeholder="İsim, TC, Meslek, Görevi..."
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={loadMembers}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                Ara
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                    {error}
                </div>
            )}

            {/* Member Selection */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Üye Seçimi
                        <span className="ml-3 text-sm font-normal text-gray-500">
                            ({members.length} üye, {selectedMemberIds.size} seçili)
                        </span>
                    </h2>
                    {members.length > 0 && (
                        <button
                            onClick={handleSelectAll}
                            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                        >
                            {selectedMemberIds.size === members.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">
                        Yükleniyor...
                    </div>
                ) : members.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        Telefon numarası olan üye bulunamadı.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedMemberIds.size === members.length}
                                            onChange={handleSelectAll}
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left">Ad Soyad</th>
                                    <th className="px-6 py-3 text-left">Telefon</th>
                                    <th className="px-6 py-3 text-left">Mahalle</th>
                                    <th className="px-6 py-3 text-left">Yargıtay Durumu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {members.map((member) => (
                                    <tr
                                        key={member.id}
                                        className={`hover:bg-gray-50 transition-colors ${selectedMemberIds.has(member.id) ? 'bg-blue-50' : ''}`}
                                    >
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedMemberIds.has(member.id)}
                                                onChange={() => handleSelectMember(member.id)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {member.ad} {member.soyad}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {member.telefon ? formatPhoneNumber(member.telefon) : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                                {member.mahalle}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {member.yargitayDurumu || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Message Composition */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Mesaj Oluştur</h2>

                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">Mesaj İçeriği</label>
                            <span className={`text-sm ${charCount > maxChars ? 'text-red-600' : 'text-gray-500'}`}>
                                {charCount} / {maxChars} karakter
                            </span>
                        </div>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Mesajınızı yazın... (Kişiselleştirmek için {AD} ve {SOYAD} kullanabilirsiniz)"
                            rows={6}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Kişiselleştirme İpuçları</h3>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>• <code className="bg-blue-100 px-1 rounded">{'{AD}'}</code> - Üyenin adı ile değiştirilir</li>
                            <li>• <code className="bg-blue-100 px-1 rounded">{'{SOYAD}'}</code> - Üyenin soyadı ile değiştirilir</li>
                            <li>• Örnek: "Sayın {'{AD}'} {'{SOYAD}'}, toplantımıza davetlisiniz."</li>
                        </ul>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowPreview(true)}
                            disabled={selectedMemberIds.size === 0 || !message.trim()}
                            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            👁️ Önizleme
                        </button>
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={selectedMemberIds.size === 0 || !message.trim() || sending}
                            className="flex-1 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sending ? '📤 Gönderiliyor...' : `📱 SMS Gönder (${selectedMemberIds.size} kişi)`}
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-xl font-bold text-gray-900">Mesaj Önizleme</h3>
                            <p className="text-sm text-gray-500 mt-1">İlk 5 üye için kişiselleştirilmiş mesajlar</p>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-96 space-y-4">
                            {getSelectedMembers().slice(0, 5).map((member) => (
                                <div key={member.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="font-semibold text-gray-900 mb-2">
                                        {member.ad} {member.soyad} ({formatPhoneNumber(member.telefon || '')})
                                    </div>
                                    <div className="text-gray-700 whitespace-pre-wrap">
                                        {personalizeMessage(message, member)}
                                    </div>
                                </div>
                            ))}
                            {selectedMemberIds.size > 5 && (
                                <div className="text-center text-gray-500 text-sm">
                                    ... ve {selectedMemberIds.size - 5} kişi daha
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-200 flex justify-end">
                            <button
                                onClick={() => setShowPreview(false)}
                                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-xl font-bold text-gray-900">SMS Gönderimini Onayla</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-700 mb-4">
                                <strong>{selectedMemberIds.size} kişiye</strong> SMS göndermek üzeresiniz. Devam etmek istiyor musunuz?
                            </p>
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="text-sm text-gray-600 mb-2">Mesaj Önizleme:</div>
                                <div className="text-gray-900 whitespace-pre-wrap">
                                    {message}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSendSMS}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                            >
                                Gönder
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Modal */}
            {showResults && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-xl font-bold text-gray-900">Gönderim Sonuçları</h3>
                            <div className="flex gap-4 mt-2">
                                <span className="text-sm text-green-600 font-semibold">
                                    ✓ Başarılı: {results.filter(r => r.success).length}
                                </span>
                                <span className="text-sm text-red-600 font-semibold">
                                    ✗ Başarısız: {results.filter(r => !r.success).length}
                                </span>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-96">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Durum</th>
                                        <th className="px-4 py-3 text-left">Ad Soyad</th>
                                        <th className="px-4 py-3 text-left">Telefon</th>
                                        <th className="px-4 py-3 text-left">Hata</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {results.map((result, idx) => (
                                        <tr key={idx} className={result.success ? 'bg-green-50' : 'bg-red-50'}>
                                            <td className="px-4 py-3">
                                                {result.success ? (
                                                    <span className="text-green-600 font-semibold">✓</span>
                                                ) : (
                                                    <span className="text-red-600 font-semibold">✗</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-900">{result.memberName}</td>
                                            <td className="px-4 py-3 text-gray-600">{result.phone}</td>
                                            <td className="px-4 py-3 text-red-600 text-xs">{result.error || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 border-t border-gray-200 flex justify-end">
                            <button
                                onClick={() => setShowResults(false)}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
