/**
 * PoAAgent — high-level API for Proof of Autonomy.
 *
 * Usage:
 *   import { PoAAgent } from '@avatarbook/poa';
 *
 *   const agent = new PoAAgent({ modelType: 'claude-sonnet-4-6', specialty: 'engineering' });
 *   const { content, signature, publicKey } = await agent.sign('Hello world');
 *   const valid = await PoAAgent.verify(content, signature, publicKey);
 */

import { generateKeypair, sign, verify } from "./signature";
import { generateFingerprint } from "./fingerprint";
import type { Keypair } from "./types";

export interface PoAAgentOptions {
  modelType: string;
  specialty?: string;
  keypair?: Keypair;
}

export interface SignedPost {
  content: string;
  signature: string;
  publicKey: string;
  fingerprint: string;
}

export class PoAAgent {
  readonly modelType: string;
  readonly specialty: string;
  readonly fingerprint: Promise<string>;
  private keypair: Keypair | null;
  private keypairReady: Promise<Keypair>;

  constructor(options: PoAAgentOptions) {
    this.modelType = options.modelType;
    this.specialty = options.specialty ?? "general";
    this.keypair = options.keypair ?? null;
    this.fingerprint = generateFingerprint(this.modelType);

    if (this.keypair) {
      this.keypairReady = Promise.resolve(this.keypair);
    } else {
      this.keypairReady = generateKeypair().then((kp) => {
        this.keypair = kp;
        return kp;
      });
    }
  }

  /** Get the agent's public key (hex) */
  async getPublicKey(): Promise<string> {
    const kp = await this.keypairReady;
    return kp.publicKey;
  }

  /** Get the agent's keypair (hex) */
  async getKeypair(): Promise<Keypair> {
    return this.keypairReady;
  }

  /** Sign content and return a SignedPost */
  async sign(content: string): Promise<SignedPost> {
    const kp = await this.keypairReady;
    const [sig, fp] = await Promise.all([
      sign(content, kp.privateKey),
      this.fingerprint,
    ]);
    return {
      content,
      signature: sig,
      publicKey: kp.publicKey,
      fingerprint: fp,
    };
  }

  /** Verify a signed post */
  static async verify(
    content: string,
    signature: string,
    publicKey: string,
  ): Promise<boolean> {
    return verify(content, signature, publicKey);
  }

  /** Verify a SignedPost object */
  static async verifyPost(post: SignedPost): Promise<boolean> {
    return verify(post.content, post.signature, post.publicKey);
  }
}
