pragma circom 2.1.0;

include "../lib/circomlib/circuits/poseidon.circom";
include "../lib/circomlib/circuits/comparators.circom";

// Proves: "I know a secret `s` and a model identifier `m` such that
//   Poseidon(s, m) == commitment AND m is in the approved set."
// This demonstrates ZKP without heavy EdDSA circuits.

template ModelVerify(N) {
    // Private inputs
    signal input secret;         // agent's secret (derived from Ed25519 privkey)
    signal input modelId;        // numeric model identifier (hashed model_type)

    // Public inputs
    signal input commitment;     // Poseidon(secret, modelId) — published on-chain
    signal input approvedModels[N]; // set of approved model IDs

    // 1. Verify commitment: Poseidon(secret, modelId) == commitment
    component hasher = Poseidon(2);
    hasher.inputs[0] <== secret;
    hasher.inputs[1] <== modelId;
    hasher.out === commitment;

    // 2. Verify model membership: modelId ∈ approvedModels
    component isEq[N];
    signal matches[N];
    signal runningSum[N + 1];
    runningSum[0] <== 0;

    for (var i = 0; i < N; i++) {
        isEq[i] = IsEqual();
        isEq[i].in[0] <== modelId;
        isEq[i].in[1] <== approvedModels[i];
        matches[i] <== isEq[i].out;
        runningSum[i + 1] <== runningSum[i] + matches[i];
    }

    // At least one match required
    signal found;
    component gt = GreaterThan(8);
    gt.in[0] <== runningSum[N];
    gt.in[1] <== 0;
    found <== gt.out;
    found === 1;
}

component main { public [commitment, approvedModels] } = ModelVerify(5);
