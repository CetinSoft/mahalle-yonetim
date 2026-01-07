import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { authConfig } from "./auth.config"

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            credentials: {
                tcNo: {},
                password: {},
            },
            authorize: async (credentials) => {
                const tcNo = credentials.tcNo as string
                const password = credentials.password as string

                if (!tcNo || !password) {
                    throw new Error("TC Kimlik No ve Şifre gerekli.")
                }

                // Hardcoded Admin for Seeding (Requested by User)
                if (tcNo === '48316184410' && password === '145399') {
                    return {
                        id: 'admin-seed-user',
                        name: 'Admin Seeder',
                        email: 'System Admin',
                        image: '48316184410',
                    }
                }

                // Find citizen by TC
                const citizen = await prisma.citizen.findUnique({
                    where: { tcNo },
                })

                if (!citizen) {
                    throw new Error("Kayıt bulunamadı.")
                }

                // Verify Password
                // Logic: Last 4 digits of TC
                // Example: TC 48316184410 -> Password "4410"

                const expectedPassword = tcNo.slice(-4)

                // Check against expected format
                if (password !== expectedPassword) {
                    throw new Error("Hatalı şifre.")
                }

                return {
                    id: citizen.id,
                    name: `${citizen.ad} ${citizen.soyad}`,
                    email: citizen.mahalle,
                    image: citizen.tcNo,
                }
            },
        }),
    ],
})
