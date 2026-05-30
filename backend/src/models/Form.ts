import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['text', 'textarea', 'number', 'email', 'phone', 'date', 'dropdown', 'radio', 'checkbox', 'file', 'mcq'], 
    required: true 
  },
  required: { type: Boolean, default: false },
  placeholder: String,
  options: [String],
  option_images: [String], // Parallel array for option images
  maxLength: Number,
  fileTypes: String,
  maxSizeMB: Number,
  image: String, // Question image
  // quiz
  correct: mongoose.Schema.Types.Mixed,
  marks: Number,
  negative: Number,
  reviewer_max_marks: { type: Number, default: 0 },
  // branching
  visibleIf: {
    fieldId: String,
    op: { type: String, enum: ['eq', 'neq', 'in'] },
    value: mongoose.Schema.Types.Mixed
  }
});

const sectionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  image: String, // Section image
  fields: [fieldSchema],
  visibleIf: {
    fieldId: String,
    op: { type: String, enum: ['eq', 'neq', 'in'] },
    value: mongoose.Schema.Types.Mixed
  }
});

const formSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  formType: { type: String, enum: ['normal', 'nomination', 'branching', 'quiz', 'multi'], default: 'normal' },
  status: { type: String, enum: ['active', 'expired', 'draft'], default: 'draft' },
  form_schema: {
    sections: [sectionSchema]
  },
  expiresAt: Date,
  allowEdit: { type: Boolean, default: false },
  shareableLink: { type: String, unique: true },
  settings: {
    theme: { type: String, default: 'default' },
    header_image: String,
    logo_image: String,
    bg_image: String,
    bg_color: { type: String, default: '#f6f9ff' },
    header_color: { type: String, default: '#004b93' },
    layout_style: { type: String, default: 'centered' },
    thank_you_heading: { type: String, default: 'Thank You!' },
    thank_you_message: String,
    thank_you_image: String,
    redirect_url: String,
    show_score_after_submit: { type: Boolean, default: true },
    time_limit_min: Number,
    shuffle: Boolean,
    teacher_login: String,
    login_type: String,
    auth_mode: String,
    functionary_only: { type: Boolean, default: false },
    nomination_limit: Number,
    require_email: { type: Boolean, default: true },
    require_phone: { type: Boolean, default: false },
    nomination_custom_fields: [mongoose.Schema.Types.Mixed],
    show_advanced_design: Boolean
  }
}, { timestamps: true });

export const Form = mongoose.model('Form', formSchema);
