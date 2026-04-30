import { Router } from 'express';
import { getComments, createComment } from '../controllers/comments.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getComments);
router.post('/', authenticate, createComment);

export default router;
