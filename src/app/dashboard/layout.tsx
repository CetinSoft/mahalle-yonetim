import { auth, signOut } from "@/auth"
import { Button } from "@/components/ui/button"
import { LogOut, User } from "lucide-react"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    return (
        <div className="min-h-screen bg-gray-50/50">
            <header className="sticky top-0 z-10 bg-white border-b border-gray-200/60 shadow-sm backdrop-blur-md bg-white/80 supports-[backdrop-filter]:bg-white/60">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <img
                            src="/muyet-logo.png"
                            alt="MUYET"
                            className="h-12 w-auto"
                        />
                        <div className="h-8 w-px bg-gray-200"></div>
                        <span className="font-bold text-lg text-gray-800 tracking-tight">
                            {session?.user?.name || "Kullanıcı Paneli"} <span className="font-normal text-gray-500 text-sm ml-2">({session?.user?.email || "Mahalle Belirsiz"})</span>
                        </span>
                    </div>
                    <form
                        action={async () => {
                            "use server"
                            await signOut({ redirectTo: "/login" })
                        }}
                    >
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <LogOut className="h-4 w-4 mr-2" />
                            Çıkış
                        </Button>
                    </form>
                </div>
            </header>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    )
}
