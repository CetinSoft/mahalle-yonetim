import { auth, signOut } from "@/auth"
import { isAdminTC, getUserIlces } from "@/lib/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogOut, ArrowLeft } from "lucide-react"
import SMSInterface from "./SMSInterface"

export default async function SMSPage() {
    const session = await auth()
    const tcNo = session?.user?.image
    const isSuperAdmin = isAdminTC(tcNo)

    // Check authorization
    const userIlces = await getUserIlces(tcNo)
    const isDistrictAdmin = userIlces.length > 0

    if (!isSuperAdmin && !isDistrictAdmin) {
        redirect('/dashboard')
    }

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white border-b border-gray-200/60 shadow-sm backdrop-blur-md bg-white/80 supports-[backdrop-filter]:bg-white/60">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard">
                            <img
                                src="/muyet-logo.png"
                                alt="MUYET"
                                className="h-8 md:h-12 w-auto"
                            />
                        </Link>
                        <div className="h-8 w-px bg-gray-200 hidden md:block"></div>
                        <span className="font-bold text-sm md:text-lg text-gray-800 tracking-tight">
                            {session?.user?.name || "Kullanıcı"} <span className="font-normal text-gray-500 text-sm ml-2 hidden md:inline">({session?.user?.email || "Mahalle Belirsiz"})</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/uyeler" className="flex items-center gap-2 px-2 md:px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition">
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden md:inline">Üyeler</span>
                        </Link>
                        <form
                            action={async () => {
                                "use server"
                                await signOut({ redirectTo: "/login" })
                            }}
                        >
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                <LogOut className="h-4 w-4 md:mr-2" />
                                <span className="hidden md:inline">Çıkış</span>
                            </Button>
                        </form>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6 max-w-7xl">
                <div className="space-y-6">
                    {/* Admin Badge */}
                    {isSuperAdmin && (
                        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 text-white shadow-lg flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
                            </div>
                            <div>
                                <span className="font-bold">Yönetici Modu</span>
                                <span className="text-purple-200 ml-2 text-sm">Tam yetkili erişim</span>
                            </div>
                        </div>
                    )}

                    {/* Page Title */}
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                            📱 Toplu SMS Gönder
                        </h1>
                        <div className="flex items-center gap-3">
                            <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:underline">
                                🏠 Dashboard (Anasayfa)
                            </Link>
                            <Link href="/uyeler" className="text-sm font-medium text-blue-600 hover:underline">
                                👥 Üyeler Listesi
                            </Link>
                        </div>
                    </div>

                    {/* SMS Interface Component */}
                    <SMSInterface isSuperAdmin={isSuperAdmin} />
                </div>
            </div>
        </div>
    )
}
