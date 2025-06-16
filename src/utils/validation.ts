import { z } from 'zod';
import { ValidationError } from './errors';

export function validateParams<T>(
  params: unknown,
  schema: z.ZodSchema<T>
): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      
      throw new ValidationError(
        'Invalid parameters',
        details
      );
    }
    
    throw error;
  }
}