import { formatLabel, labelIsSigned, signLabel } from "../../util/labels.js";
import { UnsignedLabel } from "../../util/types.js";

describe("Label Utils", () => {
  describe("formatLabel", () => {
    it("should format label with Uint8Array signature", () => {
      const label: UnsignedLabel & { sig: Uint8Array } = {
        val: "test-label",
        uri: "at://test.com",
        cid: "bafyreidfayvfuwqa7qlnopkwu64bkizzbj3pdw5kaewd7a6d66t7iulpce",
        neg: false,
        src: "did:web:test.com",
        cts: new Date().toISOString(),
        sig: new Uint8Array([1, 2, 3, 4]),
      };

      const formatted = formatLabel(label);
      expect(formatted.sig?.$bytes).toBeDefined();
      expect(formatted.ver).toBe(1);
      expect(formatted.neg).toBe(false);
    });

    it("should format label with base64 signature", () => {
      const label: UnsignedLabel & { sig: { $bytes: string } } = {
        val: "test-label",
        uri: "at://test.com",
        cid: "bafyreidfayvfuwqa7qlnopkwu64bkizzbj3pdw5kaewd7a6d66t7iulpce",
        neg: false,
        src: "did:web:test.com",
        cts: new Date().toISOString(),
        sig: { $bytes: "AQIDBA==" },
      };

      const formatted = formatLabel(label);
      expect(formatted.sig?.$bytes).toBe("AQIDBA==");
      expect(formatted.ver).toBe(1);
      expect(formatted.neg).toBe(false);
    });

    it("should throw error for invalid signature", () => {
      const baseLabel: UnsignedLabel = {
        val: "test-label",
        uri: "at://test.com",
        cid: "bafyreidfayvfuwqa7qlnopkwu64bkizzbj3pdw5kaewd7a6d66t7iulpce",
        neg: false,
        src: "did:web:test.com",
        cts: new Date().toISOString(),
      };

      // Forzar un objeto con una firma inválida para probar el manejo de errores
      const invalidLabel = {
        ...baseLabel,
        sig: { invalid: "signature" },
      } as unknown as UnsignedLabel & { sig: Uint8Array | { $bytes: string } };

      expect(() => formatLabel(invalidLabel)).toThrow("Expected sig to be an object with base64 $bytes");
    });
  });

  describe("labelIsSigned", () => {
    it("should return true for signed label", () => {
      const label: UnsignedLabel & { sig: Uint8Array } = {
        val: "test-label",
        uri: "at://test.com",
        cid: "bafyreidfayvfuwqa7qlnopkwu64bkizzbj3pdw5kaewd7a6d66t7iulpce",
        neg: false,
        src: "did:web:test.com",
        cts: new Date().toISOString(),
        sig: new Uint8Array([1, 2, 3, 4]),
      };

      expect(labelIsSigned(label)).toBe(true);
    });

    it("should return false for unsigned label", () => {
      const label: UnsignedLabel = {
        val: "test-label",
        uri: "at://test.com",
        cid: "bafyreidfayvfuwqa7qlnopkwu64bkizzbj3pdw5kaewd7a6d66t7iulpce",
        neg: false,
        src: "did:web:test.com",
        cts: new Date().toISOString(),
      };

      expect(labelIsSigned(label)).toBe(false);
    });
  });

  describe("signLabel", () => {
    it("should sign label with provided key", async () => {
      const label: UnsignedLabel = {
        val: "test-label",
        uri: "at://test.com",
        cid: "bafyreidfayvfuwqa7qlnopkwu64bkizzbj3pdw5kaewd7a6d66t7iulpce",
        neg: false,
        src: "did:web:test.com",
        cts: new Date().toISOString(),
      };

      // Usar una clave privada de prueba
      const privateKey = new Uint8Array([
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
      ]);
      const signedLabel = await signLabel(label, privateKey);

      expect(signedLabel.sig).toBeDefined();
      expect(signedLabel.neg).toBe(false);
      expect(signedLabel.val).toBe(label.val);
    });
  });
});
