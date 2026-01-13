import { auth } from "@/auth"
import { isAdminTC, getUserIlces } from "@/lib/admin"
import { query, Faaliyet } from "@/lib/db"
import { getFaaliyetler, createFaaliyet, deleteFaaliyet } from "@/app/actions/faaliyet"
import Link from "next/link"
import { Calendar, Plus, MapPin, Clock, User, Trash2, ChevronLeft, ChevronRight, List, Grid3X3 } from "lucide-react"

export default async function TakvimPage({
    searchParams,
}: {
    searchParams: { ay?: string; yil?: string; gorunum?: string }
}) {
    const session = await auth()
    const tcNo = session?.user?.image

    const isSuperAdmin = isAdminTC(tcNo)
    const userIlces = await getUserIlces(tcNo)
    const isDistrictAdmin = userIlces.length > 0

    // Kullanıcının ilçe yetkisi var mı?
    let userIlce: string | null = null

    if (isSuperAdmin) {
        // Süper admin tüm faaliyetleri görebilir
    } else if (isDistrictAdmin) {
        userIlce = userIlces[0]
    } else {
        const mahalleInfo = await query<{ ilce: string }>(
            `SELECT DISTINCT c.ilce 
             FROM "UserMahalle" um 
             JOIN "Citizen" c ON c.mahalle = um.mahalle 
             WHERE um."tcNo" = $1 AND c.ilce IS NOT NULL
             LIMIT 1`,
            [tcNo]
        )
        if (mahalleInfo.length > 0) {
            userIlce = mahalleInfo[0].ilce
        }
    }

    if (!userIlce && !isSuperAdmin && !isDistrictAdmin) {
        return <div className="p-10 text-center text-red-600 font-semibold">Takvim görüntüleme yetkiniz bulunmamaktadır.</div>
    }

    const { ay, yil, gorunum } = await searchParams

    // Takvim için ay/yıl hesaplama
    const now = new Date()
    const currentMonth = ay ? parseInt(ay) : now.getMonth()
    const currentYear = yil ? parseInt(yil) : now.getFullYear()
    const viewMode = gorunum || 'aylik'

    const faaliyetler = await getFaaliyetler(userIlce || undefined)

    // İlçe listesi
    let ilceOptions: string[] = []
    if (isSuperAdmin) {
        const distinctIlces = await query<{ ilce: string }>(
            `SELECT DISTINCT ilce FROM "Citizen" WHERE ilce IS NOT NULL AND ilce != '' ORDER BY ilce ASC`
        )
        ilceOptions = distinctIlces.map(i => i.ilce)
    } else if (isDistrictAdmin) {
        ilceOptions = userIlces
    }

    // Takvim için günleri oluştur
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
    const startDay = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1 // Pazartesi başlangıç

    // Faaliyetleri tarihe göre map'le
    const faaliyetMap: Record<string, Faaliyet[]> = {}
    faaliyetler.forEach(f => {
        const dateKey = new Date(f.tarih).toISOString().split('T')[0]
        if (!faaliyetMap[dateKey]) faaliyetMap[dateKey] = []
        faaliyetMap[dateKey].push(f)
    })

    // Ayın günlerini oluştur
    const calendarDays: { date: Date; isCurrentMonth: boolean }[] = []

    // Önceki ayın günleri
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0)
    for (let i = startDay - 1; i >= 0; i--) {
        calendarDays.push({
            date: new Date(currentYear, currentMonth - 1, prevMonthLastDay.getDate() - i),
            isCurrentMonth: false
        })
    }

    // Bu ayın günleri
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
        calendarDays.push({
            date: new Date(currentYear, currentMonth, i),
            isCurrentMonth: true
        })
    }

    // Sonraki ayın günleri (6 satır tamamlamak için)
    const remainingDays = 42 - calendarDays.length
    for (let i = 1; i <= remainingDays; i++) {
        calendarDays.push({
            date: new Date(currentYear, currentMonth + 1, i),
            isCurrentMonth: false
        })
    }

    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear

    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

    const canEdit = isSuperAdmin || isDistrictAdmin
    const today = new Date().toISOString().split('T')[0]

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* MUYET Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-gray-200/60 shadow-sm backdrop-blur-md bg-white/80 supports-[backdrop-filter]:bg-white/60">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard">
                            <img src="/muyet-logo.png" alt="MUYET" className="h-12 w-auto" />
                        </Link>
                        <div className="h-8 w-px bg-gray-200"></div>
                        <span className="font-bold text-lg text-gray-800 tracking-tight">
                            {session?.user?.name || "Kullanıcı"} <span className="font-normal text-gray-500 text-sm ml-2">({session?.user?.email || "Belirsiz"})</span>
                        </span>
                    </div>
                </div>
            </header>

            <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">
                {/* Başlık */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Takvim</h1>
                        <p className="text-gray-500 mt-1 text-sm md:text-base">Müdürlük ve mahalle faaliyetlerini takip edin</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden w-full sm:w-auto">
                            <Link
                                href={`/takvim?ay=${currentMonth}&yil=${currentYear}&gorunum=aylik`}
                                className={`flex-1 sm:flex-none justify-center px-4 py-2 text-sm font-medium flex items-center gap-2 ${viewMode === 'aylik' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                <Grid3X3 className="h-4 w-4" />
                                Aylık
                            </Link>
                            <Link
                                href={`/takvim?gorunum=liste`}
                                className={`flex-1 sm:flex-none justify-center px-4 py-2 text-sm font-medium flex items-center gap-2 ${viewMode === 'liste' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                <List className="h-4 w-4" />
                                Liste
                            </Link>
                        </div>
                        <Link href="/dashboard" className="w-full sm:w-auto text-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            Dashboard'a Dön
                        </Link>
                    </div>
                </div>

                {/* Yeni Faaliyet Formu */}
                {canEdit && (
                    <details className="bg-white rounded-xl border border-gray-200 shadow-sm">
                        <summary className="px-6 py-4 cursor-pointer text-lg font-semibold flex items-center gap-2 hover:bg-gray-50">
                            <Plus className="h-5 w-5 text-green-600" />
                            Yeni Faaliyet Ekle
                        </summary>
                        <div className="px-6 pb-6">
                            <form action={async (formData) => {
                                'use server'
                                await createFaaliyet(formData)
                            }} className="grid md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Konu *</label>
                                    <input type="text" name="konu" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Faaliyet konusu" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">İlçe *</label>
                                    <select name="ilce" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required defaultValue={userIlce || ilceOptions[0] || ''}>
                                        {ilceOptions.map(i => (<option key={i} value={i}>{i}</option>))}
                                    </select>
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">İçerik</label>
                                    <textarea name="icerik" rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Faaliyet detayları..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tarih *</label>
                                    <input type="date" name="tarih" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Saat</label>
                                    <input type="time" name="saat" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Konum</label>
                                    <input type="text" name="konum" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Faaliyet yeri" />
                                </div>
                                <div className="overflow-hidden">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Görevli</label>
                                    <input type="text" name="gorevli" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-full" placeholder="Sorumlu kişi" />
                                </div>
                                <div className="md:col-span-2 flex items-end">
                                    <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition font-medium flex items-center gap-2">
                                        <Plus className="h-4 w-4" />
                                        Faaliyet Ekle
                                    </button>
                                </div>
                            </form>
                        </div>
                    </details>
                )}

                {viewMode === 'aylik' ? (
                    /* AYLIK TAKVİM GÖRÜNÜMÜ */
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {/* Ay Navigasyonu */}
                        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                            <Link
                                href={`/takvim?ay=${prevMonth}&yil=${prevYear}&gorunum=aylik`}
                                className="p-2 hover:bg-white/20 rounded-lg transition"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Link>
                            <h2 className="text-xl font-bold">{monthNames[currentMonth]} {currentYear}</h2>
                            <Link
                                href={`/takvim?ay=${nextMonth}&yil=${nextYear}&gorunum=aylik`}
                                className="p-2 hover:bg-white/20 rounded-lg transition"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </Link>
                        </div>

                        {/* Takvim Grid Scroll Container */}
                        <div className="overflow-x-hidden md:overflow-x-auto">
                            <div className="w-full md:min-w-[900px]"> {/* Mobilde full width, desktopta min-width */}
                                {/* Gün Başlıkları */}
                                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                                    {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(day => (
                                        <div key={day} className="px-1 py-1 md:px-2 md:py-3 text-center text-[10px] md:text-sm font-semibold text-gray-600 border-r last:border-r-0 border-gray-100">{day}</div>
                                    ))}
                                </div>

                                {/* Takvim Günleri */}
                                <div className="grid grid-cols-7">
                                    {calendarDays.map((day, idx) => {
                                        const dateKey = day.date.toISOString().split('T')[0]
                                        const dayFaaliyetler = faaliyetMap[dateKey] || []
                                        const isToday = dateKey === today

                                        return (
                                            <div
                                                key={idx}
                                                className={`min-h-[70px] md:min-h-[120px] border-b border-r border-gray-200 p-1 md:p-2 ${!day.isCurrentMonth ? 'bg-gray-50/80' : 'bg-white'} ${isToday ? 'bg-blue-50 ring-1 md:ring-2 ring-inset ring-blue-400' : ''}`}
                                            >
                                                <div className={`text-xs md:text-base font-bold mb-1 md:mb-2 ${!day.isCurrentMonth ? 'text-gray-400' : 'text-gray-800'} ${isToday ? 'text-blue-700' : ''}`}>
                                                    {day.date.getDate()}
                                                </div>
                                                <div className="space-y-1 md:space-y-1.5">
                                                    {/* Mobil Görünüm (Noktalar) */}
                                                    <div className="md:hidden flex flex-wrap gap-1">
                                                        {dayFaaliyetler.slice(0, 4).map(f => (
                                                            <Link href={`/takvim/${f.id}`} key={f.id} className="block">
                                                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                            </Link>
                                                        ))}
                                                        {dayFaaliyetler.length > 4 && (
                                                            <span className="text-[10px] text-gray-500 leading-none self-center">+{dayFaaliyetler.length - 4}</span>
                                                        )}
                                                    </div>

                                                    {/* Masaüstü Görünüm (Detaylı) */}
                                                    <div className="hidden md:block space-y-1.5">
                                                        {dayFaaliyetler.slice(0, 2).map(f => (
                                                            <div key={f.id} className="group relative">
                                                                <Link
                                                                    href={`/takvim/${f.id}`}
                                                                    className="block px-2 py-1.5 text-sm bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-md shadow-sm hover:from-blue-600 hover:to-indigo-600 transition"
                                                                >
                                                                    <div className="font-semibold truncate">{f.konu}</div>
                                                                    {f.saat && <div className="text-xs text-blue-100 mt-0.5">🕐 {f.saat.slice(0, 5)}</div>}
                                                                </Link>
                                                                {/* Tooltip Balonu */}
                                                                <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                                                                    <div className="font-bold text-base mb-2">{f.konu}</div>
                                                                    {f.konum && <div className="flex items-center gap-2 mb-1"><span className="text-blue-300">📍</span> {f.konum}</div>}
                                                                    {f.saat && <div className="flex items-center gap-2 mb-1"><span className="text-yellow-300">🕐</span> {f.saat}</div>}
                                                                    {f.gorevli && <div className="flex items-center gap-2"><span className="text-green-300">👤</span> {f.gorevli}</div>}
                                                                    {!f.konum && !f.gorevli && !f.saat && <div className="text-gray-400 text-xs">Detay için tıklayın</div>}
                                                                    <div className="absolute left-4 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-900"></div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {dayFaaliyetler.length > 2 && (
                                                            <div className="text-sm font-medium text-blue-600 px-2">+{dayFaaliyetler.length - 2} faaliyet daha</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* LİSTE GÖRÜNÜMÜ */
                    <div className="space-y-4">
                        {Object.keys(faaliyetMap).length === 0 ? (
                            <div className="bg-white p-12 rounded-xl border border-gray-200 text-center">
                                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">Henüz planlanmış faaliyet bulunmamaktadır.</p>
                            </div>
                        ) : (
                            Object.entries(faaliyetMap)
                                .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                                .map(([date, faaliyetlerByDate]) => (
                                    <div key={date} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                        <div className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold">
                                            {new Date(date).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </div>
                                        <div className="divide-y divide-gray-100">
                                            {faaliyetlerByDate.map((f) => (
                                                <div key={f.id} className="p-4 hover:bg-gray-50 transition">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <Link href={`/takvim/${f.id}`} className="font-semibold text-gray-900 hover:text-blue-600 text-lg">
                                                                {f.konu}
                                                            </Link>
                                                            {f.icerik && (<p className="text-gray-600 mt-1">{f.icerik}</p>)}
                                                            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                                                                {f.saat && (<span className="flex items-center gap-1"><Clock className="h-4 w-4" />{f.saat}</span>)}
                                                                {f.konum && (<span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{f.konum}</span>)}
                                                                {f.gorevli && (<span className="flex items-center gap-1"><User className="h-4 w-4" />{f.gorevli}</span>)}
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">{f.ilce}</span>
                                                            </div>
                                                        </div>
                                                        {canEdit && (
                                                            <div className="flex items-center gap-2 ml-4">
                                                                <Link href={`/takvim/${f.id}`} className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition">Düzenle</Link>
                                                                <form action={async () => { 'use server'; await deleteFaaliyet(f.id) }}>
                                                                    <button type="submit" className="p-1 text-red-500 hover:bg-red-50 rounded transition" title="Sil">
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </button>
                                                                </form>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
