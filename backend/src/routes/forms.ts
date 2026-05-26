import express from 'express';
import { getForms, getFormByLink, createForm, updateForm, deleteForm, exportZip } from '../controllers/forms.js';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/', optionalAuthenticate, getForms);
router.get('/public/:link', getFormByLink);
router.post('/', authenticate, authorize('admin', 'form_creator'), createForm);
router.put('/', authenticate, authorize('admin', 'form_creator'), updateForm);   // Frontend sends id in body
router.patch('/:id', authenticate, authorize('admin', 'form_creator'), updateForm);
router.delete('/:id', authenticate, authorize('admin', 'form_creator'), deleteForm);
router.delete('/', authenticate, authorize('admin', 'form_creator'), deleteForm); // Keep legacy support for body-based delete
router.get('/:id/export/zip', authenticate, authorize('admin', 'form_creator'), exportZip);

export default router;
