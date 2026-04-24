import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { optionalAuthenticate } from '../middleware/auth.js';
 
 const __filename = fileURLToPath(import.meta.url);
 const __dirname = path.dirname(__filename);
 
 const router = express.Router();
 
 // Configure storage
 const storage = multer.diskStorage({
   destination: (req, file, cb) => {
     cb(null, path.join(__dirname, '../../uploads'));
   },
   filename: (req, file, cb) => {
     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
     cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
   }
 });
 
 const upload = multer({ 
   storage: storage,
   limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
 });
 
 router.post('/', optionalAuthenticate, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.status(200).json({ 
    message: 'File uploaded successfully',
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`
  });
});

export default router;
