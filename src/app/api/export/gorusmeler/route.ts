import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query, Gorusme } from '@/lib/db'
import * as XLSX from 'xlsx'

const ADMIN_TC = '48316184410'

interface GorusmeWithCitizen extends Gorusme {
    citizenAd: string
    citizenSoyad: string
    citizenMahalle: string
}

export async function GET(request: NextRequest) {
    const session = await auth()
    const userMahalle = session?.user?.email
    const userName = session?.user?.name || userMahalle
    const isAdmin = session?.user?.image === ADMIN_TC

    if (!userMahalle && !isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const mahalle = searchParams.get('mahalle')
    const sonuc = searchParams.get('sonuc')
    const arama = searchParams.get('arama')

    // Build query
    let whereClause = ''
    const params: any[] = []
    let paramIndex = 1

    const selectedMahalle = isAdmin ? (mahalle || undefined) : undefined

    // Normal kullanıcılar sadece kendi yaptıkları görüşmeleri görür
    if (!isAdmin) {
        whereClause = `WHERE g."gorusmeYapan" = $${paramIndex}`
        params.push(userName)
        paramIndex++
    } else if (selectedMahalle) {
        whereClause = `WHERE c."mahalle" = $${paramIndex}`
        params.push(selectedMahalle)
        paramIndex++
    }

    if (sonuc && sonuc !== 'all') {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` g.sonuc = $${paramIndex}`
        params.push(sonuc)
        paramIndex++
    }

    if (arama && arama.trim()) {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` (c."ad" ILIKE $${paramIndex} OR c."soyad" ILIKE $${paramIndex})`
        params.push(`%${arama.trim()}%`)
        paramIndex++
    }

    const gorusmeler = await query<GorusmeWithCitizen>(
        `SELECT g.*, c.ad as "citizenAd", c.soyad as "citizenSoyad", c.mahalle as "citizenMahalle"
         FROM "Gorusme" g
         JOIN "Citizen" c ON c.id = g."citizenId"
         ${whereClause}
         ORDER BY g."gorusmeTarihi" DESC`,
        params
    )

    // Excel data
    const getSonucLabel = (s: string) => {
        switch (s) {
            case 'olumlu': return 'Olumlu'
            case 'olumsuz': return 'Olumsuz'
            default: return 'Belirsiz'
        }
    }

    const excelData = gorusmeler.map(g => ({
        'Görüşülen Kişi': `${g.citizenAd} ${g.citizenSoyad}`,
        'Mahalle': g.citizenMahalle,
        'Görüşmeyi Yapan': g.gorusmeYapan,
        'Tarih': new Date(g.gorusmeTarihi).toLocaleDateString('tr-TR'),
        'Sonuç': getSonucLabel(g.sonuc),
        'Açıklama': g.aciklama,
    }))

    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Görüşmeler')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `gorusmeler-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    })
}
