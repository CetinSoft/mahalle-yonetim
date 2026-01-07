import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { query, Citizen } from '@/lib/db'
import * as XLSX from 'xlsx'

const ADMIN_TC = '48316184410'

export async function GET(request: NextRequest) {
    const session = await auth()
    const userMahalle = session?.user?.email
    const isAdmin = session?.user?.image === ADMIN_TC

    if (!userMahalle && !isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const mahalle = searchParams.get('mahalle')
    const yargitay = searchParams.get('yargitay')
    const cinsiyet = searchParams.get('cinsiyet')
    const gorevi = searchParams.get('gorevi')
    const arama = searchParams.get('arama')

    // Build query
    let whereClause = ''
    const params: any[] = []
    let paramIndex = 1

    const selectedMahalle = isAdmin ? (mahalle || undefined) : userMahalle

    if (selectedMahalle) {
        whereClause = `WHERE "mahalle" = $${paramIndex}`
        params.push(selectedMahalle)
        paramIndex++
    }

    if (yargitay) {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` "yargitayDurumu" ILIKE $${paramIndex}`
        params.push(`%${yargitay}%`)
        paramIndex++
    }

    const cinsiyetFilter = cinsiyet === 'all' ? undefined : cinsiyet
    if (cinsiyetFilter) {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` "cinsiyet" = $${paramIndex}`
        params.push(cinsiyetFilter)
        paramIndex++
    }

    if (gorevi === 'var') {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` "gorevi" IS NOT NULL AND "gorevi" != ''`
    } else if (gorevi === 'yok') {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` ("gorevi" IS NULL OR "gorevi" = '')`
    } else if (gorevi === 'basmusahit') {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` "gorevi" ILIKE '%başmüşahit%'`
    }

    if (arama && arama.trim()) {
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` ("ad" ILIKE $${paramIndex} OR "soyad" ILIKE $${paramIndex} OR "tcNo" ILIKE $${paramIndex})`
        params.push(`%${arama.trim()}%`)
        paramIndex++
    }

    const citizens = await query<Citizen>(
        `SELECT * FROM "Citizen" ${whereClause} ORDER BY "ad" ASC`,
        params
    )

    // Excel data
    const excelData = citizens.map(c => ({
        'Ad': c.ad,
        'Soyad': c.soyad,
        'TC No': c.tcNo,
        'Telefon': c.telefon || '',
        'Mahalle': c.mahalle,
        'İlçe': c.ilce || '',
        'Adres': c.adres || '',
        'Cinsiyet': c.cinsiyet || '',
        'Meslek': c.meslek || '',
        'Görevi': c.gorevi || '',
        'Yargıtay Durumu': c.yargitayDurumu || '',
        'Doğum Tarihi': c.dogumTarihi || '',
        'Doğum Yeri': c.dogumYeri || '',
        'Anne Adı': c.anneAdi || '',
        'Baba Adı': c.babaAdi || '',
        'Sandık No': c.sandikNo || '',
        'Kan Grubu': c.kanGrubu || '',
    }))

    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kişi Listesi')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = `kisi-listesi-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    })
}
