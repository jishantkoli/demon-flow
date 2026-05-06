import { Request, Response } from 'express';
import { Comment } from '../models/Comment.js';
import { AuthRequest } from '../middleware/auth.js';

export const getComments = async (req: AuthRequest, res: Response) => {
  try {
    const { submission_id } = req.query;
    if (!submission_id) {
      return res.status(400).json({ error: 'submission_id is required' });
    }
    const comments = await Comment.find({ submission_id: String(submission_id) }).sort({ createdAt: 1 });
    res.status(200).json(comments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createComment = async (req: AuthRequest, res: Response) => {
  try {
    const { submission_id, content } = req.body;
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const comment = new Comment({
      submission_id,
      user_id: req.user._id,
      user_name: req.user.name,
      user_role: req.user.role,
      content,
      created_at: new Date()
    });

    await comment.save();
    res.status(201).json(comment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
