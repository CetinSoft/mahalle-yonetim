import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// Assuming shadcn table is not added, I'll use raw Tailwind table for speed or request add. 
// "Premium" requests usually mean good UI. I should add `table` via shadcn. 
// For this turn, I will assume the user (me) will add it in the next tool call if I haven't. 
// I'll stick to raw tailwind structure that looks like shadcn table for now to avoid dependency on unadded component, OR I will add it immediately.
// Safer to add it. But I can't do parallel formatting. I will use standard HTML5 + Tailwind classes mimicking Shadcn.

import Link from "next/link"

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: { yargitay?: string; cinsiyet?: string }
}) {
    const session = await auth()
    const userMahalle = session?.user?.email // Hijacked field

    if (!userMahalle) {
        return <div>Mahalle bilgisi bulunamadı.</div>
    }

    const { yargitay, cinsiyet } = await searchParams

    // Default Cinsiyet to 'E' if not present
    // If user explicitly wants 'Tümü' (All), they might pass 'all', handled below.
    const cinsiyetFilter = cinsiyet === 'all' ? undefined : (cinsiyet || 'E')

    const citizens = await prisma.citizen.findMany({
        where: {
            mahalle: userMahalle,
            yargitayDurumu: yargitay ? { contains: yargitay } : undefined,
            cinsiyet: cinsiyetFilter ? { equals: cinsiyetFilter } : undefined,
        },
        orderBy: {
            ad: 'asc'
        }
    })

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
    const distinctYargitay = await prisma.citizen.findMany({
        where: {
            mahalle: userMahalle,
            yargitayDurumu: { not: null } // Only get non-null statuses
        },
        select: {
            yargitayDurumu: true
        },
        distinct: ['yargitayDurumu']
    })

    // Filter out empty strings if any exist in the distinct set
    const yargitayOptions = distinctYargitay
        .map(i => i.yargitayDurumu)
        .filter(status => status && status.trim().length > 0)

    // Fetch Active Event
    const activeEvent = await prisma.event.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        include: {
            invitations: {
                select: { citizenId: true, invitedBy: true }
            }
        }
    })

    // Create a map of invitations for quick lookup
    const invitationMap = new Map()
    if (activeEvent) {
        activeEvent.invitations.forEach(inv => {
            invitationMap.set(inv.citizenId, inv.invitedBy)
        })
    }

    // Import action for client component usage (using inline form action for simplicity)
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
                            {activeEvent.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold">{activeEvent.invitations.length}</div>
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
                            <FilterButton label="Erkek (E)" active={cinsiyetFilter === 'E'} href={`?cinsiyet=E${yargitay ? `&yargitay=${yargitay}` : ''}`} />
                            <FilterButton label="Kadın (K)" active={cinsiyetFilter === 'K'} href={`?cinsiyet=K${yargitay ? `&yargitay=${yargitay}` : ''}`} />
                            <FilterButton label="Tümü" active={cinsiyetFilter === undefined} href={`?cinsiyet=all${yargitay ? `&yargitay=${yargitay}` : ''}`} />
                        </div>
                    </div>

                    <div className="w-px bg-gray-200 hidden md:block"></div>

                    <div className="space-y-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Yargıtay Durumu</span>
                        <div className="flex flex-wrap gap-2">
                            <FilterButton
                                label="Tümü"
                                active={!yargitay}
                                href={`?cinsiyet=${cinsiyetFilter || 'all'}`}
                            />
                            {yargitayOptions.map((status) => (
                                <FilterButton
                                    key={status}
                                    label={status!}
                                    active={yargitay === status}
                                    href={`?cinsiyet=${cinsiyetFilter || 'all'}&yargitay=${status}`}
                                />
                            ))}
                            {yargitayOptions.length === 0 && (
                                <span className="text-xs text-gray-400 italic py-1.5">Kayıtlı durum yok</span>
                            )}
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
                                                        {/* Explicitly NOT showing TC as requested */}
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
                                                {/* Yargitay Status - might be empty if import failed */}
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
