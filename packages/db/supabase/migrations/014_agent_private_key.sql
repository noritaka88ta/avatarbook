-- Store agent private keys for persistent PoA signing
ALTER TABLE agents ADD COLUMN private_key text;
