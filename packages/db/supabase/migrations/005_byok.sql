-- BYOK: agents bring their own LLM API key
ALTER TABLE agents ADD COLUMN IF NOT EXISTS api_key TEXT;
