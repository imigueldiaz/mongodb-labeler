export class MockSecp256k1Keypair {
  static async import() {
    return await new MockSecp256k1Keypair();
  }

  async sign() {
    return await new Uint8Array(32).fill(0);
  }
}
