import { auth } from "@/auth"
import { query, queryOne } from "@/lib/db"
import { isAdminTC } from "@/lib/admin"
import Link from "next/link"

interface MahalleStats {
    mahalle: string
    count: number
}

interface YargitayStats {
    yargitayDurumu: string
    count: number
}

export default async function DashboardPage() {
    const session = await auth()
    const tcNo = session?.user?.image
    const isAdmin = isAdminTC(tcNo)

    // Kullanıcının yetkili olduğu mahalleyi bul
    let userMahalle = session?.user?.email

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
        return <div className="p-10 text-center text-red-600 font-semibold">Mahalle yetkisi bulunamadı. Lütfen yöneticinizle iletişime geçin.</div>
    }

    // Mahalle koşulu
    const mahalleCondition = isAdmin ? '' : 'WHERE "mahalle" = $1'
    const mahalleParams = isAdmin ? [] : [userMahalle]

    // ===== İSTATİSTİKLER =====

    // Toplam üye sayısı
    const totalResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM "Citizen" ${mahalleCondition}`,
        mahalleParams
    )
    const totalMembers = parseInt(totalResult?.count || '0', 10)

    // Cinsiyet dağılımı
    const maleResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM "Citizen" ${mahalleCondition ? mahalleCondition + ' AND' : 'WHERE'} "cinsiyet" = 'E'`,
        mahalleParams
    )
    const maleCount = parseInt(maleResult?.count || '0', 10)
    const femaleCount = totalMembers - maleCount

    // Görevi olanlar
    const withTaskResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM "Citizen" ${mahalleCondition ? mahalleCondition + ' AND' : 'WHERE'} "gorevi" IS NOT NULL AND "gorevi" != ''`,
        mahalleParams
    )
    const withTaskCount = parseInt(withTaskResult?.count || '0', 10)

    // Başmüşahitler
    const basmusahitResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM "Citizen" ${mahalleCondition ? mahalleCondition + ' AND' : 'WHERE'} "gorevi" ILIKE '%başmüşahit%'`,
        mahalleParams
    )
    const basmusahitCount = parseInt(basmusahitResult?.count || '0', 10)

    // Mahalle dağılımı (sadece admin için)
    let mahalleStats: MahalleStats[] = []
    if (isAdmin) {
        mahalleStats = await query<MahalleStats>(
            `SELECT "mahalle", COUNT(*)::int as count FROM "Citizen" 
             WHERE "mahalle" IS NOT NULL AND "mahalle" != '' 
             GROUP BY "mahalle" ORDER BY count DESC LIMIT 10`
        )
    }

    // Yargıtay durumu dağılımı
    const yargitayStats = await query<YargitayStats>(
        `SELECT "yargitayDurumu", COUNT(*)::int as count FROM "Citizen" 
         ${mahalleCondition} ${mahalleCondition ? 'AND' : 'WHERE'} "yargitayDurumu" IS NOT NULL AND "yargitayDurumu" != ''
         GROUP BY "yargitayDurumu" ORDER BY count DESC`,
        mahalleParams
    )

    // Son görüşmeler
    const recentGorusmeler = await query<{
        id: string
        gorusmeYapan: string
        gorusmeTarihi: Date
        sonuc: string
        citizenAd: string
        citizenSoyad: string
    }>(
        `SELECT g.id, g."gorusmeYapan", g."gorusmeTarihi", g.sonuc, c.ad as "citizenAd", c.soyad as "citizenSoyad"
         FROM "Gorusme" g
         LEFT JOIN "Citizen" c ON c.id = g."citizenId"
         ${isAdmin ? '' : 'WHERE c."mahalle" = $1'}
         ORDER BY g."createdAt" DESC LIMIT 5`,
        isAdmin ? [] : [userMahalle]
    )

    // Aktif etkinlik
    const activeEvent = await queryOne<{ id: string; title: string; date: Date }>(
        `SELECT id, title, date FROM "Event" WHERE "isActive" = true ORDER BY "createdAt" DESC LIMIT 1`
    )

    let eventInvitationCount = 0
    if (activeEvent) {
        const invResult = await queryOne<{ count: string }>(
            `SELECT COUNT(*) as count FROM "Invitation" WHERE "eventId" = $1`,
            [activeEvent.id]
        )
        eventInvitationCount = parseInt(invResult?.count || '0', 10)
    }

    // Max for chart scaling
    const maxMahalleCount = mahalleStats.length > 0 ? Math.max(...mahalleStats.map(m => m.count)) : 1

    const displayTitle = isAdmin ? 'Genel Bakış' : `${userMahalle} Mahallesi`

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{displayTitle}</h1>
                    <p className="text-gray-500 mt-1">Üye istatistikleri ve özet bilgiler</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/uyeler"
                        className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        Üye Listesi
                    </Link>
                    <Link
                        href="/gorusmeler"
                        className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        Görüşmeler
                    </Link>
                    {isAdmin && (
                        <Link
                            href="/admin/events"
                            className="px-4 py-2 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-900 transition flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                            Etkinlikler
                        </Link>
                    )}
                </div>
            </div>

            {/* Admin Badge */}
            {isAdmin && (
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 text-white shadow-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
                        </div>
                        <div>
                            <span className="font-bold">Yönetici Modu</span>
                            <span className="text-purple-200 ml-2 text-sm">Tüm mahallelere erişiminiz var</span>
                        </div>
                    </div>
                    <Link href="/admin/users" className="px-3 py-1.5 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition">
                        Kullanıcı Yetkilendirme →
                    </Link>
                </div>
            )}

            {/* Aktif Etkinlik */}
            {activeEvent && (
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white shadow-lg flex items-center justify-between">
                    <div>
                        <div className="text-blue-100 text-sm font-semibold uppercase tracking-wider mb-1">Aktif Etkinlik</div>
                        <h2 className="text-2xl font-bold mb-1">{activeEvent.title}</h2>
                        <div className="text-blue-100 opacity-90 text-sm">
                            {new Date(activeEvent.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-bold">{eventInvitationCount}</div>
                        <div className="text-blue-100 text-sm">Davetli</div>
                    </div>
                </div>
            )}

            {/* İstatistik Kartları */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-2">Toplam Üye</div>
                    <div className="text-3xl font-bold text-gray-900">{totalMembers.toLocaleString('tr-TR')}</div>
                </div>
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-2">Erkek</div>
                    <div className="text-3xl font-bold text-blue-600">{maleCount.toLocaleString('tr-TR')}</div>
                    <div className="text-xs text-gray-400 mt-1">{totalMembers > 0 ? ((maleCount / totalMembers) * 100).toFixed(1) : 0}%</div>
                </div>
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-2">Kadın</div>
                    <div className="text-3xl font-bold text-pink-600">{femaleCount.toLocaleString('tr-TR')}</div>
                    <div className="text-xs text-gray-400 mt-1">{totalMembers > 0 ? ((femaleCount / totalMembers) * 100).toFixed(1) : 0}%</div>
                </div>
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="text-gray-500 text-sm font-medium mb-2">Görevi Olanlar</div>
                    <div className="text-3xl font-bold text-green-600">{withTaskCount.toLocaleString('tr-TR')}</div>
                    <div className="text-xs text-gray-400 mt-1">Başmüşahit: {basmusahitCount}</div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Mahalle Dağılımı - Admin Only */}
                {isAdmin && mahalleStats.length > 0 && (
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Mahalle Dağılımı</h3>
                        <div className="space-y-3">
                            {mahalleStats.map((m) => (
                                <div key={m.mahalle} className="flex items-center gap-3">
                                    <div className="w-24 text-sm text-gray-600 truncate" title={m.mahalle}>{m.mahalle}</div>
                                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full flex items-center justify-end pr-2 text-xs text-white font-medium"
                                            style={{ width: `${(m.count / maxMahalleCount) * 100}%`, minWidth: '40px' }}
                                        >
                                            {m.count}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Link href="/uyeler" className="text-sm text-blue-600 hover:underline mt-4 inline-block">
                            Tüm mahalleleri gör →
                        </Link>
                    </div>
                )}

                {/* Yargıtay Durumu */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Yargıtay Durumu</h3>
                    {yargitayStats.length > 0 ? (
                        <div className="space-y-2">
                            {yargitayStats.map((y) => (
                                <div key={y.yargitayDurumu} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                    <span className={`px-2 py-1 text-xs font-medium rounded ${y.yargitayDurumu === 'ONAMA' ? 'bg-red-100 text-red-700' :
                                            y.yargitayDurumu === 'BOZMA' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-gray-100 text-gray-700'
                                        }`}>
                                        {y.yargitayDurumu}
                                    </span>
                                    <span className="text-lg font-semibold text-gray-900">{y.count}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm">Yargıtay durumu kaydı yok</p>
                    )}
                </div>

                {/* Son Görüşmeler */}
                <div className={`bg-white rounded-xl p-6 border border-gray-200 shadow-sm ${isAdmin && mahalleStats.length > 0 ? '' : 'md:col-span-2'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Son Görüşmeler</h3>
                        <Link href="/gorusmeler" className="text-sm text-purple-600 hover:underline">Tümünü gör →</Link>
                    </div>
                    {recentGorusmeler.length > 0 ? (
                        <div className="space-y-3">
                            {recentGorusmeler.map((g) => (
                                <div key={g.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                    <div>
                                        <div className="font-medium text-gray-900">{g.citizenAd} {g.citizenSoyad}</div>
                                        <div className="text-xs text-gray-500">{g.gorusmeYapan} • {new Date(g.gorusmeTarihi).toLocaleDateString('tr-TR')}</div>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${g.sonuc === 'olumlu' ? 'bg-green-100 text-green-700' :
                                            g.sonuc === 'olumsuz' ? 'bg-red-100 text-red-700' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        {g.sonuc === 'olumlu' ? '✓ Olumlu' : g.sonuc === 'olumsuz' ? '✗ Olumsuz' : '? Belirsiz'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm">Henüz görüşme kaydı yok</p>
                    )}
                </div>
            </div>
        </div>
    )
}
