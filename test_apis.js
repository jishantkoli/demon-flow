
async function testAPIs() {
  const baseUrl = 'http://127.0.0.1:5001/api/v1';
  let adminToken = '';

  console.log('--- Testing Auth API ---');
  try {
    const loginRes = await fetch(`${baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login-password',
        email: 'admin@school.edu',
        password: 'admin123'
      })
    });
    const loginData = await loginRes.json();
    if (loginRes.ok) {
      console.log('✅ Login successful');
      adminToken = loginData.accessToken;
      // Note: In this app, it seems they use cookies for the token, but let's see.
      // Looking at the code, it might be in the body too.
    } else {
      console.log('❌ Login failed:', loginData.error);
      return;
    }
  } catch (err) {
    console.log('❌ Login error:', err.message);
    return;
  }

  const headers = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  console.log('\n--- Testing Forms API ---');
  let firstFormId = '';
  try {
    const formsRes = await fetch(`${baseUrl}/forms`, { headers });
    const formsData = await formsRes.json();
    if (formsRes.ok) {
      console.log(`✅ Fetched ${formsData.length} forms`);
      if (formsData.length > 0) {
        firstFormId = formsData[0]._id;
      }
    } else {
      console.log('❌ Fetch forms failed:', formsData.error);
    }
  } catch (err) {
    console.log('❌ Fetch forms error:', err.message);
  }

  if (firstFormId) {
    console.log('\n--- Testing Submission Creation ---');
    try {
      const subRes = await fetch(`${baseUrl}/submissions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          formId: firstFormId,
          responses: {
            'field_1': 'Test User',
            'field_2': 'test@example.com'
          }
        })
      });
      const subData = await subRes.json();
      if (subRes.ok) {
        console.log('✅ Submission created successfully');
      } else {
        console.log('❌ Submission creation failed:', subData.error);
      }
    } catch (err) {
      console.log('❌ Submission creation error:', err.message);
    }
  }

  console.log('\n--- Testing Submissions API ---');
  try {
    const submissionsRes = await fetch(`${baseUrl}/submissions`, { headers });
    const submissionsData = await submissionsRes.json();
    if (submissionsRes.ok) {
      console.log(`✅ Fetched ${submissionsData.length} submissions`);
    } else {
      console.log('❌ Fetch submissions failed:', submissionsData.error);
    }
  } catch (err) {
    console.log('❌ Fetch submissions error:', err.message);
  }

  console.log('\n--- Testing Stats API ---');
  try {
    const statsRes = await fetch(`${baseUrl}/stats`, { headers });
    const statsData = await statsRes.json();
    if (statsRes.ok) {
      console.log('✅ Fetched stats successfully');
    } else {
      console.log('❌ Fetch stats failed:', statsData.error);
    }
  } catch (err) {
    console.log('❌ Fetch stats error:', err.message);
  }
}

testAPIs();
