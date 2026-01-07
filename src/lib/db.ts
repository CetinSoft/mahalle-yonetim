import { neon } from '@neondatabase/serverless'

// Create a SQL function using Neon's serverless driver
// This is optimized for serverless environments like Vercel
const sql = neon(process.env.DATABASE_URL!)

// Helper function to run queries with proper error handling
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
    try {
        const result = await sql(text, params || [])
        return result as T[]
    } catch (error) {
        console.error('Database query error:', error)
        throw error
    }
}

// Helper for single row queries
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await query<T>(text, params)
    return rows[0] || null
}

// Types matching the database schema
export interface Citizen {
    id: string
    tcNo: string
    ad: string
    soyad: string
    telefon: string | null
    uyeDurumu: string | null
    adres: string | null
    mahalle: string
    ilce: string | null
    anneAdi: string | null
    babaAdi: string | null
    cinsiyet: string | null
    meslek: string | null
    tahsil: string | null
    yargitayDurumu: string | null
    dogumTarihi: string | null
    dogumYeri: string | null
    sandikNo: string | null
    kanGrubu: string | null
    kararNo: string | null
    kararTarihi: string | null
    uyeKayitTarihi: string | null
    gorevi: string | null
    smsIstiyorum: string | null
    uyeYapan: string | null
    password: string | null
    createdAt: Date
    updatedAt: Date
}

export interface Event {
    id: string
    title: string
    date: Date
    isActive: boolean
    createdAt: Date
}

export interface Invitation {
    id: string
    citizenId: string
    eventId: string
    invitedBy: string
    invitedAt: Date
}

// Invitation with joined citizen data
export interface InvitationWithCitizen extends Invitation {
    citizen: Citizen
}
