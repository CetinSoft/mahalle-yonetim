import { auth } from "@/auth"
import { isAdminTC, getUserIlces, getDistrictMahalles } from "@/lib/admin"
import { query } from "@/lib/db"
import {
    assignUserMahalle, removeUserMahalle, getUserMahalleAssignments,
    assignUserIlce, removeUserIlce, getUserIlceAssignments
} from "@/app/actions/user"
import Link from "next/link"
import { redirect } from "next/navigation"

export default async function AdminUsersPage() {
    const session = await auth()
    const tcNo = session?.user?.image

    const isSuperAdmin = isAdminTC(tcNo)
    const userIlces = await getUserIlces(tcNo)
    const isDistrictAdminUser = userIlces.length > 0

    // Sadece süper admin veya ilçe admini erişebilir
    if (!session?.user || (!isSuperAdmin && !isDistrictAdminUser)) {
        redirect('/')
    }

    const mahalleAssignments = await getUserMahalleAssignments()

    // İlce atamaları sadece süper admin görebilir
    let ilceAssignments: any[] = []
    if (isSuperAdmin) {
        ilceAssignments = await getUserIlceAssignments()
    }

    // Mahalle listesi - süper admin tüm mahalleleri görür, ilçe admin kendi ilçelerini
    let mahalleOptions: string[] = []
    if (isSuperAdmin) {
        const distinctMahalles = await query<{ mahalle: string }>(
            `SELECT DISTINCT mahalle FROM "Citizen" 
             WHERE mahalle IS NOT NULL AND mahalle != '' 
             ORDER BY mahalle ASC`
        )
        mahalleOptions = distinctMahalles.map(m => m.mahalle)
    } else if (isDistrictAdminUser) {
        // İlçe admini sadece kendi ilçelerindeki mahalleleri görebilir
        for (const ilce of userIlces) {
            const districtMahalles = await getDistrictMahalles(ilce)
            mahalleOptions.push(...districtMahalles)
        }
        // Tekrarları kaldır
        mahalleOptions = [...new Set(mahalleOptions)].sort()
    }

    // İlçe listesi (sadece süper admin için)
    let ilceOptions: string[] = []
    if (isSuperAdmin) {
        const distinctIlces = await query<{ ilce: string }>(
            `SELECT DISTINCT ilce FROM "Citizen" 
             WHERE ilce IS NOT NULL AND ilce != '' 
             ORDER BY ilce ASC`
        )
        ilceOptions = distinctIlces.map(i => i.ilce)
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
                </div>
            </header>

            <div className="container mx-auto py-10 px-4 space-y-8 max-w-6xl">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Kullanıcı Yetkilendirme</h1>
                        <p className="text-gray-500 mt-1">
                            {isSuperAdmin
                                ? 'Kullanıcılara ilçe ve mahalle yönetim yetkisi verin.'
                                : `${userIlces.join(', ')} ilçesi için mahalle yetkileri yönetin.`}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/dashboard" className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            Dashboard'a Dön
                        </Link>
                        {isSuperAdmin && (
                            <Link href="/admin/events" className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                                Etkinlik Yönetimi
                            </Link>
                        )}
                    </div>
                </div>

                {/* Rol Gösterimi */}
                <div className={`p-4 rounded-xl ${isSuperAdmin ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'}`}>
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
                        </div>
                        <div>
                            <span className="font-bold">{isSuperAdmin ? 'Süper Admin' : 'İlçe Admini'}</span>
                            <span className="ml-2 text-sm opacity-80">
                                {isSuperAdmin
                                    ? 'Tüm ilçe ve mahallelere tam erişim'
                                    : `${userIlces.join(', ')} ilçe(leri) için yetkili`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Sadece Süper Admin: İlçe Admin Atama */}
                {isSuperAdmin && (
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">SÜPER ADMİN</span>
                            İlçe Admini Ata
                        </h2>
                        <form action={async (formData) => {
                            'use server'
                            await assignUserIlce(formData)
                        }} className="grid md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    TC Kimlik No
                                </label>
                                <input
                                    type="text"
                                    name="tcNo"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="11 haneli TC"
                                    required
                                    maxLength={11}
                                    minLength={11}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    İlçe
                                </label>
                                <select
                                    name="ilce"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                >
                                    <option value="">İlçe Seçin...</option>
                                    {ilceOptions.map(i => (
                                        <option key={i} value={i}>{i}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button type="submit" className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition font-medium">
                                    İlçe Admini Yap
                                </button>
                            </div>
                        </form>

                        {/* İlçe Admin Listesi */}
                        {ilceAssignments.length > 0 && (
                            <div className="mt-6">
                                <h3 className="text-sm font-semibold text-gray-600 mb-3">Mevcut İlçe Adminleri</h3>
                                <div className="space-y-2">
                                    {ilceAssignments.map((assignment) => (
                                        <div key={assignment.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                                            <div className="flex items-center gap-3">
                                                <span className="font-medium text-gray-900">
                                                    {assignment.ad ? `${assignment.ad} ${assignment.soyad}` : assignment.tcNo}
                                                </span>
                                                <span className="px-2 py-0.5 bg-purple-200 text-purple-800 rounded text-xs font-medium">
                                                    {assignment.ilce}
                                                </span>
                                            </div>
                                            <form action={async () => {
                                                'use server'
                                                await removeUserIlce(assignment.tcNo, assignment.ilce)
                                            }}>
                                                <button
                                                    type="submit"
                                                    className="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition text-xs font-medium"
                                                >
                                                    Kaldır
                                                </button>
                                            </form>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid md:grid-cols-3 gap-8">
                    {/* Mahalle Yetki Atama Formu */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h2 className="text-lg font-semibold mb-4">Mahalle Yetkisi Ata</h2>
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
                                        {mahalleOptions.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>

                                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium">
                                    Yetki Ver
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Mevcut Mahalle Yetkileri Listesi */}
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h2 className="font-semibold text-gray-900">Mahalle Yetkileri</h2>
                                <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">{mahalleAssignments.length} Atama</span>
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
                                        {mahalleAssignments.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                                    Henüz yetkilendirilmiş kullanıcı yok.
                                                </td>
                                            </tr>
                                        ) : (
                                            mahalleAssignments.map((assignment) => (
                                                <tr key={assignment.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 font-medium text-gray-900">
                                                        {assignment.ad ? `${assignment.ad} ${assignment.soyad}` : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600 font-mono">
                                                        {assignment.tcNo}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                            {assignment.mahalle}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <form action={async () => {
                                                            'use server'
                                                            await removeUserMahalle(assignment.tcNo, assignment.mahalle)
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
        </div>
    )
}
