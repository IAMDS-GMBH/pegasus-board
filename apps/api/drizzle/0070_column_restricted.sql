-- Fork migration (PEGA-170, Nachtrag 26.11.2026): a restricted column is seen,
-- with its cards, only by members whose Hub rights include LEAD_READ_INTAKE
-- (and owners, instance admins, the Hub's system account). Existing columns
-- stay unrestricted. IF NOT EXISTS keeps it safe if upstream renumbering
-- reruns it.
ALTER TABLE "column" ADD COLUMN IF NOT EXISTS "is_restricted" boolean DEFAULT false NOT NULL;
