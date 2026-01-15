'use server'

import { auth } from "@/auth"
import { query, queryOne } from "@/lib/db"
import { isAdminTC, getUserIlces } from "@/lib/admin"
import { revalidatePath } from "next/cache"

// Toplantı Kararı interface
export interface ToplantiKarari {
    id: string
    kararNo: string
    kararIcerik: string
    sorumluKisiler: string
    baslangicTarihi: Date
    terminTarihi: Date
    durum: 'beklemede' | 'devam_ediyor' | 'tamamlandi'
    olusturanTc: string
    olusturanAdi: string
    createdAt: Date
    updatedAt: Date
}

// Yetki kontrolü: Admin veya ilçe yöneticisi mi?
async function checkDistrictAuth(tcNo: string | null | undefined): Promise<{ authorized: boolean; error?: string }> {
    if (!tcNo) return { authorized: false, error: "Oturum bulunamadı" }

    // Süper admin her şeyi yapabilir
    if (isAdminTC(tcNo)) return { authorized: true }

    // İlçe yöneticisi kontrolü
    const userIlces = await getUserIlces(tcNo)
    if (userIlces.length === 0) {
        return { authorized: false, error: "Bu işlem için yetkiniz yok" }
    }

    return { authorized: true }
}

// Otomatik karar numarası getir (YIL-NN formatında)
export async function getNextKararNo(): Promise<string> {
    const currentYear = new Date().getFullYear()

    try {
        // Bu yıla ait en son karar numarasını bul
        const lastKarar = await queryOne<{ kararNo: string }>(
            `SELECT "kararNo" FROM "ToplantiKarari" 
             WHERE "kararNo" LIKE $1 
             ORDER BY "kararNo" DESC LIMIT 1`,
            [`${currentYear}-%`]
        )

        if (lastKarar) {
            // `2026-05` formatından sayıyı al
            const parts = lastKarar.kararNo.split('-')
            if (parts.length === 2) {
                const lastNumber = parseInt(parts[1], 10)
                const nextNumber = (lastNumber + 1).toString().padStart(2, '0')
                return `${currentYear}-${nextNumber}`
            }
        }

        // İlk karar
        return `${currentYear}-01`
    } catch (error) {
        console.error("Karar numarası oluşturma hatası:", error)
        return `${currentYear}-01`
    }
}

// Yeni karar oluştur
export async function createKarar(formData: FormData): Promise<{ success?: boolean; error?: string }> {
    const session = await auth()
    const tcNo = session?.user?.image

    // Yetki kontrolü
    const authCheck = await checkDistrictAuth(tcNo)
    if (!authCheck.authorized) {
        return { error: authCheck.error }
    }

    const kararNo = formData.get('kararNo') as string
    const kararIcerik = formData.get('kararIcerik') as string
    const sorumluKisiler = formData.get('sorumluKisiler') as string
    const baslangicTarihi = formData.get('baslangicTarihi') as string
    const terminTarihi = formData.get('terminTarihi') as string

    if (!kararNo || !kararIcerik || !sorumluKisiler || !terminTarihi) {
        return { error: "Tüm alanlar zorunludur" }
    }

    const olusturanAdi = session?.user?.name || "Bilinmiyor"

    try {
        await query(
            `INSERT INTO "ToplantiKarari" (id, "kararNo", "kararIcerik", "sorumluKisiler", "baslangicTarihi", "terminTarihi", durum, "olusturanTc", "olusturanAdi", "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'beklemede', $6, $7, NOW(), NOW())`,
            [kararNo, kararIcerik, sorumluKisiler, baslangicTarihi || new Date().toISOString(), terminTarihi, tcNo, olusturanAdi]
        )

        revalidatePath('/admin/kararlar')
        return { success: true }
    } catch (error) {
        console.error("Karar oluşturma hatası:", error)
        return { error: "Karar oluşturulurken hata oluştu" }
    }
}

// Karar durumunu güncelle
export async function updateKararDurum(formData: FormData): Promise<{ success?: boolean; error?: string }> {
    const session = await auth()
    const tcNo = session?.user?.image

    // Yetki kontrolü
    const authCheck = await checkDistrictAuth(tcNo)
    if (!authCheck.authorized) {
        return { error: authCheck.error }
    }

    const kararId = formData.get('kararId') as string
    const durum = formData.get('durum') as string

    if (!kararId || !durum) {
        return { error: "Gerekli alanlar eksik" }
    }

    try {
        await query(
            `UPDATE "ToplantiKarari" SET durum = $1, "updatedAt" = NOW() WHERE id = $2`,
            [durum, kararId]
        )

        revalidatePath('/admin/kararlar')
        return { success: true }
    } catch (error) {
        console.error("Karar güncelleme hatası:", error)
        return { error: "Güncelleme sırasında hata oluştu" }
    }
}

// Karar sil
export async function deleteKarar(formData: FormData): Promise<{ success?: boolean; error?: string }> {
    const session = await auth()
    const tcNo = session?.user?.image

    // Yetki kontrolü
    const authCheck = await checkDistrictAuth(tcNo)
    if (!authCheck.authorized) {
        return { error: authCheck.error }
    }

    const kararId = formData.get('kararId') as string

    if (!kararId) {
        return { error: "Karar ID gerekli" }
    }

    try {
        await query('DELETE FROM "ToplantiKarari" WHERE id = $1', [kararId])

        revalidatePath('/admin/kararlar')
        return { success: true }
    } catch (error) {
        console.error("Karar silme hatası:", error)
        return { error: "Silme sırasında hata oluştu" }
    }
}

// Tüm kararları getir
export async function getKararlar(durum?: string): Promise<ToplantiKarari[]> {
    try {
        let queryStr = 'SELECT * FROM "ToplantiKarari"'
        const params: any[] = []

        if (durum && durum !== 'tumu') {
            queryStr += ' WHERE durum = $1'
            params.push(durum)
        }

        queryStr += ' ORDER BY "terminTarihi" ASC, "createdAt" DESC'

        const kararlar = await query<ToplantiKarari>(queryStr, params)
        return kararlar
    } catch (error) {
        console.error("Kararlar listeleme hatası:", error)
        return []
    }
}

// İstatistikleri getir
export async function getKararStats(): Promise<{ toplam: number; beklemede: number; devamEdiyor: number; tamamlandi: number }> {
    try {
        const stats = await queryOne<{ toplam: string; beklemede: string; devam_ediyor: string; tamamlandi: string }>(
            `SELECT 
                COUNT(*) as toplam,
                COUNT(*) FILTER (WHERE durum = 'beklemede') as beklemede,
                COUNT(*) FILTER (WHERE durum = 'devam_ediyor') as devam_ediyor,
                COUNT(*) FILTER (WHERE durum = 'tamamlandi') as tamamlandi
             FROM "ToplantiKarari"`
        )

        return {
            toplam: parseInt(stats?.toplam || '0', 10),
            beklemede: parseInt(stats?.beklemede || '0', 10),
            devamEdiyor: parseInt(stats?.devam_ediyor || '0', 10),
            tamamlandi: parseInt(stats?.tamamlandi || '0', 10)
        }
    } catch (error) {
        console.error("Karar istatistik hatası:", error)
        return { toplam: 0, beklemede: 0, devamEdiyor: 0, tamamlandi: 0 }
    }
}
