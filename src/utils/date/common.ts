/**
 * Common date utilities 
 */

/**
 * Formats a Date object or ISO string to a standard YYYY-MM-DD format.
 * @param date The date to format.
 * @returns Formatted string (YYYY-MM-DD) or empty string if invalid.
 */
export const formatDateCommon = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Formats a date for display (e.g., "Jan 01, 2026").
 * @param date The date to format.
 * @returns Formatted nice string.
 */
export const formatDateDisplay = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);
};

/**
 * Calculates the number of days between two dates.
 * @param start The start date.
 * @param end The end date.
 * @returns Number of days difference.
 */
export const daysBetween = (start: Date | string, end: Date | string): number => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;
    
    // Reset time portion to accurately count days
    startDate.setHours(0,0,0,0);
    endDate.setHours(0,0,0,0);
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
