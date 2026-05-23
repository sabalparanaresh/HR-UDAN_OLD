import { z } from 'zod';

export class ValidationError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

export class UnifiedValidator {
  static validate<T>(schema: z.ZodSchema<T>, data: any): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new ValidationError('Validation error');
    }
  }

  static validatePartial<T>(schema: z.AnyZodObject, data: any): Partial<T> {
    try {
      return schema.partial().parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
         throw new ValidationError(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new ValidationError('Validation error');
    }
  }

  static validateBulk<T>(schema: z.ZodSchema<T>, dataArray: any[]): { valid: T[], errors: { rowIndex: number, errors: string[] }[] } {
    const valid: T[] = [];
    const errors: { rowIndex: number, errors: string[] }[] = [];

    dataArray.forEach((row, index) => {
      try {
        valid.push(schema.parse(row));
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push({ rowIndex: index, errors: error.errors.map(e => e.message) });
        } else {
          errors.push({ rowIndex: index, errors: ['Unknown validation error'] });
        }
      }
    });

    return { valid, errors };
  }
}
