import { auth } from "@/auth"
import { query, queryOne, Event, Citizen } from "@/lib/db"
import Link from "next/link"
import { notFound } from "next/navigation"

interface InvitationWithCitizen {
    id: string
    citizenId: string
    eventId: string
    invitedBy: string
    invitedAt: Date
    citizenAd: string
    citizenSoyad: string
    citizenTelefon: string | null
    citizenMahalle: string
}

export default async function EventDetailPage({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>,
    searchParams: Promise<{ mahalle?: string }>
}) {
    const { id } = await params
    const { mahalle } = await searchParams
    const session = await auth()
    if (!session?.user) return <div>Yetkisiz Giriş</div>

    // Admin Check
    if (session.user.image !== '48316184410') {
        return (
            <div className="container mx-auto py-20 text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-4">Yetkisiz Alan</h1>
                <p className="text-gray-600">Bu sayfaya sadece yöneticiler erişebilir.</p>
                <Link href="/dashboard" className="text-blue-600 hover:underline mt-4 block">
                    Panale Dön
                </Link>
            </div>
        )
    }

    // Fetch Event details
    const event = await queryOne<Event>(
        'SELECT * FROM "Event" WHERE id = $1',
        [id]
    )

    if (!event) return notFound()

    // Fetch Invitations with Citizen data
    let invitationQuery = `
        SELECT 
            i.id, i."citizenId", i."eventId", i."invitedBy", i."invitedAt",
            c.ad as "citizenAd", c.soyad as "citizenSoyad", 
            c.telefon as "citizenTelefon", c.mahalle as "citizenMahalle"
        FROM "Invitation" i
        JOIN "Citizen" c ON c.id = i."citizenId"
        WHERE i."eventId" = $1
    `
    const queryParams: any[] = [id]

    if (mahalle && mahalle !== 'all') {
        invitationQuery += ` AND c.mahalle = $2`
        queryParams.push(mahalle)
    }

    invitationQuery += ` ORDER BY i."invitedAt" DESC`

    const invitations = await query<InvitationWithCitizen>(invitationQuery, queryParams)

    // Get distinct mahalles for filter
    const allMahalles = await query<{ mahalle: string }>(`
        SELECT DISTINCT c.mahalle 
        FROM "Invitation" i
        JOIN "Citizen" c ON c.id = i."citizenId"
        WHERE i."eventId" = $1
        ORDER BY c.mahalle
    `, [id])

    const distinctMahalles = allMahalles.map(m => m.mahalle)

    return (
        <div className="container mx-auto py-10 px-4 max-w-5xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <Link href="/admin/events" className="text-sm text-blue-600 hover:underline mb-2 block">
                        &larr; Etkinliklere Dön
                    </Link>
                    <h1 className="text-3xl font-bold">{event.title} - Katılımcı Raporu</h1>
                    <p className="text-gray-500 mt-1">
                        {new Date(event.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 text-center">
                    <span className="block text-xs font-bold text-blue-600 uppercase">Toplam Davetli</span>
                    <span className="text-2xl font-bold text-gray-900">{invitations.length}</span>
                </div>
            </div>

            {/* Mahalle Filter */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Mahalle Filtrele:</span>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href={`/admin/events/${id}`}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${!mahalle || mahalle === 'all'
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        Tümü
                    </Link>
                    {distinctMahalles.map(m => (
                        <Link
                            key={m}
                            href={`/admin/events/${id}?mahalle=${m}`}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${mahalle === m
                                ? 'bg-gray-900 text-white border-gray-900'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {m}
                        </Link>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-3 font-medium text-gray-500">Ad Soyad</th>
                            <th className="px-6 py-3 font-medium text-gray-500">Telefon</th>
                            <th className="px-6 py-3 font-medium text-gray-500">Mahalle</th>
                            <th className="px-6 py-3 font-medium text-gray-500">Davet Eden</th>
                            <th className="px-6 py-3 font-medium text-gray-500">Tarih</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {invitations.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    Kayıt bulunamadı.
                                </td>
                            </tr>
                        ) : (
                            invitations.map(inv => (
                                <tr key={inv.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        <a href={`/citizen/${inv.citizenId}`} target="_blank" className="hover:text-blue-600 hover:underline">
                                            {inv.citizenAd} {inv.citizenSoyad}
                                        </a>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {inv.citizenTelefon || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {inv.citizenMahalle}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {inv.invitedBy}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-xs">
                                        {new Date(inv.invitedAt).toLocaleString('tr-TR')}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
