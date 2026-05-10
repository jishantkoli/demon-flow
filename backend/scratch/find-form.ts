import axios from 'axios';

async function findForm() {
  try {
    const res = await axios.get('http://localhost:5001/api/v1/forms');
    const forms = res.data;
    const uploadForm = forms.find((f: any) => {
      const schema = typeof f.schema === 'string' ? JSON.parse(f.schema) : f.schema;
      const sections = schema?.sections || [];
      return sections.some((s: any) => s.fields.some((field: any) => field.type === 'file'));
    });
    if (uploadForm) {
      console.log('Found form with upload field:', uploadForm.id || uploadForm._id);
    } else {
      console.log('No form with upload field found. First form ID:', forms[0]?.id || forms[0]?._id);
    }
  } catch (err) {
    console.error('Error finding form:', err);
  }
}
findForm();
