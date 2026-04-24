import express from 'express';
import multer from 'multer';
import { optionalAuthenticate } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import { Readable } from 'stream';

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

router.post('/', optionalAuthenticate, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
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
    res.status(500).json({ error: err.message || 'Upload to Cloudinary failed' });
  }
});

export default router;
