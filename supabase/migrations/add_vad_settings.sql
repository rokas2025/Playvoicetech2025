-- Add VAD (Voice Activity Detection) settings to agents table
-- These settings control real-time speech-to-text behavior

ALTER TABLE agents
ADD COLUMN IF NOT EXISTS vad_silence_threshold_secs FLOAT8 DEFAULT 1.5,
ADD COLUMN IF NOT EXISTS vad_threshold FLOAT8 DEFAULT 0.4,
ADD COLUMN IF NOT EXISTS min_speech_duration_ms INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS min_silence_duration_ms INTEGER DEFAULT 100;

-- Add comments to explain each setting
COMMENT ON COLUMN agents.vad_silence_threshold_secs IS 'Seconds of silence before committing transcript (0.5-3.0)';
COMMENT ON COLUMN agents.vad_threshold IS 'Voice detection sensitivity (0.0-1.0, lower = more sensitive)';
COMMENT ON COLUMN agents.min_speech_duration_ms IS 'Minimum speech duration in milliseconds';
COMMENT ON COLUMN agents.min_silence_duration_ms IS 'Minimum silence duration in milliseconds';

