import { query, queryOne, UserIlce } from "@/lib/db"

// Admin TC numaraları listesi (Süper Admin)
export const ADMIN_TCS = [
    '48316184410',
    '19442601546',
    '27092070872',
]

// Verilen TC'nin süper admin olup olmadığını kontrol eder
export function isAdminTC(tc: string | null | undefined): boolean {
    if (!tc) return false
    return ADMIN_TCS.includes(tc)
}

// Verilen TC'nin ilçe admini olup olmadığını kontrol eder
export async function isDistrictAdmin(tc: string | null | undefined): Promise<boolean> {
    if (!tc) return false
    const result = await queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM "UserIlce" WHERE "tcNo" = $1',
        [tc]
    )
    return parseInt(result?.count || '0', 10) > 0
}

// Kullanıcının yetkili olduğu ilçeleri getirir
export async function getUserIlces(tc: string | null | undefined): Promise<string[]> {
    if (!tc) return []
    const results = await query<{ ilce: string }>(
        'SELECT ilce FROM "UserIlce" WHERE "tcNo" = $1',
        [tc]
    )
    return results.map(r => r.ilce)
}

// Kullanıcının belirli bir ilçeye yetkisi var mı kontrol eder
export async function hasDistrictAccess(tc: string | null | undefined, ilce: string): Promise<boolean> {
    if (!tc) return false
    if (isAdminTC(tc)) return true // Süper admin her ilçeye erişebilir

    const result = await queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM "UserIlce" WHERE "tcNo" = $1 AND ilce = $2',
        [tc, ilce]
    )
    return parseInt(result?.count || '0', 10) > 0
}

// İlçeye ait mahalleleri getirir
export async function getDistrictMahalles(ilce: string): Promise<string[]> {
    const results = await query<{ mahalle: string }>(
        'SELECT DISTINCT mahalle FROM "Citizen" WHERE ilce = $1 AND mahalle IS NOT NULL AND mahalle != \'\' ORDER BY mahalle',
        [ilce]
    )
    return results.map(r => r.mahalle)
}

