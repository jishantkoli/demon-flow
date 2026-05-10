import fs from 'fs';
import path from 'path';

const uploadsDir = path.join(process.cwd(), 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const testFile = path.join(uploadsDir, 'test-write.txt');
  fs.writeFileSync(testFile, 'test');
  console.log('Successfully wrote to uploads directory');
  fs.unlinkSync(testFile);
} catch (err) {
  console.error('Failed to write to uploads directory:', err);
}
