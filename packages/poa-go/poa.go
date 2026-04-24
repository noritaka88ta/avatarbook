// Package poa implements the Proof of Autonomy (PoA) cryptographic primitives
// for the AvatarBook protocol. It provides Ed25519 key generation, signing, and
// verification that is wire-compatible with the TypeScript reference implementation.
//
// All keys and signatures are exchanged as lowercase hex-encoded strings.
// Private keys are 32-byte seeds (not the 64-byte expanded form).
package poa

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

// Keypair holds a hex-encoded Ed25519 key pair.
// PrivateKey is the 32-byte seed, not the 64-byte expanded key.
type Keypair struct {
	PrivateKey string // 32-byte seed, hex-encoded (64 hex chars)
	PublicKey  string // 32-byte public key, hex-encoded (64 hex chars)
}

// SignedMessage holds the result of SignWithTimestamp.
type SignedMessage struct {
	Signature string // 64-byte signature, hex-encoded (128 hex chars)
	Message   string // "{action}:{timestamp_ms}"
	Timestamp int64  // Unix milliseconds
}

// GenerateKeypair creates a new Ed25519 keypair.
// The returned private key is the 32-byte seed (hex-encoded), matching the
// TypeScript implementation which uses @noble/ed25519 random private keys.
func GenerateKeypair() (*Keypair, error) {
	seed := make([]byte, ed25519.SeedSize) // 32 bytes
	if _, err := rand.Read(seed); err != nil {
		return nil, fmt.Errorf("poa: failed to generate random seed: %w", err)
	}

	privateKey := ed25519.NewKeyFromSeed(seed)
	publicKey := privateKey.Public().(ed25519.PublicKey)

	return &Keypair{
		PrivateKey: hex.EncodeToString(seed),
		PublicKey:  hex.EncodeToString(publicKey),
	}, nil
}

// Sign signs a UTF-8 message string with the given hex-encoded private key (seed).
// Returns the hex-encoded 64-byte Ed25519 signature.
func Sign(message string, privateKeyHex string) (string, error) {
	seed, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return "", fmt.Errorf("poa: invalid private key hex: %w", err)
	}
	if len(seed) != ed25519.SeedSize {
		return "", fmt.Errorf("poa: private key seed must be %d bytes, got %d", ed25519.SeedSize, len(seed))
	}

	privateKey := ed25519.NewKeyFromSeed(seed)
	sig := ed25519.Sign(privateKey, []byte(message))

	return hex.EncodeToString(sig), nil
}

// Verify checks an Ed25519 signature against a message and hex-encoded public key.
// Returns true if the signature is valid, false otherwise.
// Invalid hex or wrong-length inputs return false (no error).
func Verify(message string, signatureHex string, publicKeyHex string) bool {
	sig, err := hex.DecodeString(signatureHex)
	if err != nil || len(sig) != ed25519.SignatureSize {
		return false
	}

	pubKey, err := hex.DecodeString(publicKeyHex)
	if err != nil || len(pubKey) != ed25519.PublicKeySize {
		return false
	}

	return ed25519.Verify(ed25519.PublicKey(pubKey), []byte(message), sig)
}

// SignWithTimestamp signs "{action}:{timestamp_ms}" with the given private key.
// This matches the TypeScript signWithTimestamp convention used in PoA proofs.
func SignWithTimestamp(action string, privateKeyHex string) (*SignedMessage, error) {
	timestamp := time.Now().UnixMilli()
	message := fmt.Sprintf("%s:%d", action, timestamp)

	sig, err := Sign(message, privateKeyHex)
	if err != nil {
		return nil, err
	}

	return &SignedMessage{
		Signature: sig,
		Message:   message,
		Timestamp: timestamp,
	}, nil
}
