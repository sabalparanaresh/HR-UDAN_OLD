import { PieceRateConfigSchema } from './schema';

/**
 * Generates an Excel template structure dynamically from the form validation and config schema.
 * Prevents empty excel templates by ensuring headers are dynamically derived and a realistic
 * template example is pre-filled.
 */
export function generatePieceRateTemplateFromSchema(): Record<string, any>[] {
  // Extract columns dynamically from the metadata/schema definition
  const headers = PieceRateConfigSchema.map(field => field.label);
  
  // Create a clean, validated sample row/template based on each field's metadata and options
  const sampleRow: Record<string, any> = {};
  
  PieceRateConfigSchema.forEach(field => {
    let defaultValue = '';
    
    if (field.key === 'name') {
      defaultValue = 'Sample Stitching Config';
    } else if (field.key === 'calculation_type') {
      defaultValue = field.options ? field.options[0] : 'FIXED';
    } else if (field.key === 'applicability') {
      defaultValue = field.options ? field.options[0] : 'UNIVERSAL';
    } else if (field.key === 'unit_of_measurement') {
      defaultValue = field.defaultValue || 'Pieces';
    } else if (field.key === 'fixed_rate') {
      defaultValue = 12.50;
    } else if (field.key === 'effective_date') {
      defaultValue = typeof field.defaultValue === 'function' ? field.defaultValue() : field.defaultValue || '2026-05-19';
    } else if (field.key === 'status') {
      defaultValue = 'ACTIVE';
    } else {
      defaultValue = field.defaultValue || '';
    }

    sampleRow[field.label] = defaultValue;
  });

  // Second row with SLAB-wise details as a helper
  const sampleSlabRow: Record<string, any> = {};
  PieceRateConfigSchema.forEach(field => {
    let val = '';
    if (field.key === 'name') {
      val = 'Sample Cutting Config';
    } else if (field.key === 'calculation_type') {
      val = 'SLAB';
    } else if (field.key === 'applicability') {
      val = 'UNIVERSAL';
    } else if (field.key === 'unit_of_measurement') {
      val = 'Pieces';
    } else if (field.key === 'fixed_rate') {
      val = ''; // No base rate for slab configuration initially
    } else if (field.key === 'effective_date') {
      val = typeof field.defaultValue === 'function' ? field.defaultValue() : field.defaultValue || '2026-05-19';
    } else if (field.key === 'status') {
      val = 'ACTIVE';
    }
    sampleSlabRow[field.label] = val;
  });

  return [sampleRow, sampleSlabRow];
}

/**
 * Returns just the list of headers from the schema for direct mapping or verification purposes.
 */
export function getPieceRateTemplateHeaders(): string[] {
  return PieceRateConfigSchema.map(field => field.label);
}
