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

  return Boolean(
    name && name !== 'YOUR_CLOUD_NAME' &&
    key && key !== 'YOUR_API_KEY' &&
    secret && secret !== 'YOUR_API_SECRET'
  );
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

    // Upload buffer to Cloudinary via upload_stream
    const result: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'flow-agent-uploads',
          resource_type: 'auto', // handles PDFs, images, etc.
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      bufferToStream(req.file!.buffer).pipe(stream);
    });

    res.status(200).json({
      message: 'File uploaded successfully',
      filename: result.public_id,
      url: result.secure_url,
    });
  } catch (err: any) {
    console.error('[Upload Error]', err);
    try {
      // Graceful fallback if Cloudinary call fails unexpectedly
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
