'use server'

import { auth } from "@/auth"
import { query, queryOne, Faaliyet, FaaliyetWithKatilimcilar } from "@/lib/db"
import { isAdminTC, getUserIlces } from "@/lib/admin"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const FaaliyetSchema = z.object({
    konu: z.string().min(1, "Konu zorunludur"),
    icerik: z.string().optional(),
    tarih: z.string().min(1, "Tarih zorunludur"),
    saat: z.string().optional(),
    konum: z.string().optional(),
    gorevli: z.string().optional(),
    ilce: z.string().min(1, "İlçe zorunludur"),
})

// Kullanıcının ilçe yetkisi var mı kontrol et
async function checkIlceAccess(tcNo: string | null | undefined, ilce: string): Promise<boolean> {
    if (!tcNo) return false
    if (isAdminTC(tcNo)) return true
    const userIlces = await getUserIlces(tcNo)
    return userIlces.includes(ilce)
}

// ==================== FAA LİYET İŞLEMLERİ ====================

export async function createFaaliyet(formData: FormData) {
    const session = await auth()
    const tcNo = session?.user?.image

    const validatedFields = FaaliyetSchema.safeParse({
        konu: formData.get('konu'),
        icerik: formData.get('icerik'),
        tarih: formData.get('tarih'),
        saat: formData.get('saat'),
        konum: formData.get('konum'),
        gorevli: formData.get('gorevli'),
        ilce: formData.get('ilce'),
    })

    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.issues.map((e) => e.message).join(', ')
        throw new Error("Geçersiz veri: " + errorMessages)
    }

    const { konu, icerik, tarih, saat, konum, gorevli, ilce } = validatedFields.data

    // İlçe yetkisi kontrolü
    const hasAccess = await checkIlceAccess(tcNo, ilce)
    if (!hasAccess) {
        throw new Error("Bu ilçeye faaliyet ekleme yetkiniz yok")
    }

    try {
        await query(
            `INSERT INTO "Faaliyet" (konu, icerik, tarih, saat, konum, gorevli, ilce, "olusturanTc")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [konu, icerik || null, tarih, saat || null, konum || null, gorevli || null, ilce, tcNo]
        )

        revalidatePath('/takvim')
        return { success: true, message: 'Faaliyet oluşturuldu.' }
    } catch (error) {
        console.error('Faaliyet oluşturma hatası:', error)
        throw new Error('Veritabanı hatası oluştu.')
    }
}

export async function updateFaaliyet(id: string, formData: FormData) {
    const session = await auth()
    const tcNo = session?.user?.image

    // Mevcut faaliyeti al
    const faaliyet = await queryOne<Faaliyet>(
        'SELECT * FROM "Faaliyet" WHERE id = $1',
        [id]
    )

    if (!faaliyet) {
        throw new Error("Faaliyet bulunamadı")
    }

    // İlçe yetkisi kontrolü
    const hasAccess = await checkIlceAccess(tcNo, faaliyet.ilce)
    if (!hasAccess) {
        throw new Error("Bu faaliyeti düzenleme yetkiniz yok")
    }

    const validatedFields = FaaliyetSchema.safeParse({
        konu: formData.get('konu'),
        icerik: formData.get('icerik'),
        tarih: formData.get('tarih'),
        saat: formData.get('saat'),
        konum: formData.get('konum'),
        gorevli: formData.get('gorevli'),
        ilce: formData.get('ilce'),
    })

    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.issues.map((e) => e.message).join(', ')
        throw new Error("Geçersiz veri: " + errorMessages)
    }

    const { konu, icerik, tarih, saat, konum, gorevli, ilce } = validatedFields.data

    try {
        await query(
            `UPDATE "Faaliyet" SET konu = $1, icerik = $2, tarih = $3, saat = $4, konum = $5, gorevli = $6, ilce = $7, "updatedAt" = NOW()
             WHERE id = $8`,
            [konu, icerik || null, tarih, saat || null, konum || null, gorevli || null, ilce, id]
        )

        revalidatePath('/takvim')
        revalidatePath(`/takvim/${id}`)
        return { success: true, message: 'Faaliyet güncellendi.' }
    } catch (error) {
        console.error('Faaliyet güncelleme hatası:', error)
        throw new Error('Veritabanı hatası oluştu.')
    }
}

export async function deleteFaaliyet(id: string) {
    const session = await auth()
    const tcNo = session?.user?.image

    // Mevcut faaliyeti al
    const faaliyet = await queryOne<Faaliyet>(
        'SELECT * FROM "Faaliyet" WHERE id = $1',
        [id]
    )

    if (!faaliyet) {
        throw new Error("Faaliyet bulunamadı")
    }

    // İlçe yetkisi kontrolü
    const hasAccess = await checkIlceAccess(tcNo, faaliyet.ilce)
    if (!hasAccess) {
        throw new Error("Bu faaliyeti silme yetkiniz yok")
    }

    try {
        await query('DELETE FROM "Faaliyet" WHERE id = $1', [id])
        revalidatePath('/takvim')
        return { success: true, message: 'Faaliyet silindi.' }
    } catch (error) {
        console.error('Faaliyet silme hatası:', error)
        throw new Error('Veritabanı hatası oluştu.')
    }
}

// ==================== KATILIMCI İŞLEMLERİ ====================

export async function addKatilimci(faaliyetId: string, citizenId: string) {
    const session = await auth()
    const tcNo = session?.user?.image

    // Faaliyet kontrolü
    const faaliyet = await queryOne<Faaliyet>(
        'SELECT * FROM "Faaliyet" WHERE id = $1',
        [faaliyetId]
    )

    if (!faaliyet) {
        throw new Error("Faaliyet bulunamadı")
    }

    // İlçe yetkisi kontrolü
    const hasAccess = await checkIlceAccess(tcNo, faaliyet.ilce)
    if (!hasAccess) {
        throw new Error("Bu faaliyete katılımcı ekleme yetkiniz yok")
    }

    try {
        await query(
            `INSERT INTO "FaaliyetKatilimci" ("faaliyetId", "citizenId", "ekleyenTc")
             VALUES ($1, $2, $3)
             ON CONFLICT ("faaliyetId", "citizenId") DO NOTHING`,
            [faaliyetId, citizenId, tcNo]
        )

        revalidatePath(`/takvim/${faaliyetId}`)
        return { success: true, message: 'Katılımcı eklendi.' }
    } catch (error) {
        console.error('Katılımcı ekleme hatası:', error)
        throw new Error('Veritabanı hatası oluştu.')
    }
}

export async function removeKatilimci(faaliyetId: string, citizenId: string) {
    const session = await auth()
    const tcNo = session?.user?.image

    // Faaliyet kontrolü
    const faaliyet = await queryOne<Faaliyet>(
        'SELECT * FROM "Faaliyet" WHERE id = $1',
        [faaliyetId]
    )

    if (!faaliyet) {
        throw new Error("Faaliyet bulunamadı")
    }

    // İlçe yetkisi kontrolü
    const hasAccess = await checkIlceAccess(tcNo, faaliyet.ilce)
    if (!hasAccess) {
        throw new Error("Bu faaliyetten katılımcı çıkarma yetkiniz yok")
    }

    try {
        await query(
            'DELETE FROM "FaaliyetKatilimci" WHERE "faaliyetId" = $1 AND "citizenId" = $2',
            [faaliyetId, citizenId]
        )

        revalidatePath(`/takvim/${faaliyetId}`)
        return { success: true, message: 'Katılımcı çıkarıldı.' }
    } catch (error) {
        console.error('Katılımcı çıkarma hatası:', error)
        throw new Error('Veritabanı hatası oluştu.')
    }
}

// ==================== LİSTELEME ====================

// Otomatik Toplantı Kontrolü
async function ensureWeeklyMeetings(ilce: string) {
    if (!ilce) return

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    // Bu ayın ve gelecek ayın tüm Pazartesi günlerini bul
    const mondays: Date[] = []

    // 2 aylık periyot için döngü (şimdiki ve sonraki ay)
    for (let m = 0; m <= 1; m++) {
        let date = new Date(currentYear, currentMonth + m, 1)
        const month = date.getMonth()

        // Ayın ilk gününe git, ilk Pazartesiyi bul
        while (date.getDay() !== 1) {
            date.setDate(date.getDate() + 1)
        }

        // Ay bitene kadar Pazartesileri ekle
        while (date.getMonth() === month) {
            mondays.push(new Date(date))
            date.setDate(date.getDate() + 7)
        }
    }

    // Her Pazartesi için veritabanını kontrol et
    for (const monday of mondays) {
        // Tarih formatı YYYY-MM-DD (yerel saat dilimine dikkat et)
        // new Date() UTC çalışabilir, bu yüzden yerel tarihi string yaparken dikkatli olalım
        // Basitçe: YYYY-MM-DD stringini manuel oluşturalım
        const tarihStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`

        // Bu tarihte, bu ilçede, bu konuda toplantı var mı?
        const existing = await queryOne(
            `SELECT id FROM "Faaliyet" 
             WHERE tarih = $1::date AND ilce = $2 AND konu = 'Yönetim Kurulu Toplantısı'`,
            [tarihStr, ilce]
        )

        if (!existing) {
            // Yoksa oluştur
            await query(
                `INSERT INTO "Faaliyet" (konu, icerik, tarih, saat, konum, gorevli, ilce, "olusturanTc", "createdAt", "updatedAt")
                 VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, NOW(), NOW())`,
                [
                    'Yönetim Kurulu Toplantısı',
                    'Haftalık olağan yönetim kurulu toplantısı',
                    tarihStr,
                    '20:00', // Varsayılan saat
                    'İlçe Başkanlığı', // Varsayılan konum
                    'İlçe Başkanı', // Varsayılan görevli
                    ilce,
                    'SISTEM' // Oluşturan
                ]
            )
            console.log(`Otomatik toplantı oluşturuldu: ${tarihStr} - ${ilce}`)
        }
    }
}

