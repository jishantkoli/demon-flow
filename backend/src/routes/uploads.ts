import express from 'express';
import multer from 'multer';
import { optionalAuthenticate } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import { Readable } from 'stream';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Use memory storage — file is buffered in RAM then streamed to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    
    if (allowedExtensions.includes(ext) || allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, JPEG, and PNG files are allowed!'));
    }
  }
});

function bufferToStream(buffer: Buffer): Readable {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

function hasCloudinaryConfig(): boolean {
  const name = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;

  const valid = Boolean(
    name && name !== 'YOUR_CLOUD_NAME' &&
    key && key !== 'YOUR_API_KEY' &&
    secret && secret !== 'YOUR_API_SECRET'
  );

  console.log(`[Upload] Cloudinary config check: cloud_name=${name ? name.substring(0, 4) + '...' : 'MISSING'}, api_key=${key ? key.substring(0, 6) + '...' : 'MISSING'}, secret=${secret ? 'SET' : 'MISSING'} => valid=${valid}`);
  return valid;
}

async function saveLocally(req: express.Request, file: Express.Multer.File) {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const ext = path.extname(file.originalname || '') || '';
    const safeBase = path
      .basename(file.originalname || 'file', ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .slice(0, 60) || 'file';
    const filename = `${Date.now()}-${safeBase}${ext}`;
    const absPath = path.join(uploadsDir, filename);
    await fs.writeFile(absPath, file.buffer);

    const host = req.get('host');
    const protocol = req.protocol || 'http';
    return {
      filename,
      url: `${protocol}://${host}/uploads/${encodeURIComponent(filename)}`,
    };
  } catch (err: any) {
    console.error('[Local Save Error]', err);
    throw new Error(`Failed to save file locally: ${err.message}`);
  }
}

router.post('/', optionalAuthenticate, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ error: `Unknown upload error: ${err.message}` });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  console.log(`[Upload] Received file: ${req.file.originalname} (${req.file.size} bytes, type: ${req.file.mimetype})`);

  try {
    if (!hasCloudinaryConfig()) {
      console.log('[Upload] Cloudinary not configured or using placeholders, falling back to local storage');
      const local = await saveLocally(req, req.file);
      return res.status(200).json({
        message: 'File uploaded successfully (local storage)',
        filename: local.filename,
        url: local.url,
      });
    }

    console.log('[Upload] Attempting Cloudinary upload...');

    // Upload buffer to Cloudinary via upload_stream
    const result: any = await new Promise((resolve, reject) => {
      const isPdf = req.file!.mimetype === 'application/pdf' || req.file!.originalname.toLowerCase().endsWith('.pdf');
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'flow-agent-uploads',
          resource_type: isPdf ? 'raw' : 'auto', // handles PDFs, images, etc.
          use_filename: true,
          unique_filename: true,
          flags: 'attachment:false', // ensure it doesn't force download
        },
        (error, result) => {
          if (error) {
            console.error('[Upload] Cloudinary upload_stream error:', error);
            reject(error);
          }
          else resolve(result);
        }
      );
      bufferToStream(req.file!.buffer).pipe(stream);
    });

    console.log(`[Upload] Cloudinary SUCCESS: ${result.secure_url} (public_id: ${result.public_id})`);

    res.status(200).json({
      message: 'File uploaded successfully',
      filename: result.public_id,
      url: result.secure_url,
    });
  } catch (err: any) {
    console.error('[Upload] Cloudinary upload FAILED:', err?.message || err);
    console.error('[Upload] Full error:', JSON.stringify(err, null, 2));
    try {
      // Graceful fallback if Cloudinary call fails unexpectedly
      console.log('[Upload] Falling back to local storage...');
      const local = await saveLocally(req, req.file);
      return res.status(200).json({
        message: 'File uploaded successfully (local fallback)',
        filename: local.filename,
        url: local.url,
      });
    } catch (fallbackErr: any) {
      console.error('[Upload Fallback Error]', fallbackErr);
      res.status(500).json({ error: `File upload failed: ${err.message}. Local storage also failed: ${fallbackErr.message}` });
    }
  }
});

export default router;
