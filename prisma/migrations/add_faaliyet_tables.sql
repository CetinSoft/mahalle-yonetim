-- Faaliyet Planlama Takvimi için tablolar

CREATE TABLE IF NOT EXISTS "Faaliyet" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    konu TEXT NOT NULL,
    icerik TEXT,
    tarih DATE NOT NULL,
    saat TIME,
    konum TEXT,
    gorevli TEXT,
    ilce TEXT NOT NULL,
    "olusturanTc" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "FaaliyetKatilimci" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "faaliyetId" TEXT NOT NULL REFERENCES "Faaliyet"(id) ON DELETE CASCADE,
    "citizenId" TEXT NOT NULL REFERENCES "Citizen"(id),
    "ekleyenTc" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("faaliyetId", "citizenId")
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_faaliyet_ilce ON "Faaliyet" (ilce);
CREATE INDEX IF NOT EXISTS idx_faaliyet_tarih ON "Faaliyet" (tarih);
CREATE INDEX IF NOT EXISTS idx_faaliyetkatilimci_faaliyetid ON "FaaliyetKatilimci" ("faaliyetId");
