'use server'

import { auth } from "@/auth"
import { query, Citizen } from "@/lib/db"
import { isAdminTC, getUserIlces, getDistrictMahalles } from "@/lib/admin"
import { z } from "zod"
import http from "http"

// SMS Filter Schema
const SMSFilterSchema = z.object({
    mahalle: z.string().optional(),
    cinsiyet: z.string().optional(),
    yargitay: z.string().optional(),
    gorevi: z.string().optional(),
    arama: z.string().optional(),
})

// SMS Send Schema
const SMSSendSchema = z.object({
    memberIds: z.array(z.string()).min(1, "En az bir üye seçmelisiniz"),
    message: z.string().min(1, "Mesaj boş olamaz").max(500, "Mesaj 500 karakterden uzun olamaz"),
})

export interface SMSMember {
    id: string
    ad: string
    soyad: string
    telefon: string | null
    mahalle: string
    yargitayDurumu: string | null
}

export interface SMSResult {
    memberId: string
    memberName: string
    phone: string
    success: boolean
    error?: string
}

/**
 * Get filtered members for SMS sending
 */
export async function getFilteredMembers(filters: {
    mahalle?: string
    cinsiyet?: string
    yargitay?: string
    gorevi?: string
    arama?: string
}): Promise<{ members: SMSMember[], error?: string }> {
    try {
        const session = await auth()
        const tcNo = session?.user?.image
        const isSuperAdmin = isAdminTC(tcNo)

        // Check authorization
        const userIlces = await getUserIlces(tcNo)
        const isDistrictAdmin = userIlces.length > 0

        if (!isSuperAdmin && !isDistrictAdmin) {
            return { members: [], error: "Bu işlem için yetkiniz yok" }
        }

        // Validate filters
        const validatedFilters = SMSFilterSchema.safeParse(filters)
        if (!validatedFilters.success) {
            return { members: [], error: "Geçersiz filtre parametreleri" }
        }

        const { mahalle, cinsiyet, yargitay, gorevi, arama } = validatedFilters.data

        // Build WHERE clause based on user permissions
        let whereClause = ''
        const params: any[] = []
        let paramIndex = 1

        // Mahalle filter based on permissions
        if (isSuperAdmin) {
            if (mahalle) {
                whereClause = `WHERE "mahalle" = $${paramIndex}`
                params.push(mahalle)
                paramIndex++
            }
        } else if (isDistrictAdmin) {
            // Get all mahalles for user's districts
            let userMahalles: string[] = []
            for (const ilce of userIlces) {
                const districtMahalles = await getDistrictMahalles(ilce)
                userMahalles.push(...districtMahalles)
            }
            userMahalles = [...new Set(userMahalles)]

            if (mahalle && userMahalles.includes(mahalle)) {
                whereClause = `WHERE "mahalle" = $${paramIndex}`
                params.push(mahalle)
                paramIndex++
            } else if (userMahalles.length > 0) {
                const placeholders = userMahalles.map((_, i) => `$${paramIndex + i}`).join(', ')
                whereClause = `WHERE "mahalle" IN (${placeholders})`
                params.push(...userMahalles)
                paramIndex += userMahalles.length
            }
        }

        // Apply other filters
        if (yargitay) {
            whereClause += (whereClause ? ' AND' : 'WHERE') + ` "yargitayDurumu" ILIKE $${paramIndex}`
            params.push(`%${yargitay}%`)
            paramIndex++
        }

        if (cinsiyet && cinsiyet !== 'all') {
            whereClause += (whereClause ? ' AND' : 'WHERE') + ` "cinsiyet" = $${paramIndex}`
            params.push(cinsiyet)
            paramIndex++
        }

        // Görevi filter
        if (gorevi === 'var') {
            whereClause += (whereClause ? ' AND' : 'WHERE') + ` "gorevi" IS NOT NULL AND "gorevi" != ''`
        } else if (gorevi === 'yok') {
            whereClause += (whereClause ? ' AND' : 'WHERE') + ` ("gorevi" IS NULL OR "gorevi" = '')`
        } else if (gorevi === 'basmusahit') {
            whereClause += (whereClause ? ' AND' : 'WHERE') + ` "gorevi" ILIKE '%başmüşahit%'`
        }

        // Search filter
        if (arama && arama.trim()) {
            const searchTerm = arama.trim()
            whereClause += (whereClause ? ' AND' : 'WHERE') + ` ("ad" ILIKE $${paramIndex} OR "soyad" ILIKE $${paramIndex} OR "tcNo" ILIKE $${paramIndex} OR CONCAT("ad", ' ', "soyad") ILIKE $${paramIndex} OR "meslek" ILIKE $${paramIndex} OR "gorevi" ILIKE $${paramIndex})`
            params.push(`%${searchTerm}%`)
            paramIndex++
        }

        // Only get members with phone numbers
        whereClause += (whereClause ? ' AND' : 'WHERE') + ` "telefon" IS NOT NULL AND "telefon" != ''`

        const members = await query<SMSMember>(
            `SELECT id, ad, soyad, telefon, mahalle, "yargitayDurumu" 
             FROM "Citizen" 
             ${whereClause} 
             ORDER BY "ad" ASC, "soyad" ASC`,
            params
        )

        return { members }
    } catch (error) {
        console.error("Get Filtered Members Error:", error)
        return { members: [], error: "Üyeler yüklenirken hata oluştu" }
    }
}

