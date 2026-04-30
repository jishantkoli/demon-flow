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
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

async function saveLocally(req: express.Request, file: Express.Multer.File) {
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
}

router.post('/', optionalAuthenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    if (!hasCloudinaryConfig()) {
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
      res.status(500).json({ error: err.message || fallbackErr?.message || 'File upload failed' });
    }
  }
});

export default router;
