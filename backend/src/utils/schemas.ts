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
    responses: z.union([
      z.array(z.object({
        fieldId: z.string().optional(),
        value: z.any().optional()
      }).passthrough()),
      z.record(z.string(), z.any())
    ]).optional(),
    user_name: z.string().optional(),
    user_email: z.union([z.string().email(), z.string().length(0)]).optional(),
    nomination_id: z.string().optional(),
    form_title: z.string().optional(),
    status: z.string().optional(),
    score: z.any().optional(),
    is_draft: z.boolean().optional(),
    isDraft: z.boolean().optional(),
    userEmail: z.union([z.string().email(), z.string().length(0)]).optional(),
    id: z.string().optional()
  }).refine(data => data.formId || data.form_id || data.id, {
    message: "A form ID or submission ID must be provided"
  })
});

export const formSchema = z.object({
  body: z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    status: z.enum(['active', 'draft', 'expired', 'archived']).optional(),
    fields: z.array(z.object({
      id: z.string(),
      type: z.string(),
      label: z.string(),
      required: z.boolean().optional()
    }).passthrough()).optional(),
    expiresAt: z.union([z.string(), z.date()]).optional(),
    settings: z.record(z.string(), z.any()).optional(),
    review_workflow: z.any().optional()
  })
});
