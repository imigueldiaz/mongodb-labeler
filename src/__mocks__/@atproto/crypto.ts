export class Secp256k1Keypair {
    static async import(key: string): Promise<Secp256k1Keypair> {
        return new Secp256k1Keypair();
    }

    async sign(data: Buffer): Promise<Uint8Array> {
        return new Uint8Array(32);
    }
}
