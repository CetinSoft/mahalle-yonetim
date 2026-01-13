import { auth, signOut } from "@/auth"
import { query, queryOne, Gorusme, Citizen } from "@/lib/db"
import { isAdminTC, getUserIlces } from "@/lib/admin"
import Link from "next/link"
import { Calendar, Phone, MapPin, Search, ArrowUpDown, Filter, X, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"


interface GorusmeWithCitizen extends Gorusme {
    citizenAd: string
    citizenSoyad: string
    citizenMahalle: string
    citizenYargitayDurumu: string | null
}

export default async function GorusmelerPage({
    searchParams,
}: {
    searchParams: { mahalle?: string; sonuc?: string; arama?: string }
}) {
    const session = await auth()
    const tcNo = session?.user?.image
    const isAdmin = isAdminTC(tcNo)

    // Kullanıcının yetkili olduğu mahalleyi bul
    let userMahalle = session?.user?.email
    const userName = session?.user?.name || userMahalle

    if (tcNo && !isAdmin) {
        const assignment = await queryOne<{ mahalle: string }>(
            'SELECT mahalle FROM "UserMahalle" WHERE "tcNo" = $1',
            [tcNo]
        )
        if (assignment) {
            userMahalle = assignment.mahalle
        }
    }

    if (!userMahalle && !isAdmin) {
        return <div>Yetkiniz yok.</div>
    }

    const { mahalle, sonuc, arama } = await searchParams

    // Build query
    let whereClause = ''
    const params: any[] = []
    let paramIndex = 1

    // Admin mahalle seçebilir, normal kullanıcı sadece kendi yaptığı görüşmeleri görür
    const selectedMahalle = isAdmin ? mahalle : undefined

    // Normal kullanıcılar sadece kendi yaptıkları görüşmeleri görür
    if (!isAdmin) {
        whereClause = `WHERE g."gorusmeYapan" = $${paramIndex} `
        params.push(userName)
        paramIndex++
    } else if (selectedMahalle) {
        whereClause = `WHERE c."mahalle" = $${paramIndex} `
        params.push(selectedMahalle)
        paramIndex++
    }

    if (sonuc && sonuc !== 'all') {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` g.sonuc = $${paramIndex} `
        params.push(sonuc)
        paramIndex++
    }

    if (arama && arama.trim()) {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` (c."ad" ILIKE $${paramIndex} OR c."soyad" ILIKE $${paramIndex} OR g."gorusmeYapan" ILIKE $${paramIndex} OR g."aciklama" ILIKE $${paramIndex})`
        params.push(`% ${arama.trim()}% `)
        paramIndex++
    }

    const gorusmeler = await query<GorusmeWithCitizen>(
        `SELECT g.*, c.ad as "citizenAd", c.soyad as "citizenSoyad", c.mahalle as "citizenMahalle", c."yargitayDurumu" as "citizenYargitayDurumu"
         FROM "Gorusme" g
         JOIN "Citizen" c ON c.id = g."citizenId"
         ${whereClause}
         ORDER BY g."gorusmeTarihi" DESC
         LIMIT 200`,
        params
    )

    // Mahalle listesi (admin için)
    let mahalleOptions: string[] = []
    if (isAdmin) {
        const distinctMahalles = await query<{ mahalle: string }>(
            `SELECT DISTINCT c.mahalle FROM "Gorusme" g 
             JOIN "Citizen" c ON c.id = g."citizenId"
             WHERE c.mahalle IS NOT NULL AND c.mahalle != ''
             ORDER BY c.mahalle ASC`
        )
        mahalleOptions = distinctMahalles.map(m => m.mahalle)
    }

    // Sonuç badge renkleri
    const getSonucStyle = (s: string) => {
        switch (s) {
            case 'olumlu': return 'bg-green-50 text-green-700 border-green-200'
            case 'olumsuz': return 'bg-red-50 text-red-700 border-red-200'
            default: return 'bg-gray-50 text-gray-700 border-gray-200'
        }
    }

    const getSonucLabel = (s: string) => {
        switch (s) {
            case 'olumlu': return 'Olumlu'
            case 'olumsuz': return 'Olumsuz'
            default: return 'Belirsiz'
        }
    }

    // URL builder
    const buildUrl = (overrides: Record<string, string | undefined>) => {
        const current = { mahalle: selectedMahalle, sonuc, arama }
        const merged = { ...current, ...overrides }
        const parts: string[] = []
        if (merged.mahalle && isAdmin) parts.push(`mahalle = ${merged.mahalle} `)
        if (merged.sonuc) parts.push(`sonuc = ${merged.sonuc} `)
        if (merged.arama) parts.push(`arama = ${encodeURIComponent(merged.arama)} `)
        return `/ gorusmeler${parts.length ? '?' + parts.join('&') : ''} `
    }

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* MUYET Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-gray-200/60 shadow-sm backdrop-blur-md bg-white/80 supports-[backdrop-filter]:bg-white/60">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard">
                            <img
                                src="/muyet-logo.png"
                                alt="MUYET"
                                className="h-12 w-auto"
                            />
                        </Link>
                        <div className="h-8 w-px bg-gray-200"></div>
                        <span className="font-bold text-lg text-gray-800 tracking-tight">
                            {session?.user?.name || "Kullanıcı"} <span className="font-normal text-gray-500 text-sm ml-2">({session?.user?.email || "Mahalle Belirsiz"})</span>
                        </span>
                    </div>
                    <form
                        action={async () => {
                            "use server"
                            await signOut({ redirectTo: "/login" })
                        }}
                    >
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <LogOut className="h-4 w-4 mr-2" />
                            Çıkış
                        </Button>
                    </form>
                </div>
            </header>

            <div className="container max-w-6xl mx-auto py-6 px-4 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Görüşme Listesi</h1>
                        <p className="text-gray-500 mt-1">
                            {isAdmin ? 'Tüm görüşme kayıtları' : 'Yaptığınız görüşme kayıtları'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">
                            ← Kişi Listesine Dön
                        </Link>
                        <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border shadow-sm">
                            Toplam: <span className="font-bold text-gray-900">{gorusmeler.length}</span> Görüşme
                        </div>
                        {/* Excel Export Button */}
                        <a
                            href={`/ api /export/gorusmeler?${new URLSearchParams({
                                ...(selectedMahalle && isAdmin && { mahalle: selectedMahalle }),
                                ...(sonuc && { sonuc }),
                                ...(arama && { arama }),
                            }).toString()}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-full hover:bg-green-700 transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                            Excel
                        </a>
                    </div>
                </div>

                {/* Filtreler */}
                <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    {/* Arama */}
                    <form method="GET" className="flex gap-2 flex-1 min-w-[200px] max-w-md">
                        {selectedMahalle && isAdmin && <input type="hidden" name="mahalle" value={selectedMahalle} />}
                        {sonuc && <input type="hidden" name="sonuc" value={sonuc} />}
                        <div className="relative flex-1">
                            <input
                                type="text"
                                name="arama"
                                placeholder="Kişi veya görüşmeyi yapan..."
                                defaultValue={arama || ''}
                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                            </svg>
                        </div>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                            Ara
                        </button>
                    </form>

                    <div className="w-px bg-gray-200 hidden md:block"></div>

                    {/* Sonuç Filtresi */}
                    <div className="space-y-1">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sonuç</span>
                        <div className="flex gap-2">
                            <Link href={buildUrl({ sonuc: undefined })} className={`px - 3 py - 1.5 rounded - full text - xs font - medium transition - colors border ${!sonuc || sonuc === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'} `}>
                                Tümü
                            </Link>
                            <Link href={buildUrl({ sonuc: 'olumlu' })} className={`px - 3 py - 1.5 rounded - full text - xs font - medium transition - colors border ${sonuc === 'olumlu' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'} `}>
                                Olumlu
                            </Link>
                            <Link href={buildUrl({ sonuc: 'olumsuz' })} className={`px - 3 py - 1.5 rounded - full text - xs font - medium transition - colors border ${sonuc === 'olumsuz' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:border-red-400'} `}>
                                Olumsuz
                            </Link>
                            <Link href={buildUrl({ sonuc: 'belirsiz' })} className={`px - 3 py - 1.5 rounded - full text - xs font - medium transition - colors border ${sonuc === 'belirsiz' ? 'bg-gray-600 text-white border-gray-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'} `}>
                                Belirsiz
                            </Link>
                        </div>
                    </div>

                    {/* Mahalle Filtresi (Admin) */}
                    {isAdmin && mahalleOptions.length > 0 && (
                        <>
                            <div className="w-px bg-gray-200 hidden md:block"></div>
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mahalle</span>
                                <div className="flex flex-wrap gap-2">
                                    <Link href={buildUrl({ mahalle: undefined })} className={`px - 3 py - 1.5 rounded - full text - xs font - medium transition - colors border ${!selectedMahalle ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-400'} `}>
                                        Tümü
                                    </Link>
                                    {mahalleOptions.map(m => (
                                        <Link key={m} href={buildUrl({ mahalle: m })} className={`px - 3 py - 1.5 rounded - full text - xs font - medium transition - colors border ${selectedMahalle === m ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-400'} `}>
                                            {m}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Tablo */}
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3">Görüşülen Kişi</th>
                                    {isAdmin && !selectedMahalle && <th className="px-6 py-3">Mahalle</th>}
                                    <th className="px-6 py-3">Yargıtay</th>
                                    <th className="px-6 py-3">Görüşmeyi Yapan</th>
                                    <th className="px-6 py-3">Tarih</th>
                                    <th className="px-6 py-3">Sonuç</th>
                                    <th className="px-6 py-3">Açıklama</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {gorusmeler.length === 0 ? (
                                    <tr>
                                        <td colSpan={isAdmin && !selectedMahalle ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                                            Kayıtlı görüşme bulunmamaktadır.
                                        </td>
                                    </tr>
                                ) : (
                                    gorusmeler.map((g) => (
                                        <tr key={g.id} className="hover:bg-gray-50/80 transition-all">
                                            <td className="px-6 py-4">
                                                <Link href={`/ citizen / ${g.citizenId} `} className="font-medium text-gray-900 hover:text-blue-600 transition">
                                                    {g.citizenAd} {g.citizenSoyad}
                                                </Link>
                                            </td>
                                            {isAdmin && !selectedMahalle && (
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                                        {g.citizenMahalle}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="px-6 py-4">
                                                {g.citizenYargitayDurumu ? (
                                                    <span className={`inline - flex items - center px - 2 py - 0.5 rounded - full text - xs font - medium border ${(g.citizenYargitayDurumu.toUpperCase().includes('AKTİF') || g.citizenYargitayDurumu.toUpperCase().includes('AKTIF'))
                                                        ? 'bg-green-100 text-green-700 border-green-200'
                                                        : (g.citizenYargitayDurumu.toUpperCase().includes('BAŞKA') || g.citizenYargitayDurumu.toUpperCase().includes('BASKA') || g.citizenYargitayDurumu.toUpperCase().includes('PARTİ'))
                                                            ? 'bg-red-100 text-red-700 border-red-200'
                                                            : 'bg-orange-100 text-orange-700 border-orange-200'
                                                        } `}>
                                                        {g.citizenYargitayDurumu}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {g.gorusmeYapan}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {new Date(g.gorusmeTarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline - flex items - center px - 2.5 py - 1 rounded - full text - xs font - medium border ${getSonucStyle(g.sonuc)} `}>
                                                    {getSonucLabel(g.sonuc)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={g.aciklama}>
                                                {g.aciklama}
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

