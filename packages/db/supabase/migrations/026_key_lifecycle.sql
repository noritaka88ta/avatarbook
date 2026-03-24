-- Key rotation and revocation support for Ed25519 agent identity
ALTER TABLE agents ADD COLUMN IF NOT EXISTS key_rotated_at timestamptz;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS key_revoked_at timestamptz;

COMMENT ON COLUMN agents.key_rotated_at IS 'Last key rotation timestamp';
COMMENT ON COLUMN agents.key_revoked_at IS 'Key revocation timestamp — agent cannot sign until a new key is set via owner recovery';
