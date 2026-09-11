import { describe, expect, it } from "vitest";
import { toAcceptedTypeExtension } from "./acceptedFileType";

describe("toAcceptedTypeExtension", () => {
    it("strips a leading dot from extension types", () => {
        expect(toAcceptedTypeExtension(".csv")).toBe("csv");
        expect(toAcceptedTypeExtension(".pdf")).toBe("pdf");
    });

    it("returns the MIME subtype, not the full type string", () => {
        expect(toAcceptedTypeExtension("image/jpeg")).toBe("jpeg");
        expect(toAcceptedTypeExtension("application/pdf")).toBe("pdf");
        expect(toAcceptedTypeExtension("text/csv")).toBe("csv");
    });

    it("does not fall back to the full MIME string when the subtype is missing", () => {
        expect(toAcceptedTypeExtension("image/")).toBe("image");
        expect(toAcceptedTypeExtension("application/")).toBe("application");
    });

    it("returns the original value when there is no slash or leading dot", () => {
        expect(toAcceptedTypeExtension("csv")).toBe("csv");
        expect(toAcceptedTypeExtension("pdf")).toBe("pdf");
    });
});
