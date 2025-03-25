-- Option 1: Convert the state column from enum to TEXT type
ALTER TABLE public.proposals 
  ALTER COLUMN state TYPE TEXT USING state::TEXT;

-- Option 2: If the above doesn't work, try dropping the column and recreating it
-- Uncomment these lines if Option 1 fails
-- ALTER TABLE public.proposals DROP COLUMN state;
-- ALTER TABLE public.proposals ADD COLUMN state TEXT DEFAULT '0'; 