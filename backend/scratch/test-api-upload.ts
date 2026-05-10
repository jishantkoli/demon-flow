import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

async function testUpload() {
  try {
    const formData = new FormData();
    const filePath = path.join(process.cwd(), 'testfile.txt');
    fs.writeFileSync(filePath, 'test content');
    
    formData.append('file', fs.createReadStream(filePath));
    
    console.log('Sending upload request...');
    const res = await axios.post('http://localhost:5001/api/v1/uploads', formData, {
      headers: formData.getHeaders()
    });
    
    console.log('Upload Response:', JSON.stringify(res.data, null, 2));
    if (res.data.url) {
      console.log('SUCCESS: File uploaded and URL returned.');
    } else {
      console.log('FAILURE: No URL returned.');
    }
  } catch (err: any) {
    if (err.response) {
      console.error('Upload Failed with status:', err.response.status);
      console.error('Response data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Upload Failed:', err.message);
    }
  }
}
testUpload();
