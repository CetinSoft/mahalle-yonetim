import { auth } from "@/auth"
import { query, queryOne, Citizen, Event, Invitation } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

interface EventWithInvitations extends Event {
    invitations: { citizenId: string; invitedBy: string }[]
}

// Admin TC numarası
const ADMIN_TC = '48316184410'

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: { yargitay?: string; cinsiyet?: string; gorevi?: string; mahalle?: string; arama?: string }
}) {
    const session = await auth()
    const userMahalle = session?.user?.email // Hijacked field
    const isAdmin = session?.user?.image === ADMIN_TC

    if (!userMahalle && !isAdmin) {
        return <div>Mahalle bilgisi bulunamadı.</div>
    }

    const { yargitay, cinsiyet, gorevi, mahalle, arama } = await searchParams

    // Admin için mahalle seçimi, normal kullanıcı için kendi mahallesi
    const selectedMahalle = isAdmin ? (mahalle || undefined) : userMahalle

    // Default Cinsiyet to 'E' if not present
    const cinsiyetFilter = cinsiyet === 'all' ? undefined : (cinsiyet || 'E')

    // Build dynamic WHERE clause
    let whereClause = ''
    const params: any[] = []
    let paramIndex = 1

    // Mahalle filtresi - admin seçmezse tüm mahalleler, normal kullanıcı kendi mahallesi
    if (selectedMahalle) {
        whereClause = `WHERE "mahalle" = $${paramIndex}`
        params.push(selectedMahalle)
        paramIndex++
    }

    if (yargitay) {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` "yargitayDurumu" ILIKE $${paramIndex}`
        params.push(`%${yargitay}%`)
        paramIndex++
    }

    if (cinsiyetFilter) {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` "cinsiyet" = $${paramIndex}`
        params.push(cinsiyetFilter)
        paramIndex++
    }

    // Görevi filter - 3 fixed categories: var, yok, basmusahit
    const goreviFilter = gorevi === 'all' ? undefined : gorevi
    if (goreviFilter === 'var') {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` "gorevi" IS NOT NULL AND "gorevi" != ''`
    } else if (goreviFilter === 'yok') {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` ("gorevi" IS NULL OR "gorevi" = '')`
    } else if (goreviFilter === 'basmusahit') {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` "gorevi" ILIKE '%başmüşahit%'`
    }

    // Arama filtresi - ad, soyad veya TC ile arama
    if (arama && arama.trim()) {
        const searchTerm = arama.trim()
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` ("ad" ILIKE $${paramIndex} OR "soyad" ILIKE $${paramIndex} OR "tcNo" ILIKE $${paramIndex} OR CONCAT("ad", ' ', "soyad") ILIKE $${paramIndex})`
        params.push(`%${searchTerm}%`)
        paramIndex++
    }

    const citizens = await query<Citizen>(
        `SELECT * FROM "Citizen" ${whereClause} ORDER BY "ad" ASC`,
        params
    )

    const FilterButton = ({ label, active, href }: { label: string, active: boolean, href: string }) => (
        <Link
            href={href}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${active
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                }`}
        >
            {label}
        </Link>
    )

    // Fetch all distinct mahalles for admin filter
    let mahalleOptions: string[] = []
    if (isAdmin) {
        const distinctMahalles = await query<{ mahalle: string }>(
            `SELECT DISTINCT "mahalle" FROM "Citizen" 
             WHERE "mahalle" IS NOT NULL AND "mahalle" != ''
             ORDER BY "mahalle" ASC`
        )
        mahalleOptions = distinctMahalles.map(m => m.mahalle)
    }

    // Fetch distinct Yargitay statuses for dynamic filtering
    const yargitayQuery = selectedMahalle
        ? `SELECT DISTINCT "yargitayDurumu" FROM "Citizen" WHERE "mahalle" = $1 AND "yargitayDurumu" IS NOT NULL AND "yargitayDurumu" != ''`
        : `SELECT DISTINCT "yargitayDurumu" FROM "Citizen" WHERE "yargitayDurumu" IS NOT NULL AND "yargitayDurumu" != ''`

    const distinctYargitay = await query<{ yargitayDurumu: string }>(
        yargitayQuery,
        selectedMahalle ? [selectedMahalle] : []
    )

    const yargitayOptions = distinctYargitay
        .map(i => i.yargitayDurumu)
        .filter(status => status && status.trim().length > 0)

    // Fetch Active Event with invitations
    const activeEvent = await queryOne<Event>(
        `SELECT * FROM "Event" WHERE "isActive" = true ORDER BY "createdAt" DESC LIMIT 1`
    )

    let invitationMap = new Map<string, string>()
    let eventInvitations: { citizenId: string; invitedBy: string }[] = []

    if (activeEvent) {
        const invitations = await query<{ citizenId: string; invitedBy: string }>(
            `SELECT "citizenId", "invitedBy" FROM "Invitation" WHERE "eventId" = $1`,
            [activeEvent.id]
        )
        eventInvitations = invitations
        invitations.forEach(inv => {
            invitationMap.set(inv.citizenId, inv.invitedBy)
        })
    }

    // Import action for client component usage
    const { inviteCitizen } = await import('@/app/actions/event')

    // Build filter URL helper
    const buildFilterUrl = (overrides: Record<string, string | undefined>) => {
        const current = {
            cinsiyet: cinsiyetFilter || 'all',
            yargitay: yargitay,
            gorevi: goreviFilter,
            mahalle: selectedMahalle,
            arama: arama,
        }
        const merged = { ...current, ...overrides }
        const parts: string[] = []
        if (merged.cinsiyet) parts.push(`cinsiyet=${merged.cinsiyet}`)
        if (merged.yargitay) parts.push(`yargitay=${merged.yargitay}`)
        if (merged.gorevi) parts.push(`gorevi=${merged.gorevi}`)
        if (merged.mahalle && isAdmin) parts.push(`mahalle=${merged.mahalle}`)
        if (merged.arama) parts.push(`arama=${encodeURIComponent(merged.arama)}`)
        return `?${parts.join('&')}`
    }

    // Display title
    const displayTitle = isAdmin
        ? (selectedMahalle ? `${selectedMahalle} Mahallesi` : 'Tüm Mahalleler')
        : `${userMahalle} Mahallesi`

    return (
        <div className="space-y-6">
            {/* Admin Badge */}
            {isAdmin && (
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 text-white shadow-lg flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
                    </div>
                    <div>
                        <span className="font-bold">Yönetici Modu</span>
                        <span className="text-purple-200 ml-2 text-sm">Tüm mahallelere erişiminiz var</span>
                    </div>
                </div>
            )}

            {/* Active Event Banner */}
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
                        <div className="text-3xl font-bold">{eventInvitations.length}</div>
                        <div className="text-blue-100 text-xs uppercase tracking-wide">Katılımcı</div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{displayTitle} Listesi</h1>
                    <div className="flex items-center gap-3">
                        {/* Only show Admin Link to the hardcoded Admin */}
                        {isAdmin && (
                            <Link href="/admin/events" className="text-sm font-medium text-blue-600 hover:underline">
                                + Etkinlik Yönetimi
                            </Link>
                        )}
                        <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border shadow-sm">
                            Toplam: <span className="font-bold text-gray-900">{citizens.length}</span> Kişi
                        </div>
                    </div>
                </div>

                {/* Arama Kutusu */}
                <form method="GET" className="flex gap-2">
                    {/* Mevcut filtreleri gizli input olarak koru */}
                    {cinsiyetFilter && <input type="hidden" name="cinsiyet" value={cinsiyetFilter} />}
                    {yargitay && <input type="hidden" name="yargitay" value={yargitay} />}
                    {goreviFilter && <input type="hidden" name="gorevi" value={goreviFilter} />}
                    {selectedMahalle && isAdmin && <input type="hidden" name="mahalle" value={selectedMahalle} />}

                    <div className="relative flex-1 max-w-md">
                        <input
                            type="text"
                            name="arama"
                            placeholder="İsim, soyisim veya TC ile ara..."
                            defaultValue={arama || ''}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                        </svg>
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                    >
                        Ara
                    </button>
                    {arama && (
                        <a
                            href={buildFilterUrl({ arama: undefined })}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                        >
                            Temizle
                        </a>
                    )}
                </form>

                <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    {/* Mahalle Filter - Only for Admin */}
                    {isAdmin && (
                        <>
                            <div className="space-y-2">
                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mahalle</span>
                                <div className="flex flex-wrap gap-2">
                                    <FilterButton
                                        label="Tüm Mahalleler"
                                        active={!selectedMahalle}
                                        href={buildFilterUrl({ mahalle: undefined })}
                                    />
                                    {mahalleOptions.map((m) => (
                                        <FilterButton
                                            key={m}
                                            label={m}
                                            active={selectedMahalle === m}
                                            href={buildFilterUrl({ mahalle: m })}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="w-px bg-gray-200 hidden md:block"></div>
                        </>
                    )}

                    <div className="space-y-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cinsiyet / Medeni (Varsayılan E)</span>
                        <div className="flex gap-2">
                            <FilterButton label="Erkek (E)" active={cinsiyetFilter === 'E'} href={buildFilterUrl({ cinsiyet: 'E' })} />
                            <FilterButton label="Kadın (K)" active={cinsiyetFilter === 'K'} href={buildFilterUrl({ cinsiyet: 'K' })} />
                            <FilterButton label="Tümü" active={cinsiyetFilter === undefined} href={buildFilterUrl({ cinsiyet: 'all' })} />
                        </div>
                    </div>

                    <div className="w-px bg-gray-200 hidden md:block"></div>

                    <div className="space-y-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Yargıtay Durumu</span>
                        <div className="flex flex-wrap gap-2">
                            <FilterButton
                                label="Tümü"
                                active={!yargitay}
                                href={buildFilterUrl({ yargitay: undefined })}
                            />
                            {yargitayOptions.map((status) => (
                                <FilterButton
                                    key={status}
                                    label={status!}
                                    active={yargitay === status}
                                    href={buildFilterUrl({ yargitay: status })}
                                />
                            ))}
                            {yargitayOptions.length === 0 && (
                                <span className="text-xs text-gray-400 italic py-1.5">Kayıtlı durum yok</span>
                            )}
                        </div>
                    </div>

                    <div className="w-px bg-gray-200 hidden md:block"></div>

                    <div className="space-y-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Görevi</span>
                        <div className="flex flex-wrap gap-2">
                            <FilterButton
                                label="Tümü"
                                active={!goreviFilter}
                                href={buildFilterUrl({ gorevi: undefined })}
                            />
                            <FilterButton
                                label="Görevi Var"
                                active={goreviFilter === 'var'}
                                href={buildFilterUrl({ gorevi: 'var' })}
                            />
                            <FilterButton
                                label="Görevi Yok"
                                active={goreviFilter === 'yok'}
                                href={buildFilterUrl({ gorevi: 'yok' })}
                            />
                            <FilterButton
                                label="Başmüşahit"
                                active={goreviFilter === 'basmusahit'}
                                href={buildFilterUrl({ gorevi: 'basmusahit' })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3">Ad Soyad</th>
                                <th className="px-6 py-3">Telefon</th>
                                {isAdmin && !selectedMahalle && <th className="px-6 py-3">Mahalle</th>}
                                <th className="px-6 py-3">Yargıtay Bilgisi</th>
                                <th className="px-6 py-3">Meslek</th>
                                <th className="px-6 py-3">Görevi</th>
                                <th className="px-6 py-3 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {citizens.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdmin && !selectedMahalle ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                                        Kayıtlı üye bulunmamaktadır.
                                    </td>
                                </tr>
                            ) : (
                                citizens.map((citizen) => {
                                    const invitedBy = invitationMap.get(citizen.id)

                                    return (
                                        <tr key={citizen.id} className="hover:bg-gray-50/80 transition-all group">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                <a href={`/citizen/${citizen.id}`} className="block group-hover:text-blue-600 transition-colors">
                                                    <div className="flex flex-col">
                                                        <span className="text-base">{citizen.ad} {citizen.soyad}</span>
                                                    </div>
                                                </a>
                                            </td>
                                            <td className="px-6 py-4">
                                                {citizen.telefon ? (
                                                    <a
                                                        href={`tel:${citizen.telefon}`}
                                                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-phone"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                                        {citizen.telefon}
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400 italic">-</span>
                                                )}
                                            </td>
                                            {isAdmin && !selectedMahalle && (
                                                <td className="px-6 py-4 text-gray-600">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                                        {citizen.mahalle}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="px-6 py-4 text-gray-600">
                                                {citizen.yargitayDurumu ? (
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${citizen.yargitayDurumu === 'ONAMA' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                                                        }`}>
                                                        {citizen.yargitayDurumu}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {citizen.meslek || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {citizen.gorevi || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Görüşme Ekle Butonu */}
                                                    <a
                                                        href={`/citizen/${citizen.id}#gorusme`}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full border border-purple-200 hover:bg-purple-100 transition"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                                        Görüşme
                                                    </a>

                                                    {/* Etkinliğe Davet Butonu */}
                                                    {activeEvent && (
                                                        invitedBy ? (
                                                            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                Davetli
                                                            </span>
                                                        ) : (
                                                            <form action={async () => {
                                                                "use server"
                                                                await inviteCitizen(citizen.id, activeEvent.id)
                                                            }}>
                                                                <button
                                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200 hover:bg-blue-100 transition"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" /></svg>
                                                                    Davet Et
                                                                </button>
                                                            </form>
                                                        )
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

