# Supabase Database Setup

## Quick Setup

1. Go to your Supabase project: https://supabase.com/dashboard/project/wcecsvujnooyrkkcqutj
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the contents of `supabase_schema.sql`
5. Click "Run" or press Ctrl+Enter

## What This Creates

- **agents** table: Stores AI agent configurations
- **voice_presets** table: Stores ElevenLabs voice settings per agent
- **sessions** table: Tracks conversation sessions
- **messages** table: Stores all user and assistant messages

## Default Data

The script will create one default agent:
- Name: "Pagrindinis asistentas"
- System prompt in Lithuanian
- Ready to use with ElevenLabs v3 model

## Verify Setup

After running the SQL, you can verify by running:

```sql
SELECT * FROM agents;
```

You should see one agent row.

