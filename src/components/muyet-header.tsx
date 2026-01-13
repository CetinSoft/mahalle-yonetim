'use client'

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface MuyetHeaderProps {
    userName?: string
    userMahalle?: string
}

export function MuyetHeader({ userName, userMahalle }: MuyetHeaderProps) {
    return (
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200/60 shadow-sm backdrop-blur-md bg-white/80 supports-[backdrop-filter]:bg-white/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <img
                            src="/muyet-logo.png"
                            alt="MUYET"
                            className="h-10 w-auto"
                        />
                    </Link>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <span className="font-bold text-lg text-gray-800 tracking-tight">
                        {userName || "Kullanıcı"} <span className="font-normal text-gray-500 text-sm ml-2">({userMahalle || "Mahalle Belirsiz"})</span>
                    </span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                >
                    <LogOut className="h-4 w-4 mr-2" />
                    Çıkış
                </Button>
            </div>
        </header>
    )
}
