import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  submission_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  user_name: { type: String, required: true },
  user_role: { type: String, required: true },
  content: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
}, { timestamps: true });

export const Comment = mongoose.model('Comment', commentSchema);