export async function getFaaliyetler(ilce?: string): Promise<Faaliyet[]> {
    const session = await auth()
    const tcNo = session?.user?.image

    // Kullanıcının erişebileceği ilçeleri belirle
    let accessibleIlces: string[] = []

    if (isAdminTC(tcNo)) {
        // Süper admin tüm ilçeleri görebilir
        if (ilce) {
            accessibleIlces = [ilce]
        }
        // ilce yoksa tüm faaliyetleri döndür
    } else {
        const userIlces = await getUserIlces(tcNo)
        if (userIlces.length > 0) {
            accessibleIlces = ilce && userIlces.includes(ilce) ? [ilce] : userIlces
        } else {
            // Mahalle yetkilisi - kendi ilçesine göre filtrele
            // UserMahalle'den ilçe bilgisi al
            const mahalleInfo = await query<{ ilce: string }>(
                `SELECT DISTINCT c.ilce 
                 FROM "UserMahalle" um 
                 JOIN "Citizen" c ON c.mahalle = um.mahalle 
                 WHERE um."tcNo" = $1 AND c.ilce IS NOT NULL`,
                [tcNo]
            )
            accessibleIlces = mahalleInfo.map(m => m.ilce)
        }
    }

    // Otomatik toplantıları kontrol et (Sadece belirli bir ilçe seçiliyse veya kullanıcının tek ilçesi varsa)
    if (accessibleIlces.length === 1) {
        // Arka planda çalışması için await kullanmadan çağırabiliriz ama
        // Next.js server action içinde senkron olması daha garantidir
        await ensureWeeklyMeetings(accessibleIlces[0])
    }

    let whereClause = ''
    const params: any[] = []

    if (accessibleIlces.length > 0) {
        const placeholders = accessibleIlces.map((_, i) => `$${i + 1}`).join(', ')
        whereClause = `WHERE ilce IN (${placeholders})`
        params.push(...accessibleIlces)
    }

    return await query<Faaliyet>(
        `SELECT * FROM "Faaliyet" ${whereClause} ORDER BY tarih DESC, saat DESC`,
        params
    )
}

export async function getFaaliyetById(id: string): Promise<FaaliyetWithKatilimcilar | null> {
    const faaliyet = await queryOne<Faaliyet>(
        'SELECT * FROM "Faaliyet" WHERE id = $1',
        [id]
    )

    if (!faaliyet) return null

    // Katılımcıları al
    const katilimcilar = await query<{ id: string; citizenId: string; ad: string; soyad: string }>(
        `SELECT fk.id, fk."citizenId", c.ad, c.soyad
         FROM "FaaliyetKatilimci" fk
         JOIN "Citizen" c ON c.id = fk."citizenId"
         WHERE fk."faaliyetId" = $1
         ORDER BY c.ad, c.soyad`,
        [id]
    )

    return {
        ...faaliyet,
        katilimcilar
    }
}
