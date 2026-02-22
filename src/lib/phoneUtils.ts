/**
 * Frontend phone normalization utilities.
 */

export function normalizePhone(phone: string, defaultCountry: string = 'PL'): string {
  if (!phone) return '';

  let cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('00') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned.slice(2);
  }

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.replace(/^\+(49|43|41|39)0(\d)/, '+$1$2');
    return cleaned;
  }

  const digitsOnly = cleaned.replace(/\D/g, '');

  const countryPrefixes = [
    '48', '49', '44', '380', '420', '421', '47', '45', '46',
    '43', '41', '33', '31', '32', '39', '34', '351', '370',
    '371', '372', '375', '7', '1',
  ];

  for (const prefix of countryPrefixes) {
    const minLength = prefix.length >= 3 ? prefix.length + 8 : prefix.length + 9;
    if (digitsOnly.startsWith(prefix) && digitsOnly.length >= minLength) {
      return '+' + digitsOnly;
    }
  }

  if (digitsOnly.length === 9) {
    if (defaultCountry === 'PL') {
      return '+48' + digitsOnly;
    }
    return '+' + digitsOnly;
  }

  if (digitsOnly.length > 9) {
    return '+' + digitsOnly;
  }

  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
}

export function stripPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  const digitsOnly = normalized.replace(/\D/g, '');
  return digitsOnly.length >= 8 && digitsOnly.length <= 15;
}

export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';

  let cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+48')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('48') && cleaned.length >= 11) {
    cleaned = cleaned.slice(2);
  }

  if (cleaned.length === 9 && /^\d+$/.test(cleaned)) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
  }

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (digits.length >= 9) {
      const countryCode = digits.slice(0, 2);
      const rest = digits.slice(2);
      const parts = rest.match(/.{1,3}/g) || [];
      return `+${countryCode} ${parts.join(' ')}`;
    }
    return cleaned;
  }

  if (/^\d+$/.test(cleaned) && cleaned.length >= 9) {
    const parts = cleaned.match(/.{1,3}/g) || [];
    return parts.join(' ');
  }

  return phone;
}
