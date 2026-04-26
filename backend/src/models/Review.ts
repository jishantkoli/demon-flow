import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  submission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true },
  reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  level: { type: Number, required: true },
  level_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  comments: { type: String },
  overall_score: { type: Number },
  grade: { type: String },
  recommendation: { type: String, enum: ['approve', 'reject', 'next_level'] },
  is_draft: { type: Boolean, default: false },
  question_scores: [{
    field_id: String,
    score: Number
  }],
  reviewed_at: { type: Date }
}, { timestamps: true });

export const Review = mongoose.model('Review', reviewSchema);
