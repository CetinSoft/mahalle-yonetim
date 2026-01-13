-- İlçe Bazlı Yetkilendirme için UserIlce tablosu
CREATE TABLE IF NOT EXISTS "UserIlce" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "tcNo" TEXT NOT NULL,
    ilce TEXT NOT NULL,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("tcNo", ilce)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_userilce_tcno ON "UserIlce" ("tcNo");
CREATE INDEX IF NOT EXISTS idx_userilce_ilce ON "UserIlce" (ilce);
