export interface ParsedPayment {
  provider: 'telebirr' | 'cbe';
  amount: number;
  phone: string;       // sender's phone number
  reference: string;
}

/**
 * Telebirr examples:
 * "You have received ETB 100.00 from 0911234567. Ref: DHD8R7PFDQ."
 * "Dear Customer, you have received ETB 250.50 from +251911234567. Transaction Ref No: ABC123XYZ."
 */
const TELEBIRR_REGEX =
  /received\s+ETB\s+([\d,]+(?:\.\d{1,2})?)\s+from\s+(\+?251\d{9}|0\d{9}).*?(?:Ref(?:\s*No)?[:.]?\s*)([A-Z0-9]+)/i;

/**
 * CBE Birr examples:
 * "ETB 500.00 has been credited to your account from 0922345678. Ref: CBE20240912001."
 * "You have received ETB 75.00 from CBE Birr user 0922345678. Reference: CBEXYZ789."
 */
const CBE_REGEX =
  /(?:received|credited).*?ETB\s+([\d,]+(?:\.\d{1,2})?).*?(?:from\s+(?:CBE Birr user\s+)?)?(\+?251\d{9}|0\d{9}).*?(?:Ref(?:erence)?[:.]?\s*)([A-Z0-9]+)/i;

export function parseSms(body: string): ParsedPayment | null {
  // Try Telebirr first
  let match = body.match(TELEBIRR_REGEX);
  if (match) {
    return {
      provider: 'telebirr',
      amount: parseFloat(match[1].replace(/,/g, '')),
      phone: normalizePhone(match[2]),
      reference: match[3],
    };
  }

  // Try CBE Birr
  match = body.match(CBE_REGEX);
  if (match) {
    return {
      provider: 'cbe',
      amount: parseFloat(match[1].replace(/,/g, '')),
      phone: normalizePhone(match[2]),
      reference: match[3],
    };
  }

  return null;
}

/** Normalize to 09XXXXXXXX format */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('251') && digits.length === 12) {
    return '0' + digits.slice(3);
  }
  return digits.startsWith('0') ? digits : '0' + digits;
}
