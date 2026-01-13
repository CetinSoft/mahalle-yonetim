import { auth } from "@/auth"
import { queryOne, query, Citizen, Gorusme } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, User, Phone, MapPin, Briefcase, Calendar, Info, Heart, MessageCircle } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import GorusmeForm from "@/components/GorusmeForm"

export default async function CitizenDetailPage({ params }: { params: { id: string } }) {
    const session = await auth()
    const { id } = await params

    const citizen = await queryOne<Citizen>(
        'SELECT * FROM "Citizen" WHERE id = $1',
        [id]
    )

    if (!citizen) {
        notFound()
    }

    // Görüşme geçmişini getir
    const gorusmeler = await query<Gorusme>(
        'SELECT * FROM "Gorusme" WHERE "citizenId" = $1 ORDER BY "gorusmeTarihi" DESC',
        [id]
    )

    // Helper to render a data row
    const DetailRow = ({ icon: Icon, label, value, color = "text-gray-500" }: { icon: any, label: string, value?: string | null, color?: string }) => (
        <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className={`mt-1 p-2 rounded-full bg-white shadow-sm ${color}`}>
                <Icon size={18} />
            </div>
            <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
                <span className="text-gray-900 font-medium mt-1">{value || '-'}</span>
            </div>
        </div>
    )

    // Sonuç badge renkleri
    const getSonucStyle = (sonuc: string) => {
        switch (sonuc) {
            case 'olumlu':
                return 'bg-green-50 text-green-700 border-green-200'
            case 'olumsuz':
                return 'bg-red-50 text-red-700 border-red-200'
            default:
                return 'bg-gray-50 text-gray-700 border-gray-200'
        }
    }

    const getSonucLabel = (sonuc: string) => {
        switch (sonuc) {
            case 'olumlu': return 'Olumlu'
            case 'olumsuz': return 'Olumsuz'
            default: return 'Belirsiz'
        }
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

            <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
                <Link href="/uyeler" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Listeye Dön
                </Link>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Main Profile Card */}
                    <Card className="md:col-span-1 shadow-xl border-t-4 border-t-blue-600 h-fit">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto bg-blue-100 p-4 rounded-full w-fit mb-4">
                                <User className="h-12 w-12 text-blue-600" />
                            </div>
                            <CardTitle className="text-xl font-bold">{citizen.ad} {citizen.soyad}</CardTitle>
                            <CardDescription className="text-sm font-medium text-blue-600">
                                {citizen.meslek || 'Meslek Belirtilmemiş'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="flex flex-col gap-3">
                                {citizen.telefon && (
                                    <a href={`tel:${citizen.telefon}`} className="flex items-center justify-center gap-2 w-full py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-md font-medium transition-colors">
                                        <Phone size={16} />
                                        Ara: {citizen.telefon}
                                    </a>
                                )}
                                <div className={`text-center px-3 py-1 rounded-full text-xs font-bold border ${citizen.yargitayDurumu?.includes('AKTİF') ? 'bg-green-50 text-green-700 border-green-200' :
                                    citizen.yargitayDurumu?.includes('ONAMA') || citizen.yargitayDurumu?.includes('İSTİFA') ? 'bg-red-50 text-red-700 border-red-200' :
                                        'bg-gray-50 text-gray-700 border-gray-200'
                                    }`}>
                                    {citizen.yargitayDurumu || 'Yargıtay Durumu Yok'}
                                </div>

                                {/* Görüşme Özeti */}
                                <div className="mt-2 pt-3 border-t border-gray-100">
                                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Görüşme</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-700">
                                            {gorusmeler.length} görüşme
                                        </span>
                                        {gorusmeler.length > 0 && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${getSonucStyle(gorusmeler[0].sonuc)}`}>
                                                Son: {getSonucLabel(gorusmeler[0].sonuc)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Details Grid */}
                    <div className="md:col-span-2 space-y-6">
                        <Card className="shadow-md">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
                                    <Info size={20} className="text-blue-500" />
                                    Kişisel Bilgiler
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DetailRow icon={User} label="Baba Adı" value={citizen.babaAdi} color="text-blue-500" />
                                <DetailRow icon={User} label="Anne Adı" value={citizen.anneAdi} color="text-pink-500" />
                                <DetailRow icon={Calendar} label="Doğum Tarihi / Yeri" value={`${citizen.dogumTarihi || '-'} / ${citizen.dogumYeri || ''}`} color="text-purple-500" />
                                <DetailRow icon={Heart} label="Medeni / Cinsiyet" value={citizen.cinsiyet} color="text-red-500" />
                                <DetailRow icon={Briefcase} label="Tahsil" value={citizen.tahsil} color="text-yellow-600" />
                                <DetailRow icon={User} label="Kan Grubu" value={citizen.kanGrubu} color="text-red-600" />
                            </CardContent>
                        </Card>

                        <Card className="shadow-md">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
                                    <MapPin size={20} className="text-green-500" />
                                    İletişim ve Diğer
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <DetailRow icon={MapPin} label="Adres" value={citizen.adres} color="text-green-600" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <DetailRow icon={Info} label="Mahalle" value={citizen.mahalle} />
                                    <DetailRow icon={Info} label="İlçe" value={citizen.ilce} />
                                    <DetailRow icon={Info} label="Sandık No" value={citizen.sandikNo} />
                                    <DetailRow icon={Info} label="Üye Yapan" value={citizen.uyeYapan} />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Görüşme Ekle */}
                        <Card className="shadow-md border-t-4 border-t-purple-500">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
                                    <MessageCircle size={20} className="text-purple-500" />
                                    Yeni Görüşme Ekle
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <GorusmeForm citizenId={id} citizenName={`${citizen.ad} ${citizen.soyad}`} />
                            </CardContent>
                        </Card>

                        {/* Görüşme Geçmişi */}
                        <Card className="shadow-md">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
                                    <MessageCircle size={20} className="text-indigo-500" />
                                    Görüşme Geçmişi ({gorusmeler.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {gorusmeler.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <MessageCircle size={40} className="mx-auto mb-3 text-gray-300" />
                                        <p>Henüz görüşme kaydı yok</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {gorusmeler.map((g) => (
                                            <div key={g.id} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-900">
                                                            {new Date(g.gorusmeTarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                        </span>
                                                        <span className="text-xs text-gray-400 ml-2">
                                                            {g.gorusmeYapan}
                                                        </span>
                                                    </div>
                                                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getSonucStyle(g.sonuc)}`}>
                                                        {getSonucLabel(g.sonuc)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600">{g.aciklama}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}

