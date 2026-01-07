import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// Enable WebSocket for local development (not needed on Vercel)
if (typeof WebSocket === 'undefined') {
    neonConfig.webSocketConstructor = ws
}

// Database connection string - hardcoded as requested
const DATABASE_URL = "postgresql://neondb_owner:npg_ocWPFCf1Q6hg@ep-bitter-mountain-a481q9of-pooler.us-east-1.aws.neon.tech/saadetuye?sslmode=require"

// Create connection pool
const pool = new Pool({ connectionString: DATABASE_URL })

// Helper function to run queries
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
    try {
        const result = await pool.query(text, params)
        return result.rows as T[]
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

export interface InvitationWithCitizen extends Invitation {
    citizen: Citizen
}
