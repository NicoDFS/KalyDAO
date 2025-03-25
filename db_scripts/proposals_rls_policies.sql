-- Enable Row Level Security on the proposals table
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access to proposals table
CREATE POLICY "Allow anonymous read access" 
ON public.proposals 
FOR SELECT 
TO anon
USING (true);

-- Allow anonymous insert access to proposals table
CREATE POLICY "Allow anonymous insert access" 
ON public.proposals 
FOR INSERT 
TO anon
WITH CHECK (true);

-- Allow anonymous update access to proposals table
CREATE POLICY "Allow anonymous update access" 
ON public.proposals 
FOR UPDATE 
TO anon
USING (true) 
WITH CHECK (true);

-- Allow authenticated users full access to proposals table
CREATE POLICY "Allow authenticated user access" 
ON public.proposals 
FOR ALL 
TO authenticated
USING (true) 
WITH CHECK (true); 