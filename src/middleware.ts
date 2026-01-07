import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

// Lightweight middleware export that uses Edge-compatible config
export const { auth: middleware } = NextAuth(authConfig)

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
