/**
 * Centralized utility to parse Excel time values (numeric serials or text strings)
 * and return them strictly in "HH:mm" format.
 * 
 * Technical Requirements:
 * - Detect Excel numeric time serials properly.
 * - Support both Excel Time Cells and Text Time Values (07:00, 19:30).
 * - Store values consistently in "HH:mm" format.
 * - Prevent locale/timezone conversion.
 */
export function parseExcelTime(val: any): string | null {
  if (val === undefined || val === null) return null;

  let hours = 0;
  let minutes = 0;

  // 1. Handle numeric types (Excel represents time as a fraction of a 24-hour day, e.g., 0.5 = 12:00 PM)
  if (typeof val === 'number') {
    if (isNaN(val)) return null;

    // Extract the fractional part of the number, avoiding negative/overflow issues
    const frac = val - Math.floor(val);
    
    // For values between 0 and 1, they are purely time serials
    if (val >= 0 && val < 1) {
      const totalSeconds = Math.round(val * 86400);
      hours = Math.floor(totalSeconds / 3600) % 24;
      minutes = Math.floor((totalSeconds % 3600) / 60);
    } 
    // If it's a date serial with time fraction (e.g., 44230.291666 => 07:00)
    else if (frac > 0.00001) {
      const totalSeconds = Math.round(frac * 86400);
      hours = Math.floor(totalSeconds / 3600) % 24;
      minutes = Math.floor((totalSeconds % 3600) / 60);
    } 
    // Fallback if the user wrote normal hours as pure integers or floats (e.g., 7 or 19.5 or 0)
    else if (val >= 0 && val < 24) {
      hours = Math.floor(val);
      minutes = Math.round((val % 1) * 60) % 60;
    } 
    // Fallback for codes like "0700" or "1930" parsed as larger numbers
    else {
      const s = String(val);
      if (s.length === 3 || s.length === 4) {
        const h = parseInt(s.slice(0, s.length - 2), 10);
        const m = parseInt(s.slice(s.length - 2), 10);
        if (h >= 0 && h < 24 && m >= 0 && m < 60) {
          hours = h;
          minutes = m;
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
  } 
  // 2. Handle string types
  else {
    const s = String(val).trim();
    if (!s) return null;

    // Check if it is a formatted time range/time string with separator
    if (s.includes(':')) {
      const isPM = s.toLowerCase().includes('pm');
      const isAM = s.toLowerCase().includes('am');
      
      // Keep only digits and colons
      const cleanStr = s.replace(/[^0-9:]/g, '');
      const parts = cleanStr.split(':');
      let h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      
      hours = h % 24;
      minutes = m % 60;
    } 
    // Check if it represents numeric cell contents as string (e.g. "0.29166" or "19.5" or "0700")
    else if (/^\d+(\.\d+)?$/.test(s)) {
      const num = parseFloat(s);
      if (num >= 0 && num < 1) {
        // String decimal fraction of day
        const totalSeconds = Math.round(num * 86400);
        hours = Math.floor(totalSeconds / 3600) % 24;
        minutes = Math.floor((totalSeconds % 3600) / 60);
      } else if (num >= 0 && num < 24) {
        // Decimal hours (e.g. "19.5" => 19:30)
        hours = Math.floor(num);
        minutes = Math.round((num % 1) * 60) % 60;
      } else if (s.length === 3 || s.length === 4) {
        // Format of "700" or "1930"
        const h = parseInt(s.slice(0, s.length - 2), 10);
        const m = parseInt(s.slice(s.length - 2), 10);
        if (h >= 0 && h < 24 && m >= 0 && m < 60) {
          hours = h;
          minutes = m;
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  // Strictly return in "HH:mm" format (unaffected by environment locale)
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}
