declare module "circomlibjs" {
  interface PoseidonFunction {
    (inputs: bigint[]): Uint8Array;
    F: { toObject(h: Uint8Array): bigint };
  }
  export function buildPoseidon(): Promise<PoseidonFunction>;
}
