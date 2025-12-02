// import fetch from 'node-fetch';

async function triggerSignin() {
  const email = 'amanshresthaaaaa@gmail.com';
  console.log(`Triggering signin for ${email}...`);

  try {
    const response = await fetch('http://localhost:3000/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'test-token',
        'Cookie': 'sr-csrf-token=test-token',
      },
      body: JSON.stringify({
        email,
        mode: 'magic_link',
      }),
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

triggerSignin();
