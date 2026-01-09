import { auth } from "@/auth"
import { query, queryOne, Citizen, Event } from "@/lib/db"
import { isAdminTC } from "@/lib/admin"
import Link from "next/link"

interface EventWithInvitations extends Event {
    invitations: { citizenId: string; invitedBy: string }[]
}

const PAGE_SIZE = 50

export default async function UyelerPage({
    searchParams,
}: {
    searchParams: { yargitay?: string; cinsiyet?: string; gorevi?: string; mahalle?: string; arama?: string; sayfa?: string; siralama?: string; siraDir?: string }
}) {
    const session = await auth()
    const tcNo = session?.user?.image
    const isAdmin = isAdminTC(tcNo)

    // Kullanıcının yetkili olduğu mahalleleri bul
    let userMahalles: string[] = []

    // Eğer admin değilse ve TC'si varsa, UserMahalle tablosundan TÜM yetkilerini kontrol et
    if (tcNo && !isAdmin) {
        const assignments = await query<{ mahalle: string }>(
            'SELECT mahalle FROM "UserMahalle" WHERE "tcNo" = $1',
            [tcNo]
        )
        userMahalles = assignments.map(a => a.mahalle)

        // Ayrıca session'daki email (eski sistemden gelen mahalle) de ekle
        if (session?.user?.email && !userMahalles.includes(session.user.email)) {
            userMahalles.push(session.user.email)
        }
    } else if (!isAdmin && session?.user?.email) {
        // UserMahalle'de yoksa session'dan al
        userMahalles = [session.user.email]
    }

    if (userMahalles.length === 0 && !isAdmin) {
        return <div className="p-10 text-center text-red-600 font-semibold">Mahalle yetkisi bulunamadı. Lütfen yöneticinizle iletişime geçin.</div>
    }

    const { yargitay, cinsiyet, gorevi, mahalle, arama, sayfa, siralama, siraDir } = await searchParams
    const currentPage = Math.max(1, parseInt(sayfa || '1', 10) || 1)

    // Sıralama ayarları
    const sortColumn = siralama || 'ad'
    const sortDirection = siraDir === 'desc' ? 'DESC' : 'ASC'
    const validSortColumns = ['ad', 'soyad', 'uyeKayitTarihi', 'telefon', 'mahalle', 'yargitayDurumu', 'meslek', 'gorevi']
    const finalSortColumn = validSortColumns.includes(sortColumn) ? sortColumn : 'ad'

    // Admin için mahalle seçimi, normal kullanıcı için kendi mahalleleri
    // Normal kullanıcı URL'den mahalle seçebilir ama sadece yetkili olduğu mahalleler arasından
    let selectedMahalle: string | undefined = undefined
    if (isAdmin) {
        selectedMahalle = mahalle || undefined
    } else {
        // Normal kullanıcı: URL'den seçilen mahalle yetkili mahalleler arasında mı?
        if (mahalle && userMahalles.includes(mahalle)) {
            selectedMahalle = mahalle
        }
        // Eğer URL'den seçilmediyse veya yetkisizse, tüm yetkili mahalleleri göster
    }

    // Default Cinsiyet to 'E' if not present
    const cinsiyetFilter = cinsiyet === 'all' ? undefined : (cinsiyet || 'E')

    // Build dynamic WHERE clause
    let whereClause = ''
    const params: any[] = []
    let paramIndex = 1

    // Mahalle filtresi
    if (isAdmin) {
        // Admin: belirli bir mahalle seçtiyse filtrele
        if (selectedMahalle) {
            whereClause = `WHERE "mahalle" = $${paramIndex}`
            params.push(selectedMahalle)
            paramIndex++
        }
    } else {
        // Normal kullanıcı: belirli bir mahalle seçtiyse onu, yoksa tüm yetkili mahalleleri göster
        if (selectedMahalle) {
            whereClause = `WHERE "mahalle" = $${paramIndex}`
            params.push(selectedMahalle)
            paramIndex++
        } else if (userMahalles.length > 0) {
            // Birden fazla mahalle için IN clause
            const placeholders = userMahalles.map((_, i) => `$${paramIndex + i}`).join(', ')
            whereClause = `WHERE "mahalle" IN (${placeholders})`
            params.push(...userMahalles)
            paramIndex += userMahalles.length
        }
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

    // Önce toplam kayıt sayısını al
    const countResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM "Citizen" ${whereClause}`,
        params
    )
    const totalCount = parseInt(countResult?.count || '0', 10)
    const totalPages = Math.ceil(totalCount / PAGE_SIZE)

    // Sayfalama ile veri çek
    const offset = (currentPage - 1) * PAGE_SIZE
    const citizens = await query<Citizen>(
        `SELECT * FROM "Citizen" ${whereClause} ORDER BY "${finalSortColumn}" ${sortDirection} NULLS LAST LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
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

    // Build filter URL helper (filtre değişince sayfa 1'e döner)
    const buildFilterUrl = (overrides: Record<string, string | undefined>) => {
        const current = {
            cinsiyet: cinsiyetFilter || 'all',
            yargitay: yargitay,
            gorevi: goreviFilter,
            mahalle: selectedMahalle,
            arama: arama,
            siralama: siralama,
            siraDir: siraDir,
        }
        const merged = { ...current, ...overrides }
        const parts: string[] = []
        if (merged.cinsiyet) parts.push(`cinsiyet=${merged.cinsiyet}`)
        if (merged.yargitay) parts.push(`yargitay=${merged.yargitay}`)
        if (merged.gorevi) parts.push(`gorevi=${merged.gorevi}`)
        if (merged.mahalle) parts.push(`mahalle=${merged.mahalle}`)
        if (merged.arama) parts.push(`arama=${encodeURIComponent(merged.arama)}`)
        if (merged.siralama) parts.push(`siralama=${merged.siralama}`)
        if (merged.siraDir) parts.push(`siraDir=${merged.siraDir}`)
        return `?${parts.join('&')}`
    }

    // Build page URL helper (mevcut filtreleri koruyarak sayfa değiştirir)
    const buildPageUrl = (page: number) => {
        const parts: string[] = []
        if (cinsiyetFilter) parts.push(`cinsiyet=${cinsiyetFilter}`)
        if (yargitay) parts.push(`yargitay=${yargitay}`)
        if (goreviFilter) parts.push(`gorevi=${goreviFilter}`)
        if (selectedMahalle) parts.push(`mahalle=${selectedMahalle}`)
        if (arama) parts.push(`arama=${encodeURIComponent(arama)}`)
        if (siralama) parts.push(`siralama=${siralama}`)
        if (siraDir) parts.push(`siraDir=${siraDir}`)
        parts.push(`sayfa=${page}`)
        return `?${parts.join('&')}`
    }

    // Build sort URL helper
    const buildSortUrl = (column: string) => {
        const newDir = (siralama === column && siraDir === 'asc') ? 'desc' : 'asc'
        return buildFilterUrl({ siralama: column, siraDir: newDir })
    }

    // Sort indicator component
    const SortHeader = ({ label, column }: { label: string; column: string }) => (
        <Link
            href={buildSortUrl(column)}
            className="flex items-center gap-1 hover:text-blue-600 transition-colors"
        >
            {label}
            {siralama === column && (
                <span className="text-blue-600">
                    {siraDir === 'desc' ? '↓' : '↑'}
                </span>
            )}
        </Link>
    )

    // Display title
    const displayTitle = isAdmin
        ? (selectedMahalle ? `${selectedMahalle} Mahallesi` : 'Tüm Mahalleler')
        : (selectedMahalle ? `${selectedMahalle} Mahallesi` : (userMahalles.length === 1 ? `${userMahalles[0]} Mahallesi` : `${userMahalles.length} Mahalle`))

    return (
        <div className="container mx-auto px-4 py-6 max-w-7xl">
            <div className="space-y-6">
                {/* Admin Badge */}
                {isAdmin && (
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 text-white shadow-lg flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
                            </div>
                            <div>
                                <span className="font-bold">Yönetici Modu</span>
                                <span className="text-purple-200 ml-2 text-sm">Tam yetkili erişim</span>
                            </div>
                        </div>
                        {/* Kullanıcı Yönetimi Linki */}
                        <Link
                            href="/admin/users"
                            className="bg-white border border-gray-200 rounded-xl p-4 text-gray-700 shadow-sm hover:shadow-md transition flex items-center gap-3 md:w-auto"
                        >
                            <div className="bg-gray-100 p-2 rounded-full text-gray-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                            </div>
                            <span className="font-semibold">Kullanıcı Yetkilendirme</span>
                        </Link>
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
                            {/* Dashboard linki */}
                            <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:underline">
                                🏠 Dashboard (Anasayfa)
                            </Link>
                            {/* Görüşmeler linki - herkes görebilir */}
                            <Link href="/gorusmeler" className="text-sm font-medium text-purple-600 hover:underline">
                                📋 Görüşmeler
                            </Link>
                            {/* Only show Admin Link to the hardcoded Admin */}
                            {isAdmin && (
                                <Link href="/admin/events" className="text-sm font-medium text-blue-600 hover:underline">
                                    + Etkinlik Yönetimi
                                </Link>
                            )}
                            <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border shadow-sm">
                                Toplam: <span className="font-bold text-gray-900">{totalCount}</span> Kişi
                            </div>
                            {/* Excel Export Button */}
                            <a
                                href={`/api/export/kisiler?${new URLSearchParams({
                                    ...(cinsiyetFilter && { cinsiyet: cinsiyetFilter }),
                                    ...(yargitay && { yargitay }),
                                    ...(goreviFilter && { gorevi: goreviFilter }),
                                    ...(selectedMahalle && isAdmin && { mahalle: selectedMahalle }),
                                    ...(arama && { arama }),
                                }).toString()}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-full hover:bg-green-700 transition"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                                Excel
                            </a>
                        </div>
                    </div>


                    <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        {/* Mahalle Filter - Admin için tüm mahalleler, normal kullanıcı için yetkili mahalleler */}
                        {isAdmin ? (
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
                        ) : userMahalles.length > 1 ? (
                            <>
                                <div className="space-y-2">
                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mahalle</span>
                                    <div className="flex flex-wrap gap-2">
                                        <FilterButton
                                            label="Tüm Mahallelerim"
                                            active={!selectedMahalle}
                                            href={buildFilterUrl({ mahalle: undefined })}
                                        />
                                        {userMahalles.map((m) => (
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
                        ) : null}

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

                        <div className="w-px bg-gray-200 hidden md:block"></div>

                        {/* Arama */}
                        <div className="space-y-2 flex-1 min-w-[200px]">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Arama</span>
                            <form method="GET" className="flex gap-2">
                                {cinsiyetFilter && <input type="hidden" name="cinsiyet" value={cinsiyetFilter} />}
                                {yargitay && <input type="hidden" name="yargitay" value={yargitay} />}
                                {goreviFilter && <input type="hidden" name="gorevi" value={goreviFilter} />}
                                {selectedMahalle && isAdmin && <input type="hidden" name="mahalle" value={selectedMahalle} />}
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        name="arama"
                                        placeholder="İsim, TC..."
                                        defaultValue={arama || ''}
                                        className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                                    </svg>
                                </div>
                                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition">Ara</button>
                                {arama && (
                                    <a href={buildFilterUrl({ arama: undefined })} className="px-2 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition">×</a>
                                )}
                            </form>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3"><SortHeader label="Ad Soyad" column="ad" /></th>
                                    <th className="px-6 py-3"><SortHeader label="Telefon" column="telefon" /></th>
                                    {isAdmin && !selectedMahalle && <th className="px-6 py-3"><SortHeader label="Mahalle" column="mahalle" /></th>}
                                    <th className="px-6 py-3"><SortHeader label="Yargıtay Bilgisi" column="yargitayDurumu" /></th>
                                    <th className="px-6 py-3"><SortHeader label="Meslek" column="meslek" /></th>
                                    <th className="px-6 py-3"><SortHeader label="Görevi" column="gorevi" /></th>
                                    <th className="px-6 py-3"><SortHeader label="Kayıt Tarihi" column="uyeKayitTarihi" /></th>
                                    <th className="px-6 py-3 text-right">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {citizens.length === 0 ? (
                                    <tr>
                                        <td colSpan={isAdmin && !selectedMahalle ? 8 : 7} className="px-6 py-8 text-center text-gray-500">
                                            Kayıtlı üye bulunmamaktadır.
                                        </td>
                                    </tr>
                                ) : (
                                    citizens.map((citizen) => {
                                        const invitedBy = invitationMap.get(citizen.id)

                                        // Yargıtay durumuna göre badge rengi belirle
                                        const yargitayUpper = (citizen.yargitayDurumu || '').toUpperCase()
                                        let yargitayBadgeClass = 'bg-orange-100 text-orange-700 border-orange-200' // Varsayılan: turuncu
                                        if (yargitayUpper.includes('AKTİF') || yargitayUpper.includes('AKTIF') || yargitayUpper === 'AKTİF ÜYE' || yargitayUpper === 'AKTIF UYE') {
                                            yargitayBadgeClass = 'bg-green-100 text-green-700 border-green-200' // Aktif üye: yeşil
                                        } else if (yargitayUpper.includes('BAŞKA') || yargitayUpper.includes('BASKA') || yargitayUpper.includes('PARTİ') || yargitayUpper.includes('PARTI')) {
                                            yargitayBadgeClass = 'bg-red-100 text-red-700 border-red-200' // Başka parti üyesi: kırmızı
                                        }

                                        return (
                                            <tr key={citizen.id} className="hover:bg-gray-50 transition-all group">
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
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${yargitayBadgeClass}`}>
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
                                                <td className="px-6 py-4 text-gray-600">
                                                    {citizen.uyeKayitTarihi ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                            {citizen.uyeKayitTarihi}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
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
                                                        {/* Etkinliğe Davet Butonu */}
                                                        {activeEvent && (
                                                            invitedBy ? (
                                                                <span
                                                                    title={`Davetli: ${activeEvent.title}`}
                                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200 cursor-help"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                    Davetli
                                                                </span>
                                                            ) : (
                                                                <form action={async () => {
                                                                    "use server"
                                                                    await inviteCitizen(citizen.id, activeEvent.id)
                                                                }}>
                                                                    <button
                                                                        title={`Etkinliğe Davet Et: ${activeEvent.title}`}
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

                {/* Sayfalama */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between bg-white px-6 py-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-600">
                            Toplam <span className="font-semibold">{totalCount}</span> kayıttan{' '}
                            <span className="font-semibold">{offset + 1}</span>-<span className="font-semibold">{Math.min(offset + PAGE_SIZE, totalCount)}</span> arası gösteriliyor
                        </div>
                        <div className="flex items-center gap-2">
                            {currentPage > 1 && (
                                <Link
                                    href={buildPageUrl(currentPage - 1)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                                >
                                    ← Önceki
                                </Link>
                            )}
                            <div className="flex items-center gap-1">
                                {/* Sayfa numaraları - basit versiyon */}
                                {(() => {
                                    const pages: number[] = []
                                    const start = Math.max(1, currentPage - 2)
                                    const end = Math.min(totalPages, currentPage + 2)

                                    if (start > 1) {
                                        pages.push(1)
                                        if (start > 2) pages.push(-1) // ... için
                                    }

                                    for (let i = start; i <= end; i++) {
                                        pages.push(i)
                                    }

                                    if (end < totalPages) {
                                        if (end < totalPages - 1) pages.push(-1) // ... için
                                        pages.push(totalPages)
                                    }

                                    return pages.map((pageNum, idx) =>
                                        pageNum === -1 ? (
                                            <span key={`dots-${idx}`} className="text-gray-400 px-1">...</span>
                                        ) : (
                                            <Link
                                                key={pageNum}
                                                href={buildPageUrl(pageNum)}
                                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${pageNum === currentPage
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {pageNum}
                                            </Link>
                                        )
                                    )
                                })()}
                            </div>
                            {currentPage < totalPages && (
                                <Link
                                    href={buildPageUrl(currentPage + 1)}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                                >
                                    Sonraki →
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
