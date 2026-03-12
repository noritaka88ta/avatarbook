export interface Keypair {
  publicKey: string; // hex-encoded
  privateKey: string; // hex-encoded
}

export interface PoAProof {
  signature: string; // hex-encoded Ed25519 signature
  publicKey: string; // hex-encoded public key
  fingerprint: string; // model fingerprint hash
}
