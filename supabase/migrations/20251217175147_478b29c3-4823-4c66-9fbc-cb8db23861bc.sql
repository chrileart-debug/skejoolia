-- 1) Normalize stored phone numbers (digits only)
UPDATE public.clientes
SET telefone = regexp_replace(telefone, '\\D', '', 'g')
WHERE telefone IS NOT NULL;

-- Treat empty phones as NULL so uniqueness behaves sensibly
UPDATE public.clientes
SET telefone = NULL
WHERE telefone IS NOT NULL AND btrim(telefone) = '';

-- 2) Merge duplicates (same barbershop_id + telefone)
WITH scored AS (
  SELECT
    client_id,
    barbershop_id,
    telefone,
    (
      (CASE WHEN nome IS NOT NULL AND btrim(nome) <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN email IS NOT NULL AND btrim(email) <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN birth_date IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN notes IS NOT NULL AND btrim(notes) <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN avatar_url IS NOT NULL AND btrim(avatar_url) <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN last_visit IS NOT NULL THEN 1 ELSE 0 END)
    ) AS completeness,
    updated_at,
    created_at
  FROM public.clientes
  WHERE telefone IS NOT NULL
),
ranked AS (
  SELECT
    *,
    row_number() OVER (
      PARTITION BY barbershop_id, telefone
      ORDER BY completeness DESC, updated_at DESC, created_at DESC
    ) AS rn,
    first_value(client_id) OVER (
      PARTITION BY barbershop_id, telefone
      ORDER BY completeness DESC, updated_at DESC, created_at DESC
    ) AS survivor_id
  FROM scored
),
dupes AS (
  SELECT barbershop_id, telefone, client_id AS duplicate_id, survivor_id
  FROM ranked
  WHERE rn > 1
)
-- Re-point appointments to the surviving client
UPDATE public.agendamentos a
SET client_id = d.survivor_id,
    updated_at = timezone('utc', now())
FROM dupes d
WHERE a.barbershop_id = d.barbershop_id
  AND a.client_id = d.duplicate_id;

-- Delete duplicate client rows
WITH scored AS (
  SELECT
    client_id,
    barbershop_id,
    telefone,
    (
      (CASE WHEN nome IS NOT NULL AND btrim(nome) <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN email IS NOT NULL AND btrim(email) <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN birth_date IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN notes IS NOT NULL AND btrim(notes) <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN avatar_url IS NOT NULL AND btrim(avatar_url) <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN last_visit IS NOT NULL THEN 1 ELSE 0 END)
    ) AS completeness,
    updated_at,
    created_at
  FROM public.clientes
  WHERE telefone IS NOT NULL
),
ranked AS (
  SELECT
    *,
    row_number() OVER (
      PARTITION BY barbershop_id, telefone
      ORDER BY completeness DESC, updated_at DESC, created_at DESC
    ) AS rn
  FROM scored
),
dupes AS (
  SELECT client_id AS duplicate_id
  FROM ranked
  WHERE rn > 1
)
DELETE FROM public.clientes c
USING dupes d
WHERE c.client_id = d.duplicate_id;

-- 3) Enforce uniqueness going forward
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clientes_barbershop_telefone_unique'
  ) THEN
    ALTER TABLE public.clientes
    ADD CONSTRAINT clientes_barbershop_telefone_unique
    UNIQUE (barbershop_id, telefone);
  END IF;
END$$;
