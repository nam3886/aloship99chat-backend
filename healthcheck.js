const http = require('http');

const options = {
  host: '127.0.0.1',
  port: process.env.PORT || 3000,
  path: '/api/health',
  timeout: 2000,
};

const request = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  if (res.statusCode === 200 || res.statusCode === 403) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', (err) => {
  console.log('Health check failed:', err.message);
  process.exit(1);
});

request.end();