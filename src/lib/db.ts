import { Pool } from 'pg'

// Connection pool - reused across requests
const globalForDb = globalThis as unknown as { pool: Pool }

export const pool = globalForDb.pool || new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
})

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool

// Helper function to run queries with proper error handling
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const client = await pool.connect()
    try {
        const result = await client.query(text, params)
        return result.rows as T[]
    } finally {
        client.release()
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
