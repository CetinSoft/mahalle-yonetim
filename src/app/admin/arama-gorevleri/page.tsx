import { auth } from "@/auth"
import { isAdminTC, getUserIlces } from "@/lib/admin"
import { query, queryOne } from "@/lib/db"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Phone, Users, CheckCircle, Clock, AlertCircle, ArrowRight, Trash2 } from "lucide-react"
import {
    createAramaGorevleri,
    getTumAramaGorevleri,
    updateAramaGoreviDurum,
    getAramaGoreviStats,
    getAccessibleMahalles,
    getCurrentWeek,
    deleteMahalleGorevleri
} from "@/app/actions/arama-gorevi"

export default async function AramaGorevleriPage({
    searchParams,
}: {
    searchParams: { mahalle?: string; hafta?: string }
}) {
    const session = await auth()
    const tcNo = session?.user?.image

    const isSuperAdmin = isAdminTC(tcNo)
    const userIlces = await getUserIlces(tcNo)
    const isDistrictAdmin = userIlces.length > 0

    // Mahalle yetkisi kontrolü (UserMahalle tablosundan)
    let userMahalleYetkisi: string | null = null
    if (tcNo && !isSuperAdmin && !isDistrictAdmin) {
        const assignment = await queryOne<{ mahalle: string }>(
            'SELECT mahalle FROM "UserMahalle" WHERE "tcNo" = $1',
            [tcNo]
        )
        if (assignment) {
            userMahalleYetkisi = assignment.mahalle
        }
    }

    // Mahalle başkanı kontrolü (gorevi alanında "TEMSİLCİLİK MAHALLE BAŞKANI" içeriyorsa)
    let isMahalleBaskani = false
    let mahalleBaskaniMahalle: string | null = null
    if (tcNo && !isSuperAdmin && !isDistrictAdmin && !userMahalleYetkisi) {
        const baskanCheck = await queryOne<{ mahalle: string }>(
            `SELECT mahalle FROM "Citizen" WHERE "tcNo" = $1 AND gorevi ILIKE '%TEMSİLCİLİK MAHALLE BAŞKANI%'`,
            [tcNo]
        )
        if (baskanCheck) {
            isMahalleBaskani = true
            mahalleBaskaniMahalle = baskanCheck.mahalle
        }
    }

    // Kullanıcının erişebileceği mahalle (varsa)
    const userMahalle = userMahalleYetkisi || mahalleBaskaniMahalle
    const isMahalleUser = !!(userMahalleYetkisi || isMahalleBaskani)

    // Admin, ilçe yönetici veya mahalle yetkili/başkanı değilse erişimi engelle
    const canAccess = isSuperAdmin || isDistrictAdmin || isMahalleUser

    // Yetki kontrolü
    if (!session?.user || !canAccess) {
        redirect('/')
    }

    // Görev oluşturma yetkisi (sadece admin ve ilçe yöneticisi)
    const canCreateTasks = isSuperAdmin || isDistrictAdmin

    const currentWeek = await getCurrentWeek()

    // Next.js 16'da searchParams Promise olarak geliyor
    const { mahalle: mahalleParam, hafta: haftaParam } = await searchParams

    const selectedHafta = haftaParam || currentWeek

    // Mahalle kullanıcısı ise sadece kendi mahallesi görünür
    const selectedMahalle = isMahalleUser ? (userMahalle || '') : (mahalleParam || '')

    // Erişilebilir mahalleler (görev oluşturma için)
    let mahalleOptions: string[] = []
    if (isSuperAdmin || isDistrictAdmin) {
        mahalleOptions = await getAccessibleMahalles()
    } else if (userMahalle) {
        mahalleOptions = [userMahalle]
    }

    // Görevleri ve istatistikleri getir - filtreleme için selectedMahalle kullan
    const filterMahalle = selectedMahalle && selectedMahalle.trim() !== '' ? selectedMahalle : undefined
    const gorevler = await getTumAramaGorevleri(selectedHafta, filterMahalle)
    const stats = await getAramaGoreviStats(selectedHafta)

    // Sadece görevi olan mahalleler (filtre için)
    const mahallesWithTasks = stats.map(s => s.mahalle)

    // Mahalle kullanıcısı ise sadece kendi mahallesinin istatistiklerini göster
    const filteredStats = isMahalleUser && userMahalle
        ? stats.filter(s => s.mahalle === userMahalle)
        : stats

    // Toplam istatistikler
    const totalStats = filteredStats.reduce((acc, s) => ({
        toplam: acc.toplam + s.toplam,
        arandi: acc.arandi + s.arandi,
        bekliyor: acc.bekliyor + s.bekliyor
    }), { toplam: 0, arandi: 0, bekliyor: 0 })


    // Durum badge renkleri
    const getDurumStyle = (durum: string) => {
        switch (durum) {
            case 'arandi':
                return 'bg-green-100 text-green-800 border-green-200'
            case 'ulasilamadi':
                return 'bg-red-100 text-red-800 border-red-200'
            default:
                return 'bg-yellow-100 text-yellow-800 border-yellow-200'
        }
    }

    const getDurumLabel = (durum: string) => {
        switch (durum) {
            case 'arandi': return 'Arandı'
            case 'ulasilamadi': return 'Ulaşılamadı'
            default: return 'Bekliyor'
        }
    }

    // Telefon formatla
    const formatPhone = (phone: string | null) => {
        if (!phone) return '-'
        const cleaned = phone.replace(/\D/g, '')
        if (cleaned.startsWith('90') && cleaned.length === 12) {
            return '0' + cleaned.slice(2)
        }
        if (cleaned.length === 10 && !cleaned.startsWith('0')) {
            return '0' + cleaned
        }
        return phone
    }

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-gray-200/60 shadow-sm backdrop-blur-md bg-white/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard">
                            <img src="/muyet-logo.png" alt="MUYET" className="h-12 w-auto" />
                        </Link>
                        <div className="h-8 w-px bg-gray-200"></div>
                        <span className="font-bold text-lg text-gray-800 tracking-tight">
                            Arama Görevleri
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/dashboard" className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            Dashboard
                        </Link>
                        <Link href="/admin/users" className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                            Kullanıcı Yönetimi
                        </Link>
                    </div>
                </div>
            </header>

            <div className="container mx-auto py-8 px-4 space-y-8 max-w-7xl">
                {/* Başlık ve Hafta Bilgisi */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <Phone className="w-8 h-8 text-blue-600" />
                            Haftalık Arama Görevleri
                        </h1>
                        <p className="text-gray-500 mt-1">
                            {isSuperAdmin ? 'Tüm mahallelere' : `${userIlces.join(', ')} ilçesi mahallelerine`} random arama görevi atayın
                        </p>
                    </div>
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl">
                        <span className="text-sm opacity-80">Mevcut Hafta</span>
                        <p className="font-bold text-lg">{currentWeek}</p>
                    </div>
                </div>

                {/* İstatistik Kartları */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Toplam Görev</p>
                                <p className="text-2xl font-bold text-gray-900">{totalStats.toplam}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-2 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Arandı</p>
                                <p className="text-2xl font-bold text-green-600">{totalStats.arandi}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="bg-yellow-100 p-2 rounded-lg">
                                <Clock className="w-5 h-5 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Bekliyor</p>
                                <p className="text-2xl font-bold text-yellow-600">{totalStats.bekliyor}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-100 p-2 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Tamamlanma</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    {totalStats.toplam > 0 ? Math.round((totalStats.arandi / totalStats.toplam) * 100) : 0}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Görev Oluşturma Formu - Sadece Admin ve İlçe Yöneticisi */}
                {canCreateTasks && (
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                        <h2 className="text-xl font-bold mb-4">Yeni Arama Görevi Oluştur</h2>
                        <form action={async (formData) => { 'use server'; await createAramaGorevleri(formData) }} className="grid md:grid-cols-4 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium mb-1 opacity-90">Mahalle</label>
                                <select
                                    name="mahalle"
                                    required
                                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
                                >
                                    <option value="" className="text-gray-900">Mahalle Seçin...</option>
                                    {mahalleOptions.map(m => (
                                        <option key={m} value={m} className="text-gray-900">{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 opacity-90">Random Kişi Sayısı</label>
                                <input
                                    type="number"
                                    name="sayi"
                                    min="1"
                                    max="50"
                                    defaultValue="10"
                                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <button type="submit" className="w-full bg-white text-indigo-600 py-2 rounded-lg font-bold hover:bg-gray-100 transition shadow">
                                    Görev Oluştur
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Filtre - Sadece Admin ve İlçe Yöneticisi İçin */}
                {canCreateTasks && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <form method="GET" className="flex flex-wrap gap-4 items-end">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mahalle Filtrele</label>
                                <select
                                    name="mahalle"
                                    defaultValue={selectedMahalle}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Tüm Mahalleler</option>
                                    {mahallesWithTasks.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                                Filtrele
                            </button>
                            {selectedMahalle && (
                                <Link href="/admin/arama-gorevleri" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">
                                    Temizle
                                </Link>
                            )}
                        </form>
                    </div>
                )}

                {/* Mahalle İstatistikleri */}
                {stats.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                            <h2 className="font-semibold text-gray-900">Mahalle Bazında İstatistikler</h2>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {stats.map(s => (
                                    <div key={s.mahalle} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                        <p className="font-medium text-gray-900 text-sm truncate">{s.mahalle}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-green-600">{s.arandi}/{s.toplam}</span>
                                            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                                <div
                                                    className="bg-green-500 h-1.5 rounded-full"
                                                    style={{ width: `${s.toplam > 0 ? (s.arandi / s.toplam) * 100 : 0}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Görev Listesi */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h2 className="font-semibold text-gray-900">
                            Görev Listesi
                            {selectedMahalle && <span className="ml-2 text-blue-600">({selectedMahalle})</span>}
                        </h2>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">{gorevler.length} Görev</span>
                            {canCreateTasks && selectedMahalle && gorevler.length > 0 && (
                                <form action={async (formData) => { 'use server'; await deleteMahalleGorevleri(formData) }}>
                                    <input type="hidden" name="mahalle" value={selectedMahalle} />
                                    <input type="hidden" name="hafta" value={selectedHafta} />
                                    <button
                                        type="submit"
                                        className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-xs font-medium border border-red-200 flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" /> Tümünü Sil
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3">Kişi</th>
                                    <th className="px-6 py-3">Mahalle</th>
                                    <th className="px-6 py-3">Telefon</th>
                                    <th className="px-6 py-3">Durum</th>
                                    <th className="px-6 py-3 text-right">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {gorevler.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            <Phone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                            <p className="font-medium">Henüz arama görevi yok</p>
                                            <p className="text-sm mt-1">Yukarıdan yeni görev oluşturabilirsiniz</p>
                                        </td>
                                    </tr>
                                ) : (
                                    gorevler.map(gorev => (
                                        <tr key={gorev.id} className="hover:bg-gray-50/50">
                                            <td className="px-6 py-4">
                                                <Link href={`/citizen/${gorev.citizenId}`} className="font-medium text-gray-900 hover:text-blue-600">
                                                    {gorev.citizenAd} {gorev.citizenSoyad}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{gorev.mahalle}</td>
                                            <td className="px-6 py-4">
                                                {gorev.citizenTelefon ? (
                                                    <a href={`tel:${formatPhone(gorev.citizenTelefon)}`} className="text-blue-600 hover:underline font-mono">
                                                        {formatPhone(gorev.citizenTelefon)}
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getDurumStyle(gorev.durum)}`}>
                                                    {getDurumLabel(gorev.durum)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {gorev.durum === 'bekliyor' ? (
                                                    <div className="flex gap-2 justify-end">
                                                        <form action={async (formData) => { 'use server'; await updateAramaGoreviDurum(formData) }}>
                                                            <input type="hidden" name="gorevId" value={gorev.id} />
                                                            <input type="hidden" name="durum" value="arandi" />
                                                            <button type="submit" className="px-3 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 text-xs font-medium border border-green-200">
                                                                Arandı ✓
                                                            </button>
                                                        </form>
                                                        <form action={async (formData) => { 'use server'; await updateAramaGoreviDurum(formData) }}>
                                                            <input type="hidden" name="gorevId" value={gorev.id} />
                                                            <input type="hidden" name="durum" value="ulasilamadi" />
                                                            <button type="submit" className="px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 text-xs font-medium border border-red-200">
                                                                Ulaşılamadı
                                                            </button>
                                                        </form>
                                                        <Link
                                                            href={`/citizen/${gorev.citizenId}`}
                                                            className="px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-xs font-medium border border-blue-200 flex items-center gap-1"
                                                        >
                                                            Detay <ArrowRight className="w-3 h-3" />
                                                        </Link>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2 justify-end">
                                                        <form action={async (formData) => { 'use server'; await updateAramaGoreviDurum(formData) }}>
                                                            <input type="hidden" name="gorevId" value={gorev.id} />
                                                            <input type="hidden" name="durum" value="bekliyor" />
                                                            <button type="submit" className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100 text-xs font-medium border border-yellow-200">
                                                                ↩ İptal
                                                            </button>
                                                        </form>
                                                        <Link
                                                            href={`/citizen/${gorev.citizenId}`}
                                                            className="text-blue-600 hover:underline text-xs font-medium"
                                                        >
                                                            Görüntüle →
                                                        </Link>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
