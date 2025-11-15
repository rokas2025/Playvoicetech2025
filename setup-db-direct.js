// Setup Supabase Database using Supabase JS Client
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://wcecsvujnooyrkkcqutj.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjZWNzdnVqbm9veXJra2NxdXRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzIxNTQ5OSwiZXhwIjoyMDc4NzkxNDk5fQ.gc9zMTdnqi4GgzlatXQjAznv0rgQ1Fh3Ba1KyA1wTtI';

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database...\n');

  try {
    // First, create a helper function in the database to execute SQL
    console.log('📝 Creating SQL execution function...');
    
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql_query;
        RETURN 'Success';
      EXCEPTION WHEN OTHERS THEN
        RETURN 'Error: ' || SQLERRM;
      END;
      $$;
    `;
    
    // Try to call the function (if it doesn't exist, we'll get an error)
    const { data: testData, error: testError } = await supabase.rpc('exec_sql', {
      sql_query: 'SELECT 1'
    });
    
    if (testError && testError.message.includes('function')) {
      console.log('⚠️  Cannot execute DDL via REST API directly.');
      console.log('');
      console.log('📋 Please run the SQL manually:');
      console.log('1. Go to: https://supabase.com/dashboard/project/wcecsvujnooyrkkcqutj/sql');
      console.log('2. Click "New Query"');
      console.log('3. Copy contents of create-tables.sql');
      console.log('4. Run the query');
      console.log('');
      console.log('After that, verify by running this script again.');
      return;
    }
    
    // Check if tables exist
    console.log('🔍 Checking if tables exist...');
    const { data: agents, error: checkError } = await supabase
      .from('agents')
      .select('id')
      .limit(1);
    
    if (!checkError) {
      console.log('✅ Tables already exist!');
      
      // Get all agents
      const { data: allAgents } = await supabase
        .from('agents')
        .select('*');
      
      if (allAgents && allAgents.length > 0) {
        console.log(`📊 Found ${allAgents.length} agent(s):`);
        allAgents.forEach(agent => {
          console.log(`   - ${agent.name} (ID: ${agent.id})`);
        });
      } else {
        console.log('⚠️  No agents found. Creating default agent...');
        await createDefaultAgent();
      }
      
      console.log('\n✅ Database setup complete!');
      return;
    }
    
    console.log('⚠️  Tables do not exist yet.');
    console.log('');
    console.log('📋 Please create tables manually:');
    console.log('1. Go to: https://supabase.com/dashboard/project/wcecsvujnooyrkkcqutj/sql');
    console.log('2. Click "New Query"');
    console.log('3. Copy the contents of create-tables.sql');
    console.log('4. Paste and run the query');
    console.log('5. Run this script again to verify');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function createDefaultAgent() {
  const { data, error } = await supabase
    .from('agents')
    .insert({
      name: 'Pagrindinis asistentas',
      description: 'Lietuviškai kalbantis balso asistentas',
      system_prompt: 'Tu esi naudingas balso asistentas. Visada atsakyk lietuvių kalba. Būk mandagus, aiškus ir glaustus.',
      model_id: 'eleven_v3'
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating agent:', error.message);
  } else {
    console.log('✅ Default agent created:', data.name);
  }
}

setupDatabase();

