'use server'

import { auth } from "@/auth"
import { query, queryOne, Citizen } from "@/lib/db"
import { isAdminTC, getUserIlces, getDistrictMahalles } from "@/lib/admin"
import { revalidatePath } from "next/cache"

// Arama görevi interface
export interface AramaGorevi {
    id: string
    citizenId: string
    mahalle: string
    hafta: string
    atayan: string
    atayanAdi: string
    durum: string
    arandiBilgi: string | null
    aranmaTarihi: Date | null
    createdAt: Date
    updatedAt: Date
}

export interface AramaGoreviWithCitizen extends AramaGorevi {
    citizenAd: string
    citizenSoyad: string
    citizenTelefon: string | null
}

// Mevcut hafta string formatı: "2026-W03"
export async function getCurrentWeek(): Promise<string> {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7)
    return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`
}

// Yetki kontrolü: Admin veya ilçe yöneticisi mi?
async function checkAdminOrDistrictAuth(tcNo: string | null | undefined, mahalle?: string): Promise<{ authorized: boolean; error?: string }> {
    if (!tcNo) return { authorized: false, error: "Oturum bulunamadı" }

    // Süper admin her şeyi yapabilir
    if (isAdminTC(tcNo)) return { authorized: true }

    // İlçe yöneticisi kontrolü
    const userIlces = await getUserIlces(tcNo)
    if (userIlces.length === 0) {
        return { authorized: false, error: "Bu işlem için yetkiniz yok" }
    }

    // Mahalle belirtildiyse, bu mahallenin ilçe yöneticisinin yetkisinde olup olmadığını kontrol et
    if (mahalle) {
        const mahalleIlce = await queryOne<{ ilce: string }>(
            'SELECT ilce FROM "Citizen" WHERE mahalle = $1 LIMIT 1',
            [mahalle]
        )
        if (mahalleIlce && !userIlces.includes(mahalleIlce.ilce)) {
            return { authorized: false, error: "Bu mahalle için yetkiniz yok" }
        }
    }

    return { authorized: true }
}

// Random arama görevleri oluştur
export async function createAramaGorevleri(formData: FormData): Promise<{ success?: boolean; error?: string; count?: number }> {
    const session = await auth()
    const tcNo = session?.user?.image

    const mahalle = formData.get('mahalle') as string
    const sayi = parseInt(formData.get('sayi') as string, 10) || 10

    if (!mahalle) {
        return { error: "Mahalle seçimi zorunludur" }
    }

    // Yetki kontrolü
    const authCheck = await checkAdminOrDistrictAuth(tcNo, mahalle)
    if (!authCheck.authorized) {
        return { error: authCheck.error }
    }

    const hafta = await getCurrentWeek()
    const atayanAdi = session?.user?.name || "Bilinmiyor"

    try {
        // Bu hafta zaten görev atanmış kişileri hariç tut
        const existingIds = await query<{ citizenId: string }>(
            'SELECT "citizenId" FROM "AramaGorevi" WHERE mahalle = $1 AND hafta = $2',
            [mahalle, hafta]
        )
        const excludeIds = existingIds.map(e => e.citizenId)

        // Mahallede telefonu olan random kişileri seç
        let randomQuery = `
            SELECT id FROM "Citizen" 
            WHERE mahalle = $1 
            AND telefon IS NOT NULL 
            AND telefon != ''
        `
        const params: any[] = [mahalle]

        if (excludeIds.length > 0) {
            randomQuery += ` AND id NOT IN (${excludeIds.map((_, i) => `$${i + 2}`).join(',')})`
            params.push(...excludeIds)
        }

        randomQuery += ` ORDER BY RANDOM() LIMIT $${params.length + 1}`
        params.push(sayi)

        const randomCitizens = await query<{ id: string }>(randomQuery, params)

        if (randomCitizens.length === 0) {
            return { error: "Bu mahallede uygun kişi bulunamadı" }
        }

        // Görevleri oluştur
        for (const citizen of randomCitizens) {
            await query(
                `INSERT INTO "AramaGorevi" (id, "citizenId", mahalle, hafta, atayan, "atayanAdi", durum, "createdAt", "updatedAt")
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'bekliyor', NOW(), NOW())
                 ON CONFLICT ("citizenId", hafta) DO NOTHING`,
                [citizen.id, mahalle, hafta, tcNo, atayanAdi]
            )
        }

        revalidatePath('/admin/arama-gorevleri')
        return { success: true, count: randomCitizens.length }
    } catch (error) {
        console.error("Arama görevi oluşturma hatası:", error)
        return { error: "Görev oluşturulurken hata oluştu" }
    }
}

// Mahalle bazında arama görevlerini getir
export async function getMahalleAramaGorevleri(mahalle: string, hafta?: string): Promise<AramaGoreviWithCitizen[]> {
    const currentHafta = hafta || await getCurrentWeek()

    try {
        const gorevler = await query<AramaGoreviWithCitizen>(
            `SELECT g.*, c.ad as "citizenAd", c.soyad as "citizenSoyad", c.telefon as "citizenTelefon"
             FROM "AramaGorevi" g
             JOIN "Citizen" c ON c.id = g."citizenId"
             WHERE g.mahalle = $1 AND g.hafta = $2
             ORDER BY g."createdAt" DESC`,
            [mahalle, currentHafta]
        )
        return gorevler
    } catch (error) {
        console.error("Arama görevleri listeleme hatası:", error)
        return []
    }
}

// Tüm arama görevlerini getir (admin için)
export async function getTumAramaGorevleri(hafta?: string, mahalle?: string): Promise<AramaGoreviWithCitizen[]> {
    const currentHafta = hafta || await getCurrentWeek()

    try {
        let queryStr = `
            SELECT g.*, c.ad as "citizenAd", c.soyad as "citizenSoyad", c.telefon as "citizenTelefon"
            FROM "AramaGorevi" g
            JOIN "Citizen" c ON c.id = g."citizenId"
            WHERE g.hafta = $1
        `
        const params: any[] = [currentHafta]

        if (mahalle) {
            queryStr += ' AND g.mahalle = $2'
            params.push(mahalle)
        }

        queryStr += ' ORDER BY g.mahalle, g."createdAt" DESC'

        const gorevler = await query<AramaGoreviWithCitizen>(queryStr, params)
        return gorevler
    } catch (error) {
        console.error("Tüm arama görevleri listeleme hatası:", error)
        return []
    }
}

// Görev durumunu güncelle
export async function updateAramaGoreviDurum(formData: FormData): Promise<{ success?: boolean; error?: string }> {
    const session = await auth()
    if (!session?.user) {
        return { error: "Yetkisiz işlem" }
    }

    const gorevId = formData.get('gorevId') as string
    const durum = formData.get('durum') as string
    const not = formData.get('not') as string

    if (!gorevId || !durum) {
        return { error: "Gerekli alanlar eksik" }
    }

    try {
        await query(
            `UPDATE "AramaGorevi" 
             SET durum = $1, "arandiBilgi" = $2, "aranmaTarihi" = NOW(), "updatedAt" = NOW()
             WHERE id = $3`,
            [durum, not || null, gorevId]
        )

        revalidatePath('/admin/arama-gorevleri')
        revalidatePath('/dashboard')
        return { success: true }
    } catch (error) {
        console.error("Görev güncelleme hatası:", error)
        return { error: "Güncelleme sırasında hata oluştu" }
    }
}

// Mahalle istatistikleri (haftalık)
export async function getAramaGoreviStats(hafta?: string): Promise<{ mahalle: string; toplam: number; arandi: number; bekliyor: number }[]> {
    const currentHafta = hafta || await getCurrentWeek()

    try {
        const stats = await query<{ mahalle: string; toplam: string; arandi: string; bekliyor: string }>(
            `SELECT 
                mahalle,
                COUNT(*) as toplam,
                COUNT(*) FILTER (WHERE durum = 'arandi') as arandi,
                COUNT(*) FILTER (WHERE durum = 'bekliyor') as bekliyor
             FROM "AramaGorevi"
             WHERE hafta = $1
             GROUP BY mahalle
             ORDER BY mahalle`,
            [currentHafta]
        )
        return stats.map(s => ({
            mahalle: s.mahalle,
            toplam: parseInt(s.toplam, 10),
            arandi: parseInt(s.arandi, 10),
            bekliyor: parseInt(s.bekliyor, 10)
        }))
    } catch (error) {
        console.error("Arama görevi istatistik hatası:", error)
        return []
    }
}

// Kullanıcının erişebileceği mahalleleri getir
export async function getAccessibleMahalles(): Promise<string[]> {
    const session = await auth()
    const tcNo = session?.user?.image

    if (!tcNo) return []

    // Süper admin tüm mahalleleri görebilir
    if (isAdminTC(tcNo)) {
        const allMahalles = await query<{ mahalle: string }>(
            'SELECT DISTINCT mahalle FROM "Citizen" WHERE mahalle IS NOT NULL AND mahalle != \'\' ORDER BY mahalle'
        )
        return allMahalles.map(m => m.mahalle)
    }

    // İlçe yöneticisi kendi ilçelerindeki mahalleleri görebilir
    const userIlces = await getUserIlces(tcNo)
    if (userIlces.length > 0) {
        const mahalles: string[] = []
        for (const ilce of userIlces) {
            const districtMahalles = await getDistrictMahalles(ilce)
            mahalles.push(...districtMahalles)
        }
        return [...new Set(mahalles)].sort()
    }

    return []
}

// Mahalle bazında görevleri sil
export async function deleteMahalleGorevleri(formData: FormData): Promise<{ success?: boolean; error?: string; count?: number }> {
    const session = await auth()
    const tcNo = session?.user?.image

    const mahalle = formData.get('mahalle') as string
    const hafta = formData.get('hafta') as string || await getCurrentWeek()

    if (!mahalle) {
        return { error: "Mahalle seçimi zorunludur" }
    }

    // Yetki kontrolü
    const authCheck = await checkAdminOrDistrictAuth(tcNo, mahalle)
    if (!authCheck.authorized) {
        return { error: authCheck.error }
    }

    try {
        const result = await query(
            'DELETE FROM "AramaGorevi" WHERE mahalle = $1 AND hafta = $2',
            [mahalle, hafta]
        )

        revalidatePath('/admin/arama-gorevleri')
        return { success: true }
    } catch (error) {
        console.error("Görev silme hatası:", error)
        return { error: "Silme sırasında hata oluştu" }
    }
}
