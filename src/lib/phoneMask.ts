/**
 * Formats a phone number with Brazilian mask: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
 */
export const formatPhoneMask = (value: string): string => {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");
  
  // Limit to 11 digits (Brazilian mobile phone)
  const limited = digits.slice(0, 11);
  
  // Apply mask based on length
  if (limited.length === 0) return "";
  if (limited.length <= 2) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  if (limited.length <= 10) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  }
  // 11 digits (mobile with 9)
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
};

/**
 * Removes phone mask and returns only digits
 */
export const unformatPhone = (value: string): string => {
  return value.replace(/\D/g, "");
};

/**
 * Normalizes phone number to digits only (alias for database storage/comparison)
 */
export const normalizePhone = (value: string): string => {
  return value.replace(/\D/g, "");
};
