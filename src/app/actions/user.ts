'use server'

import { auth } from "@/auth"
import { query, queryOne, UserMahalle, UserIlce } from "@/lib/db"
import { isAdminTC, getUserIlces, getDistrictMahalles } from "@/lib/admin"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const AssignMahalleSchema = z.object({
    tcNo: z.string().length(11, "TC Kimlik No 11 haneli olmalıdır"),
    mahalle: z.string().min(1, "Mahalle seçilmelidir"),
})

const AssignIlceSchema = z.object({
    tcNo: z.string().length(11, "TC Kimlik No 11 haneli olmalıdır"),
    ilce: z.string().min(1, "İlçe seçilmelidir"),
})

// ==================== MAHALLE YETKİ İŞLEMLERİ ====================

export async function assignUserMahalle(formData: FormData) {
    const session = await auth()
    const tcNo = session?.user?.image

    // Süper admin veya ilçe admini olmalı
    const isSuperAdmin = isAdminTC(tcNo)
    const userIlces = await getUserIlces(tcNo)
    const isDistrictAdminUser = userIlces.length > 0

    if (!session?.user || (!isSuperAdmin && !isDistrictAdminUser)) {
        throw new Error("Yetkisiz işlem")
    }

    const validatedFields = AssignMahalleSchema.safeParse({
        tcNo: formData.get('tcNo'),
        mahalle: formData.get('mahalle'),
    })

    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.issues.map((e) => e.message).join(', ')
        throw new Error("Geçersiz veri: " + errorMessages)
    }

    const { tcNo: targetTcNo, mahalle } = validatedFields.data

    // İlçe admini ise, sadece kendi ilçesindeki mahallelere yetki verebilir
    if (!isSuperAdmin && isDistrictAdminUser) {
        let canAssign = false
        for (const ilce of userIlces) {
            const districtMahalles = await getDistrictMahalles(ilce)
            if (districtMahalles.includes(mahalle)) {
                canAssign = true
                break
            }
        }
        if (!canAssign) {
            throw new Error("Bu mahalleye yetki verme yetkiniz yok")
        }
    }

    try {
        // Aynı TC ve mahalle kombinasyonu varsa ekleme yapma (unique kontrolü)
        const existing = await queryOne<{ id: string }>(
            `SELECT id FROM "UserMahalle" WHERE "tcNo" = $1 AND "mahalle" = $2`,
            [targetTcNo, mahalle]
        )

        if (existing) {
            return { success: false, message: 'Bu kullanıcı zaten bu mahalleye yetkili.' }
        }

        // Yeni yetki ekle (aynı TC için farklı mahalleler eklenebilir)
        await query(
            `INSERT INTO "UserMahalle" ("tcNo", "mahalle", "assignedBy")
             VALUES ($1, $2, $3)`,
            [targetTcNo, mahalle, session.user.image]
        )

        revalidatePath('/admin/users')
        return { success: true, message: 'Kullanıcı yetkisi eklendi.' }
    } catch (error) {
        console.error('Mahalle atama hatası:', error)
        throw new Error('Veritabanı hatası oluştu.')
    }
}

export async function removeUserMahalle(tcNo: string, mahalle: string) {
    const session = await auth()
    const currentTcNo = session?.user?.image

    // Süper admin veya ilçe admini olmalı
    const isSuperAdmin = isAdminTC(currentTcNo)
    const userIlces = await getUserIlces(currentTcNo)
    const isDistrictAdminUser = userIlces.length > 0

    if (!session?.user || (!isSuperAdmin && !isDistrictAdminUser)) {
        throw new Error("Yetkisiz işlem")
    }

    // İlçe admini ise, sadece kendi ilçesindeki mahalle yetkilerini kaldırabilir
    if (!isSuperAdmin && isDistrictAdminUser) {
        let canRemove = false
        for (const ilce of userIlces) {
            const districtMahalles = await getDistrictMahalles(ilce)
            if (districtMahalles.includes(mahalle)) {
                canRemove = true
                break
            }
        }
        if (!canRemove) {
            throw new Error("Bu mahalle yetkisini kaldırma yetkiniz yok")
        }
    }

    try {
        // Belirli TC ve mahalle kombinasyonunu sil
        await query('DELETE FROM "UserMahalle" WHERE "tcNo" = $1 AND "mahalle" = $2', [tcNo, mahalle])
        revalidatePath('/admin/users')
        return { success: true, message: 'Yetki kaldırıldı.' }
    } catch (error) {
        console.error('Yetki silme hatası:', error)
        throw new Error('Veritabanı hatası oluştu.')
    }
}

