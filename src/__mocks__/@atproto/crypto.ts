export class MockSecp256k1Keypair {
  static async import() {
    return new MockSecp256k1Keypair();
  }

  async sign() {
    return new Uint8Array(32).fill(0);
  }
}
