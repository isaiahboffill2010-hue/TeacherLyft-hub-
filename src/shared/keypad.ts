export function appendDigit(code: string, digit: string): string {
  if (!/^\d$/.test(digit) || code.length >= 6 || !/^\d*$/.test(code)) return code;
  return `${code}${digit}`;
}

export function removeLastDigit(code: string): string {
  return /^\d*$/.test(code) ? code.slice(0, -1) : "";
}

export function canSubmitCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function formatPairingCode(code: string): string {
  const padded = code.padEnd(6, "_");
  return `${padded.slice(0, 3)} ${padded.slice(3)}`;
}
