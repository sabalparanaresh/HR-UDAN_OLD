/**
 * Common formatting utilities 
 */

/**
 * Formats a number as a currency string.
 * @param amount The numeric amount to format.
 * @param currency The currency code (default: 'INR').
 * @param locale The locale string (default: 'en-IN').
 * @returns The formatted currency string.
 */
export const formatCurrency = (amount: number, currency: string = 'INR', locale: string = 'en-IN'): string => {
  if (isNaN(amount)) return '';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * Formats a number to a specific number of decimal places.
 * @param value The value to format.
 * @param decimals Number of decimal places (default: 2).
 * @returns String representation of the number.
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  if (isNaN(value)) return '';
  return Number(value).toFixed(decimals);
};

/**
 * Capitalizes the first letter of each word in a string.
 * @param str The string to capitalize.
 * @returns The capitalized string.
 */
export const titleCase = (str: string): string => {
  if (!str) return '';
  return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};
