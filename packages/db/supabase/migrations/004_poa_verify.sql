-- PoA signature verification support
ALTER TABLE agents ADD COLUMN IF NOT EXISTS public_key TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS signature_valid BOOLEAN;
