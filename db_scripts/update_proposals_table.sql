-- Add missing columns to the proposals table
ALTER TABLE public.proposals 
  ADD COLUMN IF NOT EXISTS chain_id INTEGER,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Check if state is an enum type and update it
DO $$
BEGIN
  -- First, let's see if the column exists and is defined as an enum
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'proposals' 
      AND column_name = 'state'
  ) THEN
    -- If the column exists, check if it's an enum
    IF EXISTS (
      SELECT 1 
      FROM pg_type t 
      JOIN pg_namespace n ON (n.oid = t.typnamespace) 
      JOIN pg_attribute a ON (a.atttypid = t.oid) 
      JOIN pg_class c ON (c.oid = a.attrelid) 
      WHERE n.nspname = 'public' 
        AND c.relname = 'proposals' 
        AND a.attname = 'state' 
        AND t.typtype = 'e'
    ) THEN
      -- Get the enum type name
      PERFORM (
        SELECT format('proposal_state')
        FROM pg_type t 
        JOIN pg_namespace n ON (n.oid = t.typnamespace) 
        JOIN pg_attribute a ON (a.atttypid = t.oid) 
        JOIN pg_class c ON (c.oid = a.attrelid) 
        WHERE n.nspname = 'public' 
          AND c.relname = 'proposals' 
          AND a.attname = 'state' 
        LIMIT 1
      );

      -- Try to add '0' as a valid enum value if it doesn't exist
      BEGIN
        EXECUTE 'ALTER TYPE proposal_state ADD VALUE IF NOT EXISTS ''0''';
      EXCEPTION WHEN OTHERS THEN
        -- If that fails, we'll modify the column to be TEXT type
        ALTER TABLE public.proposals 
          ALTER COLUMN state TYPE TEXT USING state::TEXT;
      END;
    END IF;
  END IF;
END $$;

-- Update the table comment
COMMENT ON TABLE public.proposals IS 'Stores DAO proposal information with blockchain and UI metadata'; 