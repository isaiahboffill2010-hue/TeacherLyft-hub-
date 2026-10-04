import { describe, expect, it } from "vitest";
import { appendDigit, canSubmitCode, formatPairingCode, removeLastDigit } from "@/shared/keypad";

describe("touchscreen keypad", () => {
  it("accepts digits only and stops at six", () => {
    expect(appendDigit("12", "3")).toBe("123");
    expect(appendDigit("12", "x")).toBe("12");
    expect(appendDigit("123456", "7")).toBe("123456");
  });

  it("cannot submit fewer than six digits", () => {
    expect(canSubmitCode("12345")).toBe(false);
    expect(canSubmitCode("123456")).toBe(true);
    expect(canSubmitCode("12345x")).toBe(false);
  });

  it("backspace removes one digit", () => {
    expect(removeLastDigit("123456")).toBe("12345");
    expect(removeLastDigit("")).toBe("");
  });

  it("formats the code in two groups", () => {
    expect(formatPairingCode("123456")).toBe("123 456");
    expect(formatPairingCode("12")).toBe("12_ ___");
  });
});
