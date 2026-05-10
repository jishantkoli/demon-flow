import express from 'express';
import { 
  getLevels, createLevel, 
  getShortlistData, createShortlist, 
  getReviews, updateReview, saveReviewScore 
} from '../controllers/reviews.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Levels
router.get('/review-levels', authenticate, getLevels);
router.post('/review-levels', authenticate, authorize('admin'), createLevel);

// Shortlisting
router.get('/shortlist', authenticate, authorize('admin'), getShortlistData);
router.post('/shortlist', authenticate, authorize('admin'), createShortlist);

// Reviews
router.get('/reviews', authenticate, getReviews);
router.put('/reviews', authenticate, authorize('admin', 'reviewer'), updateReview);
router.post('/review-scores', authenticate, authorize('admin', 'reviewer'), saveReviewScore);

export default router;
