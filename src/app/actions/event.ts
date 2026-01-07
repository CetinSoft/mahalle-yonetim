'use server'

import { auth } from "@/auth"
import { query, queryOne } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const CreateEventSchema = z.object({
    title: z.string().min(3),
    date: z.string(),
})

export async function createEvent(formData: FormData): Promise<void> {
    const session = await auth()
    if (!session?.user) {
        throw new Error("Unauthorized")
    }

    if (session.user.image !== '48316184410') {
        throw new Error("Sadece yöneticiler etkinlik oluşturabilir.")
    }

    const validatedFields = CreateEventSchema.safeParse({
        title: formData.get('title'),
        date: formData.get('date'),
    })

    if (!validatedFields.success) {
        throw new Error("Geçersiz veri")
    }

    const { title, date } = validatedFields.data

    try {
        await query(
            `INSERT INTO "Event" (id, title, date, "isActive", "createdAt") 
             VALUES (gen_random_uuid(), $1, $2, true, NOW())`,
            [title, new Date(date)]
        )

        revalidatePath('/dashboard')
        revalidatePath('/admin/events')
    } catch (error) {
        console.error("Create Event Error:", error)
        throw new Error("Etkinlik oluşturulurken hata oluştu")
    }
}

export async function toggleEventStatus(eventId: string, isActive: boolean): Promise<void> {
    const session = await auth()
    if (!session?.user) throw new Error("Unauthorized")

    if (session.user.image !== '48316184410') {
        throw new Error("Yetkisiz işlem")
    }

    try {
        await query(
            `UPDATE "Event" SET "isActive" = $1 WHERE id = $2`,
            [isActive, eventId]
        )
        revalidatePath('/dashboard')
        revalidatePath('/admin/events')
    } catch (error) {
        throw new Error("Durum güncellenemedi")
    }
}

export async function inviteCitizen(citizenId: string, eventId: string): Promise<void> {
    const session = await auth()
    if (!session?.user) throw new Error("Unauthorized")

    const inviterName = session.user.name || session.user.email || "Yönetici"

    try {
        await query(
            `INSERT INTO "Invitation" (id, "citizenId", "eventId", "invitedBy", "invitedAt") 
             VALUES (gen_random_uuid(), $1, $2, $3, NOW())
             ON CONFLICT ("citizenId", "eventId") DO NOTHING`,
            [citizenId, eventId, inviterName]
        )
        revalidatePath('/dashboard')
    } catch (error) {
        console.error("Invite Error:", error)
        throw new Error("Davet edilemedi veya zaten davetli")
    }
}
