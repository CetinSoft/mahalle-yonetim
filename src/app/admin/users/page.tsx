import { auth } from "@/auth"
import { isAdminTC } from "@/lib/admin"
import { query } from "@/lib/db"
import { assignUserMahalle, removeUserMahalle, getUserMahalleAssignments } from "@/app/actions/user"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function AdminUsersPage() {
    const session = await auth()

    if (!session?.user || !isAdminTC(session.user.image)) {
        redirect('/')
    }

    const assignments = await getUserMahalleAssignments()

    // Mahalle listesi için
    const distinctMahalles = await query<{ mahalle: string }>(
        `SELECT DISTINCT mahalle FROM "Citizen" 
         WHERE mahalle IS NOT NULL AND mahalle != '' 
         ORDER BY mahalle ASC`
    )

    return (
        <div className="container mx-auto py-10 px-4 space-y-8 max-w-5xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Kullanıcı Yetkilendirme</h1>
                    <p className="text-gray-500 mt-1">Kullanıcılara mahalle yönetim yetkisi verin.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/dashboard" className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                        Dashboard'a Dön
                    </Link>
                    <Link href="/admin/events" className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                        Etkinlik Yönetimi
                    </Link>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Yeni Atama Formu */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-semibold mb-4">Yeni Yetki Ata</h2>
                        <form action={async (formData) => {
                            'use server'
                            await assignUserMahalle(formData)
                        }} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    TC Kimlik No
                                </label>
                                <input
                                    type="text"
                                    name="tcNo"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="11 haneli TC"
                                    required
                                    maxLength={11}
                                    minLength={11}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Mahalle
                                </label>
                                <select
                                    name="mahalle"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                >
                                    <option value="">Mahalle Seçin...</option>
                                    {distinctMahalles.map(m => (
                                        <option key={m.mahalle} value={m.mahalle}>{m.mahalle}</option>
                                    ))}
                                </select>
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium">
                                Yetki Ver
                            </button>
                        </form>
                    </div>
                </div>

                {/* Mevcut Atamalar Listesi */}
                <div className="md:col-span-2">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h2 className="font-semibold text-gray-900">Yetkili Kullanıcılar</h2>
                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">{assignments.length} Atama</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-3">Kullanıcı</th>
                                        <th className="px-6 py-3">TC No</th>
                                        <th className="px-6 py-3">Yetkili Mahalle</th>
                                        <th className="px-6 py-3 text-right">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {assignments.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                                Henüz yetkilendirilmiş kullanıcı yok.
                                            </td>
                                        </tr>
                                    ) : (
                                        assignments.map((assignment) => (
                                            <tr key={assignment.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    {assignment.ad ? `${assignment.ad} ${assignment.soyad}` : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 font-mono">
                                                    {assignment.tcNo}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                                        {assignment.mahalle}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <form action={async () => {
                                                        'use server'
                                                        await removeUserMahalle(assignment.tcNo)
                                                    }}>
                                                        <button
                                                            type="submit"
                                                            className="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition text-xs font-medium"
                                                        >
                                                            Kaldır
                                                        </button>
                                                    </form>
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
        </div>
    )
}
