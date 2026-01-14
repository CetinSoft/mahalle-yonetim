import { auth } from "@/auth"
import { isAdminTC, getUserIlces } from "@/lib/admin"
import { query } from "@/lib/db"
import { getFaaliyetById, updateFaaliyet, addKatilimci, removeKatilimci } from "@/app/actions/faaliyet"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Calendar, Clock, MapPin, User, Users, Plus, X } from "lucide-react"

export default async function FaaliyetDetailPage({ params }: { params: { id: string } }) {
    const session = await auth()
    const tcNo = session?.user?.image
    const { id } = await params

    const faaliyet = await getFaaliyetById(id)

    if (!faaliyet) {
        notFound()
    }

    const isSuperAdmin = isAdminTC(tcNo)
    const userIlces = await getUserIlces(tcNo)
    const isDistrictAdmin = userIlces.length > 0
    const canEdit = isSuperAdmin || (isDistrictAdmin && userIlces.includes(faaliyet.ilce))

    // Katılımcı eklemek için kişi listesi (faaliyet ilçesindeki VE görevi içinde 'İLÇE' geçen kişiler)
    let availableCitizens: { id: string; ad: string; soyad: string; mahalle: string; gorevi: string }[] = []
    if (canEdit) {
        availableCitizens = await query<{ id: string; ad: string; soyad: string; mahalle: string; gorevi: string }>(
            `SELECT id, ad, soyad, mahalle, gorevi FROM "Citizen" 
             WHERE ilce = $1 AND gorevi ILIKE '%İLÇE%'
             ORDER BY ad, soyad 
             LIMIT 500`,
            [faaliyet.ilce]
        )
    }

    // İlçe listesi (düzenleme için)
    let ilceOptions: string[] = []
    if (isSuperAdmin) {
        const distinctIlces = await query<{ ilce: string }>(
            `SELECT DISTINCT ilce FROM "Citizen" WHERE ilce IS NOT NULL AND ilce != '' ORDER BY ilce ASC`
        )
        ilceOptions = distinctIlces.map(i => i.ilce)
    } else if (isDistrictAdmin) {
        ilceOptions = userIlces
    }

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* MUYET Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-gray-200/60 shadow-sm backdrop-blur-md bg-white/80 supports-[backdrop-filter]:bg-white/60">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard">
                            <img src="/muyet-logo.png" alt="MUYET" className="h-12 w-auto" />
                        </Link>
                        <div className="h-8 w-px bg-gray-200"></div>
                        <span className="font-bold text-lg text-gray-800 tracking-tight">
                            {session?.user?.name || "Kullanıcı"}
                        </span>
                    </div>
                </div>
            </header>

            <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
                <Link href="/takvim" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Takvime Dön
                </Link>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Faaliyet Bilgileri */}
                    <div className="md:col-span-2 space-y-6">
                        {canEdit ? (
                            /* Düzenleme Formu */
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h2 className="text-xl font-bold text-gray-900 mb-4">Faaliyet Düzenle</h2>
                                <form action={async (formData) => {
                                    'use server'
                                    await updateFaaliyet(id, formData)
                                }} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Konu *</label>
                                        <input
                                            type="text"
                                            name="konu"
                                            defaultValue={faaliyet.konu}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">İçerik</label>
                                        <textarea
                                            name="icerik"
                                            defaultValue={faaliyet.icerik || ''}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tarih *</label>
                                            <input
                                                type="date"
                                                name="tarih"
                                                defaultValue={new Date(faaliyet.tarih).toISOString().split('T')[0]}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Saat</label>
                                            <input
                                                type="time"
                                                name="saat"
                                                defaultValue={faaliyet.saat || ''}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Konum</label>
                                            <input
                                                type="text"
                                                name="konum"
                                                defaultValue={faaliyet.konum || ''}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Görevli</label>
                                            <input
                                                type="text"
                                                name="gorevli"
                                                defaultValue={faaliyet.gorevli || ''}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">İlçe *</label>
                                        <select
                                            name="ilce"
                                            defaultValue={faaliyet.ilce}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required
                                        >
                                            {ilceOptions.map(i => (
                                                <option key={i} value={i}>{i}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium">
                                        Güncelle
                                    </button>
                                </form>
                            </div>
                        ) : (
                            /* Salt Okunur Görünüm */
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                <h1 className="text-2xl font-bold text-gray-900 mb-4">{faaliyet.konu}</h1>
                                {faaliyet.icerik && (
                                    <p className="text-gray-600 mb-4">{faaliyet.icerik}</p>
                                )}
                                <div className="grid gap-3">
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Calendar className="h-5 w-5 text-blue-600" />
                                        {new Date(faaliyet.tarih).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </div>
                                    {faaliyet.saat && (
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <Clock className="h-5 w-5 text-blue-600" />
                                            {faaliyet.saat}
                                        </div>
                                    )}
                                    {faaliyet.konum && (
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <MapPin className="h-5 w-5 text-blue-600" />
                                            {faaliyet.konum}
                                        </div>
                                    )}
                                    {faaliyet.gorevli && (
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <User className="h-5 w-5 text-blue-600" />
                                            {faaliyet.gorevli}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 pt-4 border-t">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                        {faaliyet.ilce}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Katılımcılar */}
                    <div className="space-y-4">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Users className="h-5 w-5 text-green-600" />
                                Katılımcılar ({faaliyet.katilimcilar.length})
                            </h3>

                            {/* Katılımcı Ekleme */}
                            {canEdit && availableCitizens.length > 0 && (
                                <form action={async (formData) => {
                                    'use server'
                                    const citizenId = formData.get('citizenId') as string
                                    if (citizenId) {
                                        await addKatilimci(id, citizenId)
                                    }
                                }} className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Katılımcı Ekle (Görevi Olanlar)</label>
                                    <div className="flex gap-2 w-full">
                                        <select
                                            name="citizenId"
                                            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 truncate"
                                        >
                                            <option value="">Kişi seçin...</option>
                                            {availableCitizens
                                                .filter(c => !faaliyet.katilimcilar.some(k => k.citizenId === c.id))
                                                .slice(0, 100)
                                                .map(c => (
                                                    <option key={c.id} value={c.id}>{c.ad} {c.soyad} - {c.gorevi}</option>
                                                ))
                                            }
                                        </select>
                                        <button type="submit" className="flex-shrink-0 bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition">
                                            <Plus className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Sadece görevi olan kişiler listeleniyor (ilk 100)</p>
                                </form>
                            )}

                            {/* Katılımcı Listesi */}
                            {faaliyet.katilimcilar.length === 0 ? (
                                <p className="text-gray-500 text-sm">Henüz katılımcı eklenmemiş.</p>
                            ) : (
                                <div className="space-y-2">
                                    {faaliyet.katilimcilar.map((k) => (
                                        <div key={k.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                            <Link href={`/citizen/${k.citizenId}`} className="font-medium text-gray-900 hover:text-blue-600">
                                                {k.ad} {k.soyad}
                                            </Link>
                                            {canEdit && (
                                                <form action={async () => {
                                                    'use server'
                                                    await removeKatilimci(id, k.citizenId)
                                                }}>
                                                    <button type="submit" className="text-red-500 hover:bg-red-50 p-1 rounded transition">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </form>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