/**
 * Send bulk SMS to selected members
 */
export async function sendBulkSMS(memberIds: string[], message: string): Promise<{ results: SMSResult[], error?: string }> {
    try {
        const session = await auth()
        const tcNo = session?.user?.image
        const isSuperAdmin = isAdminTC(tcNo)

        // Check authorization
        const userIlces = await getUserIlces(tcNo)
        const isDistrictAdmin = userIlces.length > 0

        if (!isSuperAdmin && !isDistrictAdmin) {
            return { results: [], error: "Bu işlem için yetkiniz yok" }
        }

        // Validate input
        const validatedData = SMSSendSchema.safeParse({ memberIds, message })
        if (!validatedData.success) {
            return { results: [], error: validatedData.error.issues[0].message }
        }

        // Get SMS API credentials from environment
        const smsApiUrl = (process.env.SMS_API_URL || '').trim()
        const smsUsername = (process.env.SMS_USERNAME || '').trim()
        const smsPassword = (process.env.SMS_PASSWORD || '').trim()
        const smsHeader = (process.env.SMS_HEADER || '').trim()
        const smsApiKey = (process.env.SMS_API_KEY || '').trim()

        // Check if we have either username/password OR API Key
        if (!smsApiUrl || !smsHeader) {
            return { results: [], error: "SMS servisi yapılandırılmamış (URL veya Header eksik)." }
        }

        if (!smsApiKey && (!smsUsername || !smsPassword)) {
            return { results: [], error: "SMS servisi yapılandırılmamış (API Key veya Username/Password eksik)." }
        }

        // Get member details
        const placeholders = memberIds.map((_, i) => `$${i + 1}`).join(', ')
        const members = await query<Citizen>(
            `SELECT id, ad, soyad, telefon, mahalle FROM "Citizen" WHERE id IN (${placeholders})`,
            memberIds
        )

        if (members.length === 0) {
            return { results: [], error: "Seçili üyeler bulunamadı" }
        }

        // Check if district admin has permission for all selected members
        if (isDistrictAdmin && !isSuperAdmin) {
            let userMahalles: string[] = []
            for (const ilce of userIlces) {
                const districtMahalles = await getDistrictMahalles(ilce)
                userMahalles.push(...districtMahalles)
            }
            userMahalles = [...new Set(userMahalles)]

            const unauthorizedMembers = members.filter(m => !userMahalles.includes(m.mahalle))
            if (unauthorizedMembers.length > 0) {
                return { results: [], error: "Seçili üyelerden bazıları için yetkiniz yok" }
            }
        }

        // Send SMS to each member
        const results: SMSResult[] = []

        for (const member of members) {
            const memberName = `${member.ad} ${member.soyad}`

            // Skip if no phone number
            if (!member.telefon || member.telefon.trim() === '') {
                results.push({
                    memberId: member.id,
                    memberName,
                    phone: '-',
                    success: false,
                    error: 'Telefon numarası yok'
                })
                continue
            }

            // Personalize message
            let personalizedMessage = message
                .replace(/{AD}/g, member.ad)
                .replace(/{SOYAD}/g, member.soyad)

            // Format phone number - remove all non-digit characters
            let phoneNumber = member.telefon.replace(/\D/g, '')

            // Ensure phone number starts with 90 (Turkey country code)
            if (phoneNumber.startsWith('0')) {
                // Remove leading 0 and add 90
                phoneNumber = '90' + phoneNumber.substring(1)
            } else if (phoneNumber.startsWith('90')) {
                // Already has country code, keep as is
                phoneNumber = phoneNumber
            } else if (phoneNumber.startsWith('5')) {
                // Mobile number without 0, add 90
                phoneNumber = '90' + phoneNumber
            } else {
                // Other format, add 90
                phoneNumber = '90' + phoneNumber
            }

            // Validate phone number length (should be 12 digits: 90 + 10 digits)
            if (phoneNumber.length !== 12) {
                results.push({
                    memberId: member.id,
                    memberName,
                    phone: member.telefon,
                    success: false,
                    error: `Geçersiz telefon numarası formatı (${phoneNumber})`
                })
                continue
            }

            try {
                // Build compact Bizim SMS XML request
                const xmlRequest = `<sms><username>${smsUsername}</username><password>${smsPassword}</password><header>${smsHeader}</header><validity>2880</validity><message><gsm><no>${phoneNumber}</no></gsm><msg>${personalizedMessage}</msg></message></sms>`

                // Debug: Log the request
                console.log('--- SMS DEBUG: START REQUEST ---')
                console.log(`Target: ${smsApiUrl}`)
                console.log(`Recipient: ${memberName} (${phoneNumber})`)

                // Send SMS request using http/https module
                const apiResponse = await new Promise<{status: number, statusText: string, text: string}>((resolve, reject) => {
                    try {
                        const parsedUrl = new URL(smsApiUrl);
                        const isHttps = parsedUrl.protocol === 'https:';
                        const transport = isHttps ? require('https') : require('http');
                        
                        const options = {
                            hostname: parsedUrl.hostname,
                            port: parsedUrl.port || (isHttps ? 443 : 80),
                            path: parsedUrl.pathname + parsedUrl.search,
                            method: 'POST',
                            family: 4, // Force IPv4 to avoid connection issues
                            headers: {
                                'Content-Type': 'text/xml; charset=UTF-8',
                                'Content-Length': Buffer.byteLength(xmlRequest),
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SMS-Agent/1.0',
                                'Connection': 'close'
                            },
                            timeout: 10000 // 10s timeout
                        };

                        console.log(`Connection Options: ${JSON.stringify({
                            hostname: options.hostname,
                            port: options.port,
                            protocol: parsedUrl.protocol,
                            method: options.method
                        })}`);

                        const req = transport.request(options, (res: any) => {
                            let data = '';
                            res.setEncoding('utf8');
                            res.on('data', (chunk: any) => { data += chunk; });
                            res.on('end', () => {
                                resolve({
                                    status: res.statusCode || 0,
                                    statusText: res.statusMessage || '',
                                    text: data
                                });
                            });
                        });

                        req.on('error', (e: any) => {
                            console.error(`--- SMS DEBUG: SOCKET ERROR: ${e.code || 'UNKNOWN'} ---`);
                            console.error(e);
                            reject(e);
                        });

                        req.on('timeout', () => {
                            console.error('--- SMS DEBUG: TIMEOUT REACHED (10s) ---');
                            req.destroy();
                            reject(new Error('ETIMEDOUT: Connection timed out after 10s'));
                        });

                        req.write(xmlRequest);
                        req.end();
                    } catch (err) {
                        console.error('--- SMS DEBUG: SETUP ERROR ---', err);
                        reject(err);
                    }
                });

                const responseText = apiResponse.text;
                const responseStatus = apiResponse.status;
                const responseStatusText = apiResponse.statusText;

                // Debug: Log the response
                console.log('--- SMS DEBUG: RESPONSE RECEIVED ---')
                console.log('Status:', responseStatus, responseStatusText)
                console.log('Body:', responseText.substring(0, 500))
                console.log('------------------------------------')

                // Check if request was successful (Bizim SMS usually returns status code and text)
                // Note: Even if status is 200, it might be an application-level error
                if (responseStatus >= 200 && responseStatus < 300) {
                    results.push({
                        memberId: member.id,
                        memberName,
                        phone: phoneNumber,
                        success: true,
                        error: `API Response: ${responseText.substring(0, 100)}` 
                    })
                } else {
                    results.push({
                        memberId: member.id,
                        memberName,
                        phone: phoneNumber,
                        success: false,
                        error: `HTTP ${responseStatus}: ${responseText.substring(0, 100)}`
                    })
                }

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
                console.error(`--- SMS DEBUG: FATAL ERROR for ${memberName} ---`, errorMessage);
                
                results.push({
                    memberId: member.id,
                    memberName,
                    phone: phoneNumber || member.telefon,
                    success: false,
                    error: errorMessage
                })
            }

            // Add small delay between requests to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 200))
        }

        return { results }
    } catch (error) {
        console.error("Send Bulk SMS Error:", error)
        return { results: [], error: "SMS gönderilirken hata oluştu" }
    }
}
