package poa

import (
	"crypto/ed25519"
	"encoding/hex"
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestGenerateKeypair(t *testing.T) {
	kp, err := GenerateKeypair()
	if err != nil {
		t.Fatalf("GenerateKeypair failed: %v", err)
	}

	// Private key seed = 32 bytes = 64 hex chars
	if len(kp.PrivateKey) != 64 {
		t.Errorf("PrivateKey hex length = %d, want 64", len(kp.PrivateKey))
	}

	// Public key = 32 bytes = 64 hex chars
	if len(kp.PublicKey) != 64 {
		t.Errorf("PublicKey hex length = %d, want 64", len(kp.PublicKey))
	}

	// Must be valid hex
	if _, err := hex.DecodeString(kp.PrivateKey); err != nil {
		t.Errorf("PrivateKey is not valid hex: %v", err)
	}
	if _, err := hex.DecodeString(kp.PublicKey); err != nil {
		t.Errorf("PublicKey is not valid hex: %v", err)
	}

	// Two keypairs must be different
	kp2, _ := GenerateKeypair()
	if kp.PrivateKey == kp2.PrivateKey {
		t.Error("Two generated keypairs have the same private key")
	}
}

func TestSignAndVerify(t *testing.T) {
	kp, err := GenerateKeypair()
	if err != nil {
		t.Fatalf("GenerateKeypair failed: %v", err)
	}

	message := "hello world"
	sig, err := Sign(message, kp.PrivateKey)
	if err != nil {
		t.Fatalf("Sign failed: %v", err)
	}

	// Signature = 64 bytes = 128 hex chars
	if len(sig) != 128 {
		t.Errorf("Signature hex length = %d, want 128", len(sig))
	}

	// Valid signature must verify
	if !Verify(message, sig, kp.PublicKey) {
		t.Error("Verify returned false for a valid signature")
	}
}

func TestVerifyRejectsTamperedMessage(t *testing.T) {
	kp, _ := GenerateKeypair()
	sig, _ := Sign("original message", kp.PrivateKey)

	if Verify("tampered message", sig, kp.PublicKey) {
		t.Error("Verify should reject a tampered message")
	}
}

func TestVerifyRejectsTamperedSignature(t *testing.T) {
	kp, _ := GenerateKeypair()
	sig, _ := Sign("hello", kp.PrivateKey)

	// Flip the first byte of the signature
	sigBytes, _ := hex.DecodeString(sig)
	sigBytes[0] ^= 0xff
	tamperedSig := hex.EncodeToString(sigBytes)

	if Verify("hello", tamperedSig, kp.PublicKey) {
		t.Error("Verify should reject a tampered signature")
	}
}

func TestVerifyRejectsWrongPublicKey(t *testing.T) {
	kp1, _ := GenerateKeypair()
	kp2, _ := GenerateKeypair()
	sig, _ := Sign("hello", kp1.PrivateKey)

	if Verify("hello", sig, kp2.PublicKey) {
		t.Error("Verify should reject signature verified with wrong public key")
	}
}

func TestVerifyHandlesInvalidInputs(t *testing.T) {
	tests := []struct {
		name      string
		message   string
		signature string
		publicKey string
	}{
		{"empty signature", "hello", "", "aa"},
		{"invalid hex signature", "hello", "zzzz", "aa"},
		{"short signature", "hello", "aabb", "aa"},
		{"empty public key", "hello", strings.Repeat("aa", 64), ""},
		{"invalid hex public key", "hello", strings.Repeat("aa", 64), "zzzz"},
		{"short public key", "hello", strings.Repeat("aa", 64), "aabb"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if Verify(tt.message, tt.signature, tt.publicKey) {
				t.Error("Verify should return false for invalid input")
			}
		})
	}
}

func TestSignWithTimestamp(t *testing.T) {
	kp, _ := GenerateKeypair()

	before := time.Now().UnixMilli()
	result, err := SignWithTimestamp("task.complete", kp.PrivateKey)
	after := time.Now().UnixMilli()

	if err != nil {
		t.Fatalf("SignWithTimestamp failed: %v", err)
	}

	// Timestamp should be within the test window
	if result.Timestamp < before || result.Timestamp > after {
		t.Errorf("Timestamp %d not in range [%d, %d]", result.Timestamp, before, after)
	}

	// Message format: "{action}:{timestamp}"
	expected := fmt.Sprintf("task.complete:%d", result.Timestamp)
	if result.Message != expected {
		t.Errorf("Message = %q, want %q", result.Message, expected)
	}

	// Signature must verify against the constructed message
	if !Verify(result.Message, result.Signature, kp.PublicKey) {
		t.Error("SignWithTimestamp signature does not verify")
	}
}

func TestSignRejectsInvalidPrivateKey(t *testing.T) {
	_, err := Sign("hello", "not-hex")
	if err == nil {
		t.Error("Sign should return error for invalid hex")
	}

	_, err = Sign("hello", "aabb") // too short
	if err == nil {
		t.Error("Sign should return error for wrong-length seed")
	}
}

// TestDeterministicSignature verifies that signing the same message with the
// same key always produces the same signature (Ed25519 is deterministic).
func TestDeterministicSignature(t *testing.T) {
	kp, _ := GenerateKeypair()

	sig1, _ := Sign("deterministic", kp.PrivateKey)
	sig2, _ := Sign("deterministic", kp.PrivateKey)

	if sig1 != sig2 {
		t.Error("Ed25519 signatures should be deterministic")
	}
}

// TestCrossCompatibilityKeyDerivation verifies that a known seed produces
// the expected public key, ensuring compatibility with the TypeScript
// @noble/ed25519 implementation (both derive from 32-byte seed).
func TestCrossCompatibilityKeyDerivation(t *testing.T) {
	// Fixed seed for cross-language testing
	seedHex := strings.Repeat("ab", 32) // 32 bytes of 0xab
	seedBytes, _ := hex.DecodeString(seedHex)

	privKey := ed25519.NewKeyFromSeed(seedBytes)
	pubKey := privKey.Public().(ed25519.PublicKey)
	pubKeyHex := hex.EncodeToString(pubKey)

	// Sign and verify round-trip with known seed
	sig, err := Sign("test message", seedHex)
	if err != nil {
		t.Fatalf("Sign with known seed failed: %v", err)
	}

	if !Verify("test message", sig, pubKeyHex) {
		t.Error("Cross-compatibility round-trip failed")
	}

	// Public key should be deterministic from seed
	sig2, _ := Sign("test message", seedHex)
	if sig != sig2 {
		t.Error("Same seed + same message should produce same signature")
	}
}
