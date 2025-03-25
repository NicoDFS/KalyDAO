import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

console.log('Initializing Supabase client with URL:', supabaseUrl);
console.log('Using anonymous key (first 8 chars):', supabaseAnonKey.substring(0, 8) + '...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
});

// Enhanced debugging for table access
const checkTableAccess = async (tableName: string) => {
  console.log(`Checking access to "${tableName}" table...`);
  
  try {
    // First try a count query to check basic access
    const { count, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error(`Access error for ${tableName}:`, countError);
      
      if (countError.code === '42501') {
        console.error(`PERMISSION DENIED: Your Supabase anon key lacks permission to access the ${tableName} table.`);
        console.error('Solution: Add Row Level Security (RLS) policy to allow read access:');
        console.error(`
CREATE POLICY "Allow anonymous read access" 
ON public.${tableName}
FOR SELECT 
TO anon
USING (true);
        `);
      } else if (countError.code === '42P01') {
        console.error(`TABLE NOT FOUND: The ${tableName} table does not exist.`);
      } else {
        console.error(`Unknown error accessing ${tableName} table:`, countError);
      }
      
      return false;
    }
    
    console.log(`✓ Successfully accessed ${tableName} table - found ${count} rows.`);
    
    // Try an insert operation with rollback to check write permissions
    console.log(`Checking insert permission on ${tableName} table...`);
    
    // Start a transaction that we'll roll back
    const { error: txnError } = await supabase.rpc('check_table_insert_permission', { 
      table_name: tableName 
    });
    
    if (txnError) {
      if (txnError.message.includes('permission denied') || txnError.code === '42501') {
        console.error(`WRITE PERMISSION DENIED: Your Supabase anon key lacks permission to insert into the ${tableName} table.`);
        console.error('Solution: Add Row Level Security (RLS) policy to allow insert access:');
        console.error(`
CREATE POLICY "Allow anonymous insert access" 
ON public.${tableName}
FOR INSERT 
TO anon
WITH CHECK (true);
        `);
      } else if (txnError.message.includes('does not exist')) {
        console.error(`RPC FUNCTION NOT FOUND: The permission check function does not exist.`);
        console.error('Create this function in the Supabase SQL editor:');
        console.error(`
CREATE OR REPLACE FUNCTION check_table_insert_permission(table_name text)
RETURNS boolean AS $$
BEGIN
  -- This function will always roll back the transaction
  -- but will help us check if we have insert permission
  RAISE EXCEPTION 'ROLLBACK TRANSACTION';
  RETURN false;
END;
$$ LANGUAGE plpgsql;
        `);
      } else {
        console.warn(`Insert permission check for ${tableName} returned:`, txnError);
      }
    } else {
      console.log(`✓ Successfully verified insert permission for ${tableName} table.`);
    }
    
    return true;
  } catch (err) {
    console.error(`Unexpected error checking ${tableName} table access:`, err);
    return false;
  }
};

// Function to check if the proposals table exists and create it if needed
const ensureProposalsTableExists = async () => {
  try {
    console.log('Checking if proposals table exists...');
    
    // Use the enhanced table access check
    const hasAccess = await checkTableAccess('proposals');
    
    if (!hasAccess) {
      console.error('Proposals table may exist but you lack permission to access it.');
      console.error('Please check Row Level Security (RLS) policies in your Supabase dashboard.');
    }
  } catch (err) {
    console.error('Error checking/creating proposals table:', err);
  }
};

// Log database tables on initial load to help with debugging
(async () => {
  try {
    console.log('Checking Supabase connection and tables...');
    
    // Ensure the proposals table exists and is accessible
    await ensureProposalsTableExists();
    
    // Test querying existing proposals
    const { data: proposals, error: queryError } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (queryError) {
      console.error('Error querying proposals:', queryError);
      
      if (queryError.code === '42501') {
        console.error('PERMISSION DENIED: You need to enable Row Level Security (RLS) policies for the proposals table');
      }
    } else {
      console.log(`Found ${proposals.length} recent proposals:`, 
        proposals.map(p => ({ id: p.id, proposal_id: p.proposal_id, title: p.title }))
      );
    }
  } catch (err) {
    console.error('Error checking Supabase tables:', err);
  }
})();

// Types for our database
export type ProposalMetadata = {
  id: string;
  proposal_id: string;
  title: string;
  description: string;
  summary?: string;
  proposer_address: string;
  created_at: string;
  updated_at: string;
  state: string;
  snapshot_timestamp?: number;
  deadline_timestamp?: number;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  category?: string;
  tags?: string[];
  views_count: number;
  metadata?: Record<string, any>;
};

// Helper functions for proposals
export const proposalQueries = {
  async createProposal(data: Omit<ProposalMetadata, 'id' | 'created_at' | 'updated_at'>) {
    console.log('Attempting to create proposal:', data.proposal_id);
    
    const { data: proposal, error } = await supabase
      .from('proposals')
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error('Error creating proposal:', error);
      if (error.code === '42501') {
        console.error('PERMISSION DENIED: Check RLS policies for INSERT permission on proposals table');
      }
      throw error;
    }
    
    console.log('Proposal created successfully:', proposal.proposal_id);
    return proposal;
  },

  async getProposal(proposalId: string) {
    const { data: proposal, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('proposal_id', proposalId)
      .single();

    if (error) throw error;
    return proposal;
  },

  async updateProposalState(proposalId: string, state: string) {
    const { data: proposal, error } = await supabase
      .from('proposals')
      .update({ state })
      .eq('proposal_id', proposalId)
      .select()
      .single();

    if (error) throw error;
    return proposal;
  },

  async updateProposalVotes(
    proposalId: string,
    votes: { votes_for: number; votes_against: number; votes_abstain: number }
  ) {
    const { data: proposal, error } = await supabase
      .from('proposals')
      .update(votes)
      .eq('proposal_id', proposalId)
      .select()
      .single();

    if (error) throw error;
    return proposal;
  },

  async incrementViewCount(proposalId: string) {
    const { data: proposal, error } = await supabase.rpc('increment_proposal_views', {
      p_proposal_id: proposalId
    });

    if (error) throw error;
    return proposal;
  }
}; 