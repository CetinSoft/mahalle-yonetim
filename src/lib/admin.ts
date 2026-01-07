// Admin TC numaraları listesi
export const ADMIN_TCS = [
    '48316184410',
    '19442601546',
    '27092070872',
]

// Verilen TC'nin admin olup olmadığını kontrol eder
export function isAdminTC(tc: string | null | undefined): boolean {
    if (!tc) return false
    return ADMIN_TCS.includes(tc)
}
