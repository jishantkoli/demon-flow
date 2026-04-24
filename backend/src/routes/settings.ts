import express from 'express';
import { authenticate } from '../middleware/auth';
import { getSetting, updateSetting } from '../controllers/settings';

const router = express.Router();

router.get('/:key', authenticate, getSetting);
router.post('/:key', authenticate, updateSetting);

export default router;
