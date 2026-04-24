"""Ed25519 signature utilities for Proof of Autonomy (PoA).

All keys and signatures are hex-encoded strings.
- Private key: 64 hex chars (32 bytes)
- Public key:  64 hex chars (32 bytes)
- Signature:  128 hex chars (64 bytes)

Compatible with the TypeScript implementation in packages/poa/src/signature.ts.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from nacl.signing import SigningKey, VerifyKey
from nacl.exceptions import BadSignatureError


@dataclass(frozen=True, slots=True)
class Keypair:
    """Ed25519 keypair with hex-encoded keys."""

    private_key: str  # 64 hex chars (32 bytes seed)
    public_key: str   # 64 hex chars (32 bytes)


def generate_keypair() -> Keypair:
    """Generate a new Ed25519 keypair (hex-encoded).

    Returns:
        Keypair with hex-encoded private and public keys.
    """
    signing_key = SigningKey.generate()
    private_hex = signing_key.encode().hex()
    public_hex = signing_key.verify_key.encode().hex()
    return Keypair(private_key=private_hex, public_key=public_hex)


def sign(message: str, private_key_hex: str) -> str:
    """Sign a UTF-8 message with an Ed25519 private key.

    Args:
        message: The message string to sign.
        private_key_hex: Hex-encoded 32-byte private key (seed).

    Returns:
        Hex-encoded 64-byte signature.
    """
    signing_key = SigningKey(bytes.fromhex(private_key_hex))
    msg_bytes = message.encode("utf-8")
    signed = signing_key.sign(msg_bytes)
    # signed.signature is the detached 64-byte signature
    return signed.signature.hex()


def verify(message: str, signature_hex: str, public_key_hex: str) -> bool:
    """Verify an Ed25519 signature against a message and public key.

    Args:
        message: The original message string.
        signature_hex: Hex-encoded 64-byte signature.
        public_key_hex: Hex-encoded 32-byte public key.

    Returns:
        True if the signature is valid, False otherwise.
    """
    try:
        verify_key = VerifyKey(bytes.fromhex(public_key_hex))
        msg_bytes = message.encode("utf-8")
        sig_bytes = bytes.fromhex(signature_hex)
        verify_key.verify(msg_bytes, sig_bytes)
        return True
    except (BadSignatureError, ValueError, Exception):
        return False


def sign_with_timestamp(action: str, private_key_hex: str) -> tuple[str, int]:
    """Sign an action with a millisecond timestamp appended.

    The signed message format is "{action}:{timestamp_ms}", matching the
    TypeScript convention used in the PoA protocol.

    Args:
        action: The action string (e.g. "post:content-hash").
        private_key_hex: Hex-encoded 32-byte private key (seed).

    Returns:
        Tuple of (hex-encoded signature, timestamp in milliseconds).
    """
    timestamp_ms = int(time.time() * 1000)
    message = f"{action}:{timestamp_ms}"
    sig = sign(message, private_key_hex)
    return sig, timestamp_ms
