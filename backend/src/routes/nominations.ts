import express from 'express';
import { getNominations, createNomination, updateNomination, deleteNomination, getNominationByToken } from '../controllers/nominations.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/token/:token', getNominationByToken);

router.use(authenticate);

router.get('/', getNominations);
router.post('/', authorize('admin', 'functionary'), createNomination);
router.put('/', authorize('admin', 'functionary'), updateNomination);
router.delete('/', authorize('admin', 'functionary'), deleteNomination);

export default router;
