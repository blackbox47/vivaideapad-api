import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/**
 * Public contributor sign-up wire format.
 *
 * The frontend validates `confirmPassword` purely on the client and never
 * sends it on the wire. The backend trusts the password + consent payload
 * and re-validates complexity before hashing.
 */
export const SignUpSchema = z.object({
  full_name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/\d/, 'Password must contain at least one number'),
  consent: z
    .boolean()
    .refine((v) => v === true, 'Consent is required to continue'),
});

export class SignUpDto extends createZodDto(SignUpSchema) {}
export type SignUpInput = z.infer<typeof SignUpSchema>;
