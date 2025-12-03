const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/interests',
    method: 'GET'
};

const req = http.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`);
    let data = '';

    res.on('data', d => {
        data += d;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Success:', json.success);
            console.log('Interests count:', json.interests.professional.length + json.interests.personal.length);
        } catch (e) {
            console.error('Error parsing JSON:', e);
            console.log('Raw data:', data);
        }
    });
});

req.on('error', error => {
    console.error(error);
});

req.end();