export async function getUserMahalleAssignments(ilceFilter?: string) {
    const session = await auth()
    const tcNo = session?.user?.image

    const isSuperAdmin = isAdminTC(tcNo)
    const userIlces = await getUserIlces(tcNo)
    const isDistrictAdminUser = userIlces.length > 0

    if (!session?.user || (!isSuperAdmin && !isDistrictAdminUser)) {
        throw new Error("Yetkisiz işlem")
    }

    // Süper admin tümünü görebilir, ilçe admini sadece kendi ilçesindeki mahalleleri
    let whereClause = ''
    const params: any[] = []

    if (!isSuperAdmin && isDistrictAdminUser) {
        // İlçe admininin yetkili olduğu mahalleleri bul
        const allMahalles: string[] = []
        for (const ilce of userIlces) {
            const mahalles = await getDistrictMahalles(ilce)
            allMahalles.push(...mahalles)
        }
        if (allMahalles.length > 0) {
            const placeholders = allMahalles.map((_, i) => `$${i + 1}`).join(', ')
            whereClause = `WHERE um."mahalle" IN (${placeholders})`
            params.push(...allMahalles)
        } else {
            return [] // Hiç mahalle yoksa boş döndür
        }
    }

    // Citizen tablosuyla join yaparak isimleri de alalım
    return await query<{
        id: string
        tcNo: string
        mahalle: string
        assignedBy: string
        createdAt: Date
        ad: string
        soyad: string
    }>(`
        SELECT um.*, c.ad, c.soyad 
        FROM "UserMahalle" um
        LEFT JOIN "Citizen" c ON c."tcNo" = um."tcNo"
        ${whereClause}
        ORDER BY um."createdAt" DESC
    `, params)
}

// ==================== İLÇE YETKİ İŞLEMLERİ ====================

export async function assignUserIlce(formData: FormData) {
    const session = await auth()

    // Sadece süper admin ilçe yetkisi verebilir
    if (!session?.user || !isAdminTC(session.user.image)) {
        throw new Error("Yetkisiz işlem - Sadece süper admin ilçe yetkisi verebilir")
    }

    const validatedFields = AssignIlceSchema.safeParse({
        tcNo: formData.get('tcNo'),
        ilce: formData.get('ilce'),
    })

    if (!validatedFields.success) {
        const errorMessages = validatedFields.error.issues.map((e) => e.message).join(', ')
        throw new Error("Geçersiz veri: " + errorMessages)
    }

    const { tcNo, ilce } = validatedFields.data

    try {
        // Aynı TC ve ilçe kombinasyonu varsa ekleme yapma
        const existing = await queryOne<{ id: string }>(
            `SELECT id FROM "UserIlce" WHERE "tcNo" = $1 AND ilce = $2`,
            [tcNo, ilce]
        )

        if (existing) {
            return { success: false, message: 'Bu kullanıcı zaten bu ilçeye yetkili.' }
        }

        // Yeni ilçe yetkisi ekle
        await query(
            `INSERT INTO "UserIlce" ("tcNo", ilce, "assignedBy")
             VALUES ($1, $2, $3)`,
            [tcNo, ilce, session.user.image]
        )

        revalidatePath('/admin/users')
        return { success: true, message: 'İlçe yetkisi eklendi.' }
    } catch (error) {
        console.error('İlçe atama hatası:', error)
        throw new Error('Veritabanı hatası oluştu.')
    }
}

export async function removeUserIlce(tcNo: string, ilce: string) {
    const session = await auth()

    // Sadece süper admin ilçe yetkisini kaldırabilir
    if (!session?.user || !isAdminTC(session.user.image)) {
        throw new Error("Yetkisiz işlem")
    }

    try {
        await query('DELETE FROM "UserIlce" WHERE "tcNo" = $1 AND ilce = $2', [tcNo, ilce])
        revalidatePath('/admin/users')
        return { success: true, message: 'İlçe yetkisi kaldırıldı.' }
    } catch (error) {
        console.error('İlçe yetki silme hatası:', error)
        throw new Error('Veritabanı hatası oluştu.')
    }
}

export async function getUserIlceAssignments() {
    const session = await auth()

    // Sadece süper admin görebilir
    if (!session?.user || !isAdminTC(session.user.image)) {
        throw new Error("Yetkisiz işlem")
    }

    return await query<{
        id: string
        tcNo: string
        ilce: string
        assignedBy: string
        createdAt: Date
        ad: string
        soyad: string
    }>(`
        SELECT ui.*, c.ad, c.soyad 
        FROM "UserIlce" ui
        LEFT JOIN "Citizen" c ON c."tcNo" = ui."tcNo"
        ORDER BY ui."createdAt" DESC
    `)
}

