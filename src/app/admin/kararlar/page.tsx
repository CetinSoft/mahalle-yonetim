import { auth } from "@/auth"
import { isAdminTC, getUserIlces } from "@/lib/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ClipboardList, CheckCircle, Clock, PlayCircle, Trash2, Calendar, Users } from "lucide-react"
import {
    createKarar,
    getKararlar,
    updateKararDurum,
    deleteKarar,
    getKararStats,
    getNextKararNo
} from "@/app/actions/karar"

export default async function KararlarPage({
    searchParams,
}: {
    searchParams: { durum?: string }
}) {
    const session = await auth()
    const tcNo = session?.user?.image

    const isSuperAdmin = isAdminTC(tcNo)
    const userIlces = await getUserIlces(tcNo)
    const isDistrictAdmin = userIlces.length > 0

    // Sadece admin veya ilçe yöneticisi erişebilir
    const canAccess = isSuperAdmin || isDistrictAdmin

    if (!session?.user || !canAccess) {
        redirect('/')
    }

    // Next.js 16'da searchParams Promise olarak geliyor
    const { durum: durumParam } = await searchParams
    const selectedDurum = durumParam || 'tumu'

    // Kararları ve istatistikleri getir
    const kararlar = await getKararlar(selectedDurum === 'tumu' ? undefined : selectedDurum)
    const stats = await getKararStats()
    const nextKararNo = await getNextKararNo()

    // Bugünün tarihi (hydration hatası önlemek için server'da hesapla)
    const today = new Date().toISOString().split('T')[0]

    // Durum badge renkleri
    const getDurumStyle = (durum: string) => {
        switch (durum) {
            case 'tamamlandi':
                return 'bg-green-100 text-green-800 border-green-200'
            case 'devam_ediyor':
                return 'bg-blue-100 text-blue-800 border-blue-200'
            default:
                return 'bg-yellow-100 text-yellow-800 border-yellow-200'
        }
    }

    const getDurumLabel = (durum: string) => {
        switch (durum) {
            case 'tamamlandi': return 'Tamamlandı'
            case 'devam_ediyor': return 'Devam Ediyor'
            default: return 'Beklemede'
        }
    }

    // Tarih formatlama
    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    }

    // Termin tarihi geçmiş mi?
    const isOverdue = (terminTarihi: Date | string, durum: string) => {
        if (durum === 'tamamlandi') return false
        return new Date(terminTarihi) < new Date()
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
                            Toplantı Kararları
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/dashboard" className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            Dashboard
                        </Link>
                        <Link href="/admin/arama-gorevleri" className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100">
                            Arama Görevleri
                        </Link>
                    </div>
                </div>
            </header>

            <div className="container mx-auto py-8 px-4 space-y-8 max-w-7xl">
                {/* Başlık */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <ClipboardList className="w-8 h-8 text-indigo-600" />
                            Haftalık Toplantı Kararları
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Toplantı kararlarını takip edin ve güncelleyin
                        </p>
                    </div>
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-xl">
                        <span className="text-sm opacity-80">Toplam Karar</span>
                        <p className="font-bold text-lg">{stats.toplam}</p>
                    </div>
                </div>

                {/* İstatistik Kartları */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <ClipboardList className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Toplam Karar</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.toplam}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="bg-yellow-100 p-2 rounded-lg">
                                <Clock className="w-5 h-5 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Beklemede</p>
                                <p className="text-2xl font-bold text-yellow-600">{stats.beklemede}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <PlayCircle className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Devam Ediyor</p>
                                <p className="text-2xl font-bold text-blue-600">{stats.devamEdiyor}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-2 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Tamamlandı</p>
                                <p className="text-2xl font-bold text-green-600">{stats.tamamlandi}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Karar Ekleme Formu - Collapsible */}
                <details className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-white shadow-lg group">
                    <summary className="px-6 py-4 cursor-pointer list-none flex items-center justify-between hover:bg-white/5 rounded-xl transition">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="text-2xl">+</span> Yeni Karar Ekle
                        </h2>
                        <span className="text-white/70 text-sm group-open:hidden">Tıklayarak açın</span>
                        <span className="text-white/70 text-sm hidden group-open:inline">Tıklayarak kapatın</span>
                    </summary>
                    <div className="px-6 pb-6 pt-2">
                        <form action={async (formData) => { 'use server'; await createKarar(formData) }} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 opacity-90">Karar No (Otomatik)</label>
                                    <input
                                        type="text"
                                        name="kararNo"
                                        defaultValue={nextKararNo}
                                        readOnly
                                        className="w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white font-bold focus:outline-none cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 opacity-90">Sorumlu Kişiler</label>
                                    <input
                                        type="text"
                                        name="sorumluKisiler"
                                        required
                                        placeholder="Örn: Ahmet Bey, Mehmet Bey"
                                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 opacity-90">Karar İçeriği</label>
                                <textarea
                                    name="kararIcerik"
                                    required
                                    rows={3}
                                    placeholder="Karar detaylarını yazın..."
                                    className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 resize-none"
                                />
                            </div>
                            <div className="grid md:grid-cols-3 gap-4 items-end">
                                <div>
                                    <label className="block text-sm font-medium mb-1 opacity-90">Başlangıç Tarihi</label>
                                    <input
                                        type="date"
                                        name="baslangicTarihi"
                                        defaultValue={today}
                                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/40 [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 opacity-90">Termin Tarihi</label>
                                    <input
                                        type="date"
                                        name="terminTarihi"
                                        required
                                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/40 [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <button type="submit" className="w-full bg-white text-indigo-600 py-2 rounded-lg font-bold hover:bg-gray-100 transition shadow">
                                        Karar Ekle
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </details>

                {/* Filtre Butonları */}
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/admin/kararlar"
                        className={`px-4 py-2 rounded-lg font-medium transition border ${selectedDurum === 'tumu'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        Tümü ({stats.toplam})
                    </Link>
                    <Link
                        href="/admin/kararlar?durum=beklemede"
                        className={`px-4 py-2 rounded-lg font-medium transition border ${selectedDurum === 'beklemede'
                            ? 'bg-yellow-500 text-white border-yellow-500'
                            : 'bg-white text-yellow-700 border-yellow-300 hover:bg-yellow-50'
                            }`}
                    >
                        <Clock className="w-4 h-4 inline mr-1" />
                        Beklemede ({stats.beklemede})
                    </Link>
                    <Link
                        href="/admin/kararlar?durum=devam_ediyor"
                        className={`px-4 py-2 rounded-lg font-medium transition border ${selectedDurum === 'devam_ediyor'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                            }`}
                    >
                        <PlayCircle className="w-4 h-4 inline mr-1" />
                        Devam Ediyor ({stats.devamEdiyor})
                    </Link>
                    <Link
                        href="/admin/kararlar?durum=tamamlandi"
                        className={`px-4 py-2 rounded-lg font-medium transition border ${selectedDurum === 'tamamlandi'
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-white text-green-700 border-green-300 hover:bg-green-50'
                            }`}
                    >
                        <CheckCircle className="w-4 h-4 inline mr-1" />
                        Tamamlandı ({stats.tamamlandi})
                    </Link>
                </div>

                {/* Karar Listesi */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h2 className="font-semibold text-gray-900">
                            Karar Listesi
                            {selectedDurum !== 'tumu' && <span className="ml-2 text-indigo-600">({getDurumLabel(selectedDurum)})</span>}
                        </h2>
                        <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">{kararlar.length} Karar</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3">Karar No</th>
                                    <th className="px-6 py-3">Karar İçeriği</th>
                                    <th className="px-6 py-3">Sorumlular</th>
                                    <th className="px-6 py-3">Başlangıç</th>
                                    <th className="px-6 py-3">Termin</th>
                                    <th className="px-6 py-3">Durum</th>
                                    <th className="px-6 py-3 text-right">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {kararlar.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                            <p className="font-medium">Henüz karar yok</p>
                                            <p className="text-sm mt-1">Yukarıdan yeni karar ekleyebilirsiniz</p>
                                        </td>
                                    </tr>
                                ) : (
                                    kararlar.map(karar => (
                                        <tr key={karar.id} className={`hover:bg-gray-50/50 ${isOverdue(karar.terminTarihi, karar.durum) ? 'bg-red-50/50' : ''}`}>
                                            <td className="px-6 py-4">
                                                <span className="font-mono font-bold text-indigo-600">{karar.kararNo}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-gray-900 max-w-xs truncate" title={karar.kararIcerik}>
                                                    {karar.kararIcerik}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 text-gray-600">
                                                    <Users className="w-4 h-4" />
                                                    <span className="max-w-[150px] truncate" title={karar.sorumluKisiler}>
                                                        {karar.sorumluKisiler}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1 text-gray-600">
                                                    <Calendar className="w-4 h-4" />
                                                    {formatDate(karar.baslangicTarihi)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={`flex items-center gap-1 ${isOverdue(karar.terminTarihi, karar.durum) ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                                                    <Calendar className="w-4 h-4" />
                                                    {formatDate(karar.terminTarihi)}
                                                    {isOverdue(karar.terminTarihi, karar.durum) && (
                                                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded ml-1">Gecikmiş</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getDurumStyle(karar.durum)}`}>
                                                    {getDurumLabel(karar.durum)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end flex-wrap">
                                                    {karar.durum === 'beklemede' && (
                                                        <form action={async (formData) => { 'use server'; await updateKararDurum(formData) }}>
                                                            <input type="hidden" name="kararId" value={karar.id} />
                                                            <input type="hidden" name="durum" value="devam_ediyor" />
                                                            <button type="submit" className="px-3 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-xs font-medium border border-blue-200">
                                                                Başlat →
                                                            </button>
                                                        </form>
                                                    )}
                                                    {karar.durum === 'devam_ediyor' && (
                                                        <form action={async (formData) => { 'use server'; await updateKararDurum(formData) }}>
                                                            <input type="hidden" name="kararId" value={karar.id} />
                                                            <input type="hidden" name="durum" value="tamamlandi" />
                                                            <button type="submit" className="px-3 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 text-xs font-medium border border-green-200">
                                                                Tamamla ✓
                                                            </button>
                                                        </form>
                                                    )}
                                                    {karar.durum !== 'beklemede' && (
                                                        <form action={async (formData) => { 'use server'; await updateKararDurum(formData) }}>
                                                            <input type="hidden" name="kararId" value={karar.id} />
                                                            <input type="hidden" name="durum" value="beklemede" />
                                                            <button type="submit" className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100 text-xs font-medium border border-yellow-200">
                                                                ↩ Geri Al
                                                            </button>
                                                        </form>
                                                    )}
                                                    <form action={async (formData) => { 'use server'; await deleteKarar(formData) }}>
                                                        <input type="hidden" name="kararId" value={karar.id} />
                                                        <button type="submit" className="px-3 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 text-xs font-medium border border-red-200 flex items-center gap-1">
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </form>
                                                </div>
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
