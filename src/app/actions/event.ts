'use server'

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const CreateEventSchema = z.object({
    title: z.string().min(3),
    date: z.string(), // HTML date input returns string
})

export async function createEvent(formData: FormData): Promise<void> {
    const session = await auth()
    if (!session?.user) {
        throw new Error("Unauthorized")
    }

    // Only allow "Admin" to create events
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
        // Deactivate other events if we want only one active? 
        // Or just create. The user said "aktif olan son etkinlik".
        // Let's just create it. We can manage activation separately or auto-activate.

        await prisma.event.create({
            data: {
                title,
                date: new Date(date),
                isActive: true, // Auto-activate on creation for ease of use
            },
        })

        // If we want only ONE active event at a time, we should update others.
        // For now, let's assume the UI picks the *latest* active one.

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
        await prisma.event.update({
            where: { id: eventId },
            data: { isActive }
        })
        revalidatePath('/dashboard')
        revalidatePath('/admin/events')
    } catch (error) {
        throw new Error("Durum güncellenemedi")
    }
}

export async function inviteCitizen(citizenId: string, eventId: string) {
    const session = await auth()
    if (!session?.user) throw new Error("Unauthorized")

    // Determine inviter name
    // Hardcoded admin has specific TC, mapped name?
    // User session structure: { user: { email: "MAHALLE ADI", name: "USER NAME" } }
    // We will use the name if available, otherwise email (Mahalle Name), otherwise "Admin".
    const inviterName = session.user.name || session.user.email || "Yönetici"

    try {
        await prisma.invitation.create({
            data: {
                citizenId,
                eventId,
                invitedBy: inviterName
            }
        })
        revalidatePath('/dashboard')
        return { success: true }
    } catch (error) {
        console.error("Invite Error:", error)
        // Check if unique constraint violation (already invited)
        return { error: "Davet edilemedi veya zaten davetli" }
    }
}
