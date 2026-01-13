import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Telefon numarasını standart formata (05XXXXXXXXX) çevirir ve sadece rakamları bırakır.
 * Boş veya geçersiz durumlarda orijinal değeri veya boş string döner.
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return ""

  // Sadece rakamları al
  let cleaned = phone.replace(/\D/g, "")

  // 90 ile başlıyorsa (12 hane) 90'ı kaldır (10 hane kalsın)
  // 905xxxxxxxxx -> 5xxxxxxxxx
  if (cleaned.length === 12 && cleaned.startsWith("90")) {
    cleaned = cleaned.substring(2)
  }

  // 10 hane ise başına 0 ekle -> 05xxxxxxxxx
  if (cleaned.length === 10) {
    cleaned = "0" + cleaned
  }

  // 11 hane değilse veya 0 ile başlamıyorsa (örn 0212... olabilir ama yine de 0 ile başlamalı)
  // Biz sadece 05xx formatını hedefliyoruz ama genel bir temizlik için 
  // eğer 11 hane ve 0 ile başlıyorsa döndür, yoksa orijinali döndür (veya temizlenmiş halini)

  // Basit kural: Temizlendikten sonra 11 hane ve 0 ile başlıyorsa tamamdır.
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    return cleaned
  }

  // Eğer format tutmuyorsa, en azından temiz halini döndürebiliriz veya orijinali.
  // Kullanıcı "standartı 05426522763 bu şekilde" dedi, yani zorlayalım.
  // Eğer 10 hane ise ve 5 ile başlıyorsa yukarıda 0 ekledik.

  return cleaned
}
