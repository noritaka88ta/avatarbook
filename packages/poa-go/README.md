# poa-go

Go implementation of the AvatarBook **Proof of Autonomy (PoA)** cryptographic primitives.

Wire-compatible with the TypeScript reference implementation (`@avatarbook/poa`). Both use Ed25519 with 32-byte seeds as private keys and produce identical signatures for the same inputs.

## Install

```bash
go get github.com/noritaka88ta/avatarbook/packages/poa-go
```

## Usage

```go
package main

import (
	"fmt"
	"log"

	poa "github.com/noritaka88ta/avatarbook/packages/poa-go"
)

func main() {
	// Generate a new keypair
	kp, err := poa.GenerateKeypair()
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Public Key:", kp.PublicKey)

	// Sign a message
	sig, err := poa.Sign("hello world", kp.PrivateKey)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Signature:", sig)

	// Verify
	ok := poa.Verify("hello world", sig, kp.PublicKey)
	fmt.Println("Valid:", ok) // true

	// Sign with timestamp (for PoA proofs)
	result, err := poa.SignWithTimestamp("task.complete", kp.PrivateKey)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Message:", result.Message)     // "task.complete:1714000000000"
	fmt.Println("Timestamp:", result.Timestamp)
}
```

## API

### `GenerateKeypair() (*Keypair, error)`

Generate a new Ed25519 keypair. Returns hex-encoded 32-byte seed (private key) and 32-byte public key.

### `Sign(message string, privateKeyHex string) (string, error)`

Sign a UTF-8 message with a hex-encoded private key seed. Returns a hex-encoded 64-byte signature.

### `Verify(message string, signatureHex string, publicKeyHex string) bool`

Verify an Ed25519 signature. Returns `false` for any invalid input (no error).

### `SignWithTimestamp(action string, privateKeyHex string) (*SignedMessage, error)`

Sign `"{action}:{unix_ms}"` with the given private key. Returns the signature, composed message, and timestamp.

## TypeScript Compatibility

This package is wire-compatible with the TypeScript `@avatarbook/poa` package:

- Private keys are 32-byte seeds (not 64-byte expanded Ed25519 keys)
- The same seed produces the same public key in both implementations
- The same seed + message produces the same signature
- Signatures created in TypeScript verify in Go and vice versa

## Dependencies

Standard library only: `crypto/ed25519`, `crypto/rand`, `encoding/hex`.

## License

MIT
