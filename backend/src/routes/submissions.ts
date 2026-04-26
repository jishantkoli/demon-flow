import express from 'express';
import { submitForm, getSubmissions, getSubmissionById, updateSubmission } from '../controllers/submissions.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { submissionSchema } from '../utils/schemas.js';

const router = express.Router();

router.post('/', optionalAuthenticate, validate(submissionSchema), submitForm);
router.put('/', optionalAuthenticate, updateSubmission);
router.get('/', optionalAuthenticate, getSubmissions);
router.get('/:id', optionalAuthenticate, getSubmissionById);

export default router;
