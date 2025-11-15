-- Lithuanian Voice Assistant Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT,
    default_voice_id TEXT,
    model_id TEXT DEFAULT 'eleven_v3',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create voice_presets table
CREATE TABLE IF NOT EXISTS voice_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    eleven_voice_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    stability FLOAT8 DEFAULT 0.5,
    similarity_boost FLOAT8 DEFAULT 0.8,
    style FLOAT8 DEFAULT 0.0,
    speed FLOAT8 DEFAULT 1.0,
    use_speaker_boost BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    meta JSONB
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    text TEXT NOT NULL,
    raw_stt JSONB,
    tts_voice_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_voice_presets_agent_id ON voice_presets(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Insert default agent
INSERT INTO agents (name, description, system_prompt, model_id)
VALUES (
    'Pagrindinis asistentas',
    'Lietuviškai kalbantis balso asistentas',
    'Tu esi naudingas balso asistentas. Visada atsakyk lietuvių kalba. Būk mandagus, aiškus ir glaustus.',
    'eleven_v3'
)
ON CONFLICT DO NOTHING;

-- Success message
SELECT 'Database schema created successfully!' AS status;

