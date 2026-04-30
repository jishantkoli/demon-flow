import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1) // Allowing min 1 for test passwords like 'admin123'
  })
});

export const otpRequestSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional()
  }).refine(data => data.email || data.phone, {
    message: "Either email or phone must be provided"
  })
});

export const submissionSchema = z.object({
  body: z.object({
    formId: z.string().optional(),
    form_id: z.string().optional(),
    responses: z.any(), // Accept both array and object formats (controller normalizes)
    user_name: z.string().optional(),
    user_email: z.string().optional(),
    nomination_id: z.string().optional(),
    form_title: z.string().optional(),
    status: z.string().optional(),
    score: z.any().optional(),
    is_draft: z.boolean().optional()
  }).refine(data => data.formId || data.form_id, {
    message: "Either formId or form_id must be provided"
  })
});
