import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    // Create an initial admin/user to access the system
    const admin = await prisma.citizen.upsert({
        where: { tcNo: '11111111111' },
        update: {},
        create: {
            tcNo: '11111111111',
            ad: 'Yönetici',
            soyad: 'Admin',
            mahalle: 'Yönetim', // This user will see "Yönetim" neighborhood.
            uyeDurumu: 'Aktif',
            telefon: '05550000000',
            adres: 'Sistem Yöneticisi'
        },
    })
    console.log({ admin })
}
main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
