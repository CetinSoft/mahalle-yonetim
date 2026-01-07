'use server'

import { auth } from "@/auth"
import { query, Gorusme } from "@/lib/db"
import { revalidatePath } from "next/cache"

// Görüşme oluştur
export async function createGorusme(formData: FormData): Promise<{ success?: boolean; error?: string }> {
    const session = await auth()
    if (!session?.user) {
        return { error: "Yetkisiz işlem" }
    }

    const citizenId = formData.get('citizenId') as string
    const aciklama = formData.get('aciklama') as string
    const sonuc = formData.get('sonuc') as 'olumlu' | 'olumsuz' | 'belirsiz'
    const gorusmeTarihi = formData.get('gorusmeTarihi') as string

    if (!citizenId || !aciklama || !sonuc) {
        return { error: "Tüm alanlar zorunludur" }
    }

    const gorusmeYapan = session.user.name || session.user.email || "Bilinmiyor"

    try {
        await query(
            `INSERT INTO "Gorusme" (id, "citizenId", "gorusmeYapan", "gorusmeTarihi", aciklama, sonuc, "createdAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
            [citizenId, gorusmeYapan, gorusmeTarihi ? new Date(gorusmeTarihi) : new Date(), aciklama, sonuc]
        )

        revalidatePath('/dashboard')
        revalidatePath(`/citizen/${citizenId}`)
        return { success: true }
    } catch (error) {
        console.error("Görüşme ekleme hatası:", error)
        return { error: "Görüşme eklenirken hata oluştu" }
    }
}

// Kişinin görüşmelerini getir
export async function getGorusmeler(citizenId: string): Promise<Gorusme[]> {
    try {
        const gorusmeler = await query<Gorusme>(
            `SELECT * FROM "Gorusme" WHERE "citizenId" = $1 ORDER BY "gorusmeTarihi" DESC`,
            [citizenId]
        )
        return gorusmeler
    } catch (error) {
        console.error("Görüşme listeleme hatası:", error)
        return []
    }
}

// Son görüşme bilgisini getir (dashboard için)
export async function getLastGorusme(citizenId: string): Promise<Gorusme | null> {
    try {
        const result = await query<Gorusme>(
            `SELECT * FROM "Gorusme" WHERE "citizenId" = $1 ORDER BY "gorusmeTarihi" DESC LIMIT 1`,
            [citizenId]
        )
        return result[0] || null
    } catch (error) {
        return null
    }
}

// Tüm görüşmeleri getir (admin için)
export async function getAllGorusmeler(): Promise<Gorusme[]> {
    try {
        const gorusmeler = await query<Gorusme>(
            `SELECT g.*, c.ad as "citizenAd", c.soyad as "citizenSoyad"
             FROM "Gorusme" g
             JOIN "Citizen" c ON c.id = g."citizenId"
             ORDER BY g."gorusmeTarihi" DESC
             LIMIT 100`
        )
        return gorusmeler
    } catch (error) {
        console.error("Tüm görüşmeleri listeleme hatası:", error)
        return []
    }
}
