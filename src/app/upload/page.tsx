'use client'

import { useState } from "react"
import { uploadExcel } from "./upload-action"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

export default function UploadPage() {
    const [uploading, setUploading] = useState(false)
    const [result, setResult] = useState<{ success: boolean; count: number; errors: number } | null>(null)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setUploading(true)
        setResult(null)

        const formData = new FormData(event.currentTarget)

        try {
            const res = await uploadExcel(formData)
            setResult(res)
        } catch (error) {
            console.error(error)
            alert("Yükleme sırasında hata oluştu!")
        } finally {
            setUploading(false)
            // Reset form?
            event.currentTarget.reset()
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
            <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-green-600">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <FileSpreadsheet className="h-6 w-6 text-green-600" />
                        Excel Yükleme Paneli
                    </CardTitle>
                    <CardDescription>
                        Kullanıcı verilerini güncellemek için .xlsx dosyasını seçin.
                        TC Kimlik Numarası eşleşen kayıtlar güncellenecek, bulunamayanlar eklenecektir.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="file" className="block text-sm font-medium text-gray-700">Excel Dosyası</Label>
                            <Input
                                id="file"
                                name="file"
                                type="file"
                                accept=".xlsx, .xls"
                                required
                                className="cursor-pointer file:cursor-pointer file:text-green-700 file:font-semibold"
                            />
                        </div>

                        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={uploading}>
                            {uploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> İşleniyor...
                                </>
                            ) : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" /> Yükle ve Güncelle
                                </>
                            )}
                        </Button>
                    </form>

                    {result && (
                        <div className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                            {result.success ? <CheckCircle className="h-5 w-5 mt-0.5" /> : <AlertCircle className="h-5 w-5 mt-0.5" />}
                            <div>
                                <h4 className="font-semibold">{result.success ? "İşlem Başarılı" : "Hata"}</h4>
                                <p className="text-sm mt-1">
                                    {result.count} kayıt başarıyla işlendi. <br />
                                    {result.errors > 0 && <span className="text-red-600 font-bold">{result.errors} satırda hata/eksik veri tespit edildi.</span>}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
