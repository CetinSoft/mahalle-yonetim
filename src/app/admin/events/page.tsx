import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { createEvent, toggleEventStatus } from "@/app/actions/event"
import { revalidatePath } from "next/cache"
import Link from "next/link"

export default async function AdminEventsPage() {
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

    const events = await prisma.event.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: { invitations: true }
            }
        }
    })

    return (
        <div className="container mx-auto py-10 px-4 max-w-4xl">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Etkinlik Yönetimi</h1>
                <Link href="/dashboard" className="text-blue-600 hover:underline">
                    &larr; Panale Dön
                </Link>
            </div>

            {/* Create Event Form */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
                <h2 className="text-xl font-semibold mb-4">Yeni Etkinlik Başlat</h2>
                <form action={async (formData) => {
                    "use server"
                    await createEvent(formData)
                }} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Etkinlik Adı</label>
                        <input
                            name="title"
                            type="text"
                            placeholder="Örn: Halk Toplantısı"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <div className="w-full md:w-48">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                        <input
                            name="date"
                            type="date"
                            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
                    >
                        Başlat
                    </button>
                </form>
            </div>

            {/* Event List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-3 font-medium text-gray-500">Etkinlik</th>
                            <th className="px-6 py-3 font-medium text-gray-500">Tarih</th>
                            <th className="px-6 py-3 font-medium text-gray-500">Durum</th>
                            <th className="px-6 py-3 font-medium text-gray-500">Davetli Sayısı</th>
                            <th className="px-6 py-3 font-medium text-gray-500">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {events.map(event => (
                            <tr key={event.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">{event.title}</td>
                                <td className="px-6 py-4 text-gray-600">
                                    {event.date.toLocaleDateString('tr-TR')}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${event.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {event.isActive ? 'Aktif' : 'Pasif'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-600 font-bold">
                                    {event._count.invitations}
                                </td>
                                <td className="px-6 py-4">
                                    <form action={async () => {
                                        "use server"
                                        await toggleEventStatus(event.id, !event.isActive)
                                    }} className="inline-block mr-2">
                                        <button className="text-blue-600 hover:underline">
                                            {event.isActive ? 'Bitir' : 'Aktifleştir'}
                                        </button>
                                    </form>
                                    <Link href={`/admin/events/${event.id}`} className="text-gray-600 hover:text-gray-900 hover:underline">
                                        Detaylar
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {events.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    Henüz etkinlik oluşturulmadı.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
