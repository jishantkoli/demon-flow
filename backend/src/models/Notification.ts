import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'submission' },
  entityType: { type: String, default: 'submission' },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  isRead: { type: Boolean, default: false, index: true }
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
