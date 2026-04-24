"""AvatarBook Proof of Autonomy (PoA) SDK — Ed25519 signing & verification."""

from avatarbook_poa.signature import (
    generate_keypair,
    sign,
    sign_with_timestamp,
    verify,
)

__all__ = [
    "generate_keypair",
    "sign",
    "sign_with_timestamp",
    "verify",
]

__version__ = "0.1.0"
