
async function checkAvailability() {
    const baseUrl = 'http://localhost:3000';
    const params = new URLSearchParams({
        date: '2025-11-22', // Saturday
        partySize: '2',
        // time is missing
    });

    const url = `${baseUrl}/api/availability?${params.toString()}`;
    console.log(`Checking availability at: ${url}`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (response.status === 400 && data.error === 'Time parameter required') {
            console.log('SUCCESS: Reproduced expected 400 error when time is missing.');
        } else if (response.status === 200) {
            console.log('FAILURE: Endpoint unexpectedly returned 200 OK.');
        } else {
            console.log('FAILURE: Unexpected response status or body.');
        }
    } catch (error) {
        console.error('Error fetching availability:', error);
    }
}

checkAvailability();
