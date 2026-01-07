import { auth } from "@/auth"
import { query, queryOne, Citizen, Event, Invitation } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

interface EventWithInvitations extends Event {
    invitations: { citizenId: string; invitedBy: string }[]
}

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: { yargitay?: string; cinsiyet?: string; gorevi?: string }
}) {
    const session = await auth()
    const userMahalle = session?.user?.email // Hijacked field

    if (!userMahalle) {
        return <div>Mahalle bilgisi bulunamadı.</div>
    }

    const { yargitay, cinsiyet, gorevi } = await searchParams

    // Default Cinsiyet to 'E' if not present
    const cinsiyetFilter = cinsiyet === 'all' ? undefined : (cinsiyet || 'E')

    // Build dynamic WHERE clause
    let whereClause = 'WHERE "mahalle" = $1'
    const params: any[] = [userMahalle]
    let paramIndex = 2

    if (yargitay) {
        whereClause += ` AND "yargitayDurumu" ILIKE $${paramIndex}`
        params.push(`%${yargitay}%`)
        paramIndex++
    }

    if (cinsiyetFilter) {
        whereClause += ` AND "cinsiyet" = $${paramIndex}`
        params.push(cinsiyetFilter)
        paramIndex++
    }

    // Görevi filter - 3 fixed categories: var, yok, basmusahit
    const goreviFilter = gorevi === 'all' ? undefined : gorevi
    if (goreviFilter === 'var') {
        // Görevi var - has any role
        whereClause += ` AND "gorevi" IS NOT NULL AND "gorevi" != ''`
    } else if (goreviFilter === 'yok') {
        // Görevi yok - no role
        whereClause += ` AND ("gorevi" IS NULL OR "gorevi" = '')`
    } else if (goreviFilter === 'basmusahit') {
        // Başmüşahit specifically
        whereClause += ` AND "gorevi" ILIKE '%başmüşahit%'`
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

    // Fetch distinct Yargitay statuses for dynamic filtering
    const distinctYargitay = await query<{ yargitayDurumu: string }>(
        `SELECT DISTINCT "yargitayDurumu" FROM "Citizen" 
         WHERE "mahalle" = $1 AND "yargitayDurumu" IS NOT NULL AND "yargitayDurumu" != ''`,
        [userMahalle]
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

    return (
        <div className="space-y-6">
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
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{userMahalle} Mahallesi Listesi</h1>
                    <div className="flex items-center gap-3">
                        {/* Only show Admin Link to the hardcoded Admin */}
                        {session?.user?.image === '48316184410' && (
                            <Link href="/admin/events" className="text-sm font-medium text-blue-600 hover:underline">
                                + Etkinlik Yönetimi
                            </Link>
                        )}
                        <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border shadow-sm">
                            Toplam: <span className="font-bold text-gray-900">{citizens.length}</span> Kişi
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="space-y-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cinsiyet / Medeni (Varsayılan E)</span>
                        <div className="flex gap-2">
                            <FilterButton label="Erkek (E)" active={cinsiyetFilter === 'E'} href={`?cinsiyet=E${yargitay ? `&yargitay=${yargitay}` : ''}${goreviFilter ? `&gorevi=${goreviFilter}` : ''}`} />
                            <FilterButton label="Kadın (K)" active={cinsiyetFilter === 'K'} href={`?cinsiyet=K${yargitay ? `&yargitay=${yargitay}` : ''}${goreviFilter ? `&gorevi=${goreviFilter}` : ''}`} />
                            <FilterButton label="Tümü" active={cinsiyetFilter === undefined} href={`?cinsiyet=all${yargitay ? `&yargitay=${yargitay}` : ''}${goreviFilter ? `&gorevi=${goreviFilter}` : ''}`} />
                        </div>
                    </div>

                    <div className="w-px bg-gray-200 hidden md:block"></div>

                    <div className="space-y-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Yargıtay Durumu</span>
                        <div className="flex flex-wrap gap-2">
                            <FilterButton
                                label="Tümü"
                                active={!yargitay}
                                href={`?cinsiyet=${cinsiyetFilter || 'all'}${goreviFilter ? `&gorevi=${goreviFilter}` : ''}`}
                            />
                            {yargitayOptions.map((status) => (
                                <FilterButton
                                    key={status}
                                    label={status!}
                                    active={yargitay === status}
                                    href={`?cinsiyet=${cinsiyetFilter || 'all'}&yargitay=${status}${goreviFilter ? `&gorevi=${goreviFilter}` : ''}`}
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
                                href={`?cinsiyet=${cinsiyetFilter || 'all'}${yargitay ? `&yargitay=${yargitay}` : ''}`}
                            />
                            <FilterButton
                                label="Görevi Var"
                                active={goreviFilter === 'var'}
                                href={`?cinsiyet=${cinsiyetFilter || 'all'}${yargitay ? `&yargitay=${yargitay}` : ''}&gorevi=var`}
                            />
                            <FilterButton
                                label="Görevi Yok"
                                active={goreviFilter === 'yok'}
                                href={`?cinsiyet=${cinsiyetFilter || 'all'}${yargitay ? `&yargitay=${yargitay}` : ''}&gorevi=yok`}
                            />
                            <FilterButton
                                label="Başmüşahit"
                                active={goreviFilter === 'basmusahit'}
                                href={`?cinsiyet=${cinsiyetFilter || 'all'}${yargitay ? `&yargitay=${yargitay}` : ''}&gorevi=basmusahit`}
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
                                <th className="px-6 py-3">Yargıtay Bilgisi</th>
                                <th className="px-6 py-3">Meslek</th>
                                <th className="px-6 py-3">Görevi</th>
                                {activeEvent && <th className="px-6 py-3 text-right">Etkinlik</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {citizens.length === 0 ? (
                                <tr>
                                    <td colSpan={activeEvent ? 6 : 5} className="px-6 py-8 text-center text-gray-500">
                                        Bu mahallede kayıtlı üye bulunmamaktadır.
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
                                            {activeEvent && (
                                                <td className="px-6 py-4 text-right">
                                                    {invitedBy ? (
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                                                                Davet Edildi
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 mt-1">
                                                                {invitedBy}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <form action={async () => {
                                                            "use server"
                                                            await inviteCitizen(citizen.id, activeEvent.id)
                                                        }}>
                                                            <button
                                                                className="bg-gray-900 hover:bg-black text-white text-xs font-bold py-1.5 px-4 rounded-full shadow-sm transition-transform active:scale-95"
                                                            >
                                                                Davet Et
                                                            </button>
                                                        </form>
                                                    )}
                                                </td>
                                            )}
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
