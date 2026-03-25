-- Early Adopter flag: initial users get permanent Free-tier expansion
ALTER TABLE owners ADD COLUMN IF NOT EXISTS early_adopter boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN owners.early_adopter IS 'Permanent free-tier expansion for initial adopters — Verified-level limits at $0';
