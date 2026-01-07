import { auth } from "@/auth"
import { queryOne, Citizen } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, User, Phone, MapPin, Briefcase, Calendar, Info, Heart } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function CitizenDetailPage({ params }: { params: { id: string } }) {
    const { id } = await params

    const citizen = await queryOne<Citizen>(
        'SELECT * FROM "Citizen" WHERE id = $1',
        [id]
    )

    if (!citizen) {
        notFound()
    }

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

    return (
        <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
            <Link href="/dashboard" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors">
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
                </div>
            </div>
        </div>
    )
}
