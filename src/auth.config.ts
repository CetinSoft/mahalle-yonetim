import type { NextAuthConfig } from "next-auth"

// Edge-compatible auth config (no database adapters)
export const authConfig = {
    pages: {
        signIn: "/login",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard')
            const isOnUpload = nextUrl.pathname.startsWith('/upload')
            const isOnAdmin = nextUrl.pathname.startsWith('/admin')
            const isOnCitizen = nextUrl.pathname.startsWith('/citizen')
            const isOnLogin = nextUrl.pathname.startsWith('/login')

            // Protected routes
            if (isOnDashboard || isOnUpload || isOnAdmin || isOnCitizen) {
                return isLoggedIn // Redirect to login if not logged in
            }

            // Redirect logged-in users away from login
            if (isOnLogin && isLoggedIn) {
                return Response.redirect(new URL('/dashboard', nextUrl))
            }

            return true
        },
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub
            }
            return session
        },
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id
            }
            return token
        }
    },
    providers: [], // Providers added in auth.ts
} satisfies NextAuthConfig
