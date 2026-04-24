"""Tests for avatarbook_poa — mirrors packages/poa/src/signature.test.ts."""

from __future__ import annotations

import re
import sys
import time
from pathlib import Path

import pytest

# Ensure src is importable when running from the package root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from avatarbook_poa import generate_keypair, sign, sign_with_timestamp, verify


# ---------------------------------------------------------------------------
# generate_keypair
# ---------------------------------------------------------------------------

class TestGenerateKeypair:
    def test_returns_64_char_hex_strings(self) -> None:
        kp = generate_keypair()
        assert re.fullmatch(r"[0-9a-f]{64}", kp.private_key)
        assert re.fullmatch(r"[0-9a-f]{64}", kp.public_key)

    def test_generates_unique_keypairs(self) -> None:
        a = generate_keypair()
        b = generate_keypair()
        assert a.private_key != b.private_key
        assert a.public_key != b.public_key


# ---------------------------------------------------------------------------
# sign + verify
# ---------------------------------------------------------------------------

class TestSignVerify:
    def test_valid_signature_verifies(self) -> None:
        kp = generate_keypair()
        sig = sign("hello", kp.private_key)
        assert verify("hello", sig, kp.public_key) is True

    def test_wrong_message_fails(self) -> None:
        kp = generate_keypair()
        sig = sign("hello", kp.private_key)
        assert verify("world", sig, kp.public_key) is False

    def test_wrong_public_key_fails(self) -> None:
        kp1 = generate_keypair()
        kp2 = generate_keypair()
        sig = sign("hello", kp1.private_key)
        assert verify("hello", sig, kp2.public_key) is False

    def test_tampered_signature_fails(self) -> None:
        kp = generate_keypair()
        sig = sign("hello", kp.private_key)
        tampered = "ff" + sig[2:]
        assert verify("hello", tampered, kp.public_key) is False

    def test_empty_message_works(self) -> None:
        kp = generate_keypair()
        sig = sign("", kp.private_key)
        assert verify("", sig, kp.public_key) is True

    def test_unicode_message_works(self) -> None:
        kp = generate_keypair()
        msg = "こんにちは世界 🌍"
        sig = sign(msg, kp.private_key)
        assert verify(msg, sig, kp.public_key) is True

    def test_signature_is_128_char_hex(self) -> None:
        kp = generate_keypair()
        sig = sign("test", kp.private_key)
        assert re.fullmatch(r"[0-9a-f]{128}", sig)

    def test_timestamped_message_format_works(self) -> None:
        kp = generate_keypair()
        ts = int(time.time() * 1000)
        action = f"post:content-hash:{ts}"
        sig = sign(action, kp.private_key)
        assert verify(action, sig, kp.public_key) is True


# ---------------------------------------------------------------------------
# verify edge cases
# ---------------------------------------------------------------------------

class TestVerifyEdgeCases:
    def test_invalid_hex_returns_false(self) -> None:
        kp = generate_keypair()
        assert verify("hello", "not-hex", kp.public_key) is False

    def test_short_signature_returns_false(self) -> None:
        kp = generate_keypair()
        assert verify("hello", "abcd", kp.public_key) is False


# ---------------------------------------------------------------------------
# sign_with_timestamp
# ---------------------------------------------------------------------------

class TestSignWithTimestamp:
    def test_returns_valid_signature_and_timestamp(self) -> None:
        kp = generate_keypair()
        before = int(time.time() * 1000)
        sig, ts = sign_with_timestamp("post:content-hash", kp.private_key)
        after = int(time.time() * 1000)

        # Timestamp is within expected range
        assert before <= ts <= after

        # Signature verifies with reconstructed message
        message = f"post:content-hash:{ts}"
        assert verify(message, sig, kp.public_key) is True

    def test_signature_is_128_char_hex(self) -> None:
        kp = generate_keypair()
        sig, _ = sign_with_timestamp("action", kp.private_key)
        assert re.fullmatch(r"[0-9a-f]{128}", sig)
