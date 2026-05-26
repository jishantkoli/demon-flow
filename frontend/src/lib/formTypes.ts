export type FieldType =
  | 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'date'
  | 'dropdown' | 'radio' | 'checkbox' | 'file' | 'mcq';

export type Field = {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  maxLength?: number;
  fileTypes?: string;
  maxSizeMB?: number;
  // quiz
  correct?: number | number[] | string;
  marks?: number;
  points?: number;
  negative?: number;
  // branching
  visibleIf?: { fieldId: string; op: 'eq' | 'neq' | 'in'; value: string | string[] };
};

export type Section = {
  id: string;
  title: string;
  description?: string;
  fields: Field[];
  visibleIf?: { fieldId: string; op: 'eq' | 'neq' | 'in'; value: string | string[] };
};

export type FormSchema = { sections: Section[] };

export type FormCategory = 'normal' | 'nomination' | 'branching' | 'quiz' | 'multi';

export type Form = {
  id: string;
  title: string;
  description: string;
  form_type: FormCategory;
  slug: string;
  schema: FormSchema;
  settings: Record<string, unknown> & {
    time_limit_min?: number;
    negative_marking?: boolean;
    shuffle?: boolean;
  };
  status: 'active' | 'expired' | 'draft';
  expires_at: string | null;
  created_by: string;
  allowEdit?: boolean;
};
