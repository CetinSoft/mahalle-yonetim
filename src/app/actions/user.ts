'use server'

import { auth } from "@/auth"
import { query, queryOne, UserMahalle } from "@/lib/db"
import { isAdminTC } from "@/lib/admin"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const AssignMahalleSchema = z.object({
    tcNo: z.string().length(11, "TC Kimlik No 11 haneli olmalıdır"),
    mahalle: z.string().min(1, "Mahalle seçilmelidir"),
})

export async function assignUserMahalle(formData: FormData) {
    const session = await auth()
    if (!session?.user || !isAdminTC(session.user.image)) {
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

    const { tcNo, mahalle } = validatedFields.data

    try {
        // Aynı TC ve mahalle kombinasyonu varsa ekleme yapma (unique kontrolü)
        const existing = await queryOne<{ id: string }>(
            `SELECT id FROM "UserMahalle" WHERE "tcNo" = $1 AND "mahalle" = $2`,
            [tcNo, mahalle]
        )

        if (existing) {
            return { success: false, message: 'Bu kullanıcı zaten bu mahalleye yetkili.' }
        }

        // Yeni yetki ekle (aynı TC için farklı mahalleler eklenebilir)
        await query(
            `INSERT INTO "UserMahalle" ("tcNo", "mahalle", "assignedBy")
             VALUES ($1, $2, $3)`,
            [tcNo, mahalle, session.user.image]
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
    if (!session?.user || !isAdminTC(session.user.image)) {
        throw new Error("Yetkisiz işlem")
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

export async function getUserMahalleAssignments() {
    const session = await auth()
    if (!session?.user || !isAdminTC(session.user.image)) {
        throw new Error("Yetkisiz işlem")
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
        ORDER BY um."createdAt" DESC
    `)
}
