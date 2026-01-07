'use server'

import { prisma } from "@/lib/prisma"
import * as XLSX from 'xlsx'
import { revalidatePath } from "next/cache"
import * as fs from 'fs'
import * as path from 'path'

function logDebug(message: string, data?: any) {
    const logPath = path.join(process.cwd(), 'debug.txt')
    const timestamp = new Date().toISOString()
    const logLine = `[${timestamp}] ${message} ${data ? JSON.stringify(data) : ''}\n`
    fs.appendFileSync(logPath, logLine)
}

export async function uploadExcel(formData: FormData) {
    const file = formData.get('file') as File

    if (!file) {
        throw new Error('Dosya yüklenmedi.')
    }

    try {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Use header:1 to get array of arrays, allowing index-based access (A=0, B=1, ... W=22)
        let data: any[][] = []

        // Check for HTML content (common in "fake" xls exports)
        const firstBytes = buffer.subarray(0, 100).toString().toLowerCase()
        if (firstBytes.includes('<html') || firstBytes.includes('<!doctype html') || firstBytes.includes('<table')) {
            console.log("Detected HTML/XML file disguised as Excel. Attempting manual parse...")
            logDebug("File detected as HTML/XML exports. Parsing manually.")

            const fileContent = buffer.toString()
            // Naive HTML Table Parser
            // Find all <tr>
            const rows = fileContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []

            data = rows.map(rowHtml => {
                // Find all <td>
                const cells = rowHtml.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []
                return cells.map(cell => {
                    // Strip tags
                    return cell.replace(/<[^>]+>/g, '').trim()
                })
            })
        } else {
            const workbook = XLSX.read(buffer, { type: 'buffer' })
            const sheetName = workbook.SheetNames[0]
            const sheet = workbook.Sheets[sheetName]
            data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
        }

        logDebug('Upload started. Total rows identified:', data.length)

        if (data.length > 0) {
            const previewRow = data.length > 1 ? data[1] : data[0]
            logDebug('Preview of data row (Index 1 or 0):', previewRow)
            if (previewRow) {
                logDebug('TC Check (Index 7):', previewRow[7])
            }
        }

        let successCount = 0
        let errorCount = 0

        // Skip header row if it exists. We assume row 0 is header.
        // We'll filter for rows that look like data (have TC at index 7).
        const startRow = 1

        for (let i = startRow; i < data.length; i++) {
            const row = data[i]
            if (!row || row.length === 0) continue

            // Column Mapping (0-based index matches A-W)
            // A: İlçe (0)
            // B: Mahalle (1)
            // C: Ad (2)
            // D: Soyad (3)
            // E: Anne Adı (4)
            // F: Baba Adı (5)
            // G: Cinsiyet (6)
            // H: T.C. No (7)
            // I: Telefon (8)
            // J: Meslek (9)
            // K: Tahsil (10)
            // L: Yargitay Durumu (11)
            // M: D. Tarihi (12)
            // N: D. Yeri (13)
            // O: Sandık No (14)
            // P: Kan Grubu (15)
            // Q: Karar No (16)
            // R: Karar Tarihi (17)
            // S: Üye Kayıt Tarihi (18)
            // T: Adres (19)
            // U: Görevi (20)
            // V: Sms İstiyorum (21)
            // W: Üye Yapan (22)

            const ilce = String(row[0] || '').trim()
            const mahalle = String(row[1] || '').trim()
            const ad = String(row[2] || '').trim()
            const soyad = String(row[3] || '').trim()
            const anneAdi = String(row[4] || '').trim()
            const babaAdi = String(row[5] || '').trim()
            const cinsiyet = String(row[6] || '').trim()
            const tcNo = String(row[7] || '').trim()
            const telefon = String(row[8] || '').trim()
            const meslek = String(row[9] || '').trim()
            const tahsil = String(row[10] || '').trim()
            const yargitayDurumu = String(row[11] || '').trim()
            const dogumTarihi = String(row[12] || '').trim()
            const dogumYeri = String(row[13] || '').trim()
            const sandikNo = String(row[14] || '').trim()
            const kanGrubu = String(row[15] || '').trim()
            const kararNo = String(row[16] || '').trim()
            const kararTarihi = String(row[17] || '').trim()
            const uyeKayitTarihi = String(row[18] || '').trim()
            const adres = String(row[19] || '').trim()
            const gorevi = String(row[20] || '').trim()
            const smsIstiyorum = String(row[21] || '').trim()
            const uyeYapan = String(row[22] || '').trim()

            // TC Validation
            if (!tcNo || tcNo.length < 11) {
                // Determine if this is just an empty row or invalid data
                if (tcNo.length > 0) {
                    console.warn(`Row ${i + 1}: Skipped invalid TC: "${tcNo}" (Length: ${tcNo.length})`)
                    errorCount++
                } else {
                    console.log(`Row ${i + 1}: TC is empty.`)
                }
                continue
            }

            try {
                await prisma.citizen.upsert({
                    where: { tcNo },
                    update: {
                        ilce,
                        mahalle,
                        ad,
                        soyad,
                        anneAdi,
                        babaAdi,
                        cinsiyet,
                        telefon,
                        meslek,
                        tahsil,
                        yargitayDurumu,
                        dogumTarihi,
                        dogumYeri,
                        sandikNo,
                        kanGrubu,
                        kararNo,
                        kararTarihi,
                        uyeKayitTarihi,
                        adres,
                        gorevi,
                        smsIstiyorum,
                        uyeYapan,
                        password: telefon, // Set password to phone number
                    },
                    create: {
                        tcNo,
                        ilce,
                        mahalle,
                        ad,
                        soyad,
                        anneAdi,
                        babaAdi,
                        cinsiyet,
                        telefon,
                        meslek,
                        tahsil,
                        yargitayDurumu,
                        dogumTarihi,
                        dogumYeri,
                        sandikNo,
                        kanGrubu,
                        kararNo,
                        kararTarihi,
                        uyeKayitTarihi,
                        adres,
                        gorevi,
                        smsIstiyorum,
                        uyeYapan,
                        password: telefon, // Set password to phone number
                    },
                })
                successCount++
            } catch (err) {
                console.error(`Row ${i + 1} processing error:`, err)
                errorCount++
            }
        }

        revalidatePath('/dashboard')
        return { success: true, count: successCount, errors: errorCount }
    } catch (error) {
        console.error('Excel Import Error:', error)
        throw new Error('Dosya işlenirken hata oluştu.')
    }
}
