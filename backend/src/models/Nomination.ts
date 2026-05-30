import mongoose from 'mongoose';
import crypto from 'crypto';

const nominationSchema = new mongoose.Schema({
  form_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true },
  functionary_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacher_name: { type: String, required: true },
  teacher_email: { type: String, required: true },
  teacher_phone: { type: String },
  school_code: { type: String, required: true },
  link_type: { type: String, enum: ['otp', 'direct'], default: 'otp' },
  status: { type: String, enum: ['pending', 'invited', 'in_progress', 'completed'], default: 'pending' },
  unique_token: { type: String, unique: true },
  invited_at: { type: Date },
  reminder_count: { type: Number, default: 0 },
  last_reminder_at: { type: Date },
  additional_data: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// Generate cryptographically secure unique token before saving
nominationSchema.pre('save', function() {
  if (!this.unique_token) {
    this.unique_token = crypto.randomBytes(24).toString('hex');
  }
});

export const Nomination = mongoose.model('Nomination', nominationSchema);
