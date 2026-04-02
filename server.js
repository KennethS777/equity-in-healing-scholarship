
const http = require('http');
const fs = require('fs');
const path = require('path');

// `__dirname` is the folder where this file lives.
const projectRoot = __dirname;
// Read values from `.env` so secrets stay out of frontend code.
const env = loadEnvFile(path.join(projectRoot, '.env'));

// Use the hosting port if provided, otherwise run locally on 3000.
const PORT = process.env.PORT || 3000;
// Prefer real environment variables, then fall back to the local `.env` file.
const STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY || '';
// This is the base address we use when building success/cancel URLs.
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// These tell the browser what type of file it is receiving.
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jfif': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

// This function runs every time the browser makes a request to the server.
const server = http.createServer(async (request, response) => {
  try {
    // Turn the incoming URL into an object we can inspect easily.
    const requestUrl = new URL(request.url, BASE_URL);

    // When the browser asks for `/`, send back the homepage.
    if (request.method === 'GET' && requestUrl.pathname === '/') {
      return serveFile(response, path.join(projectRoot, 'index.html'));
    }

    // For other GET requests, try to serve CSS, JS, images, and other files.
    if (request.method === 'GET') {
      // Browsers encode spaces and special characters in URLs, so decode them first.
      const decodedPathname = decodeURIComponent(requestUrl.pathname);
      const publicPath = path.normalize(
        path.join(projectRoot, decodedPathname),
      );

      // Block requests that try to escape the project folder.
      if (!publicPath.startsWith(projectRoot)) {
        return sendJson(response, 403, { error: 'Forbidden path.' });
      }

      // If the file exists, send it back to the browser.
      if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
        return serveFile(response, publicPath);
      }
    }

    // This API route receives the donation amount from the frontend.
    if (
      request.method === 'POST' &&
      requestUrl.pathname === '/api/create-checkout-session'
    ) {
      // Payments cannot work unless the Stripe secret key is available.
      if (!STRIPE_SECRET_KEY) {
        return sendJson(response, 500, {
          error: 'Missing STRIPE_SECRET_KEY in .env.',
        });
      }

      // Read the JSON body sent by `fetch(...)` in the browser.
      const body = await readJsonBody(request);
      const amount = Number(body.amount);

      // Stripe expects an integer amount in cents, with a minimum of $1 here.
      if (!Number.isInteger(amount) || amount < 100) {
        return sendJson(response, 400, {
          error: 'Amount must be at least 100 cents ($1.00).',
        });
      }

      // Ask Stripe to create a hosted checkout page, then send its URL back.
      const checkoutUrl = await createStripeCheckoutSession(amount);
      return sendJson(response, 200, { url: checkoutUrl });
    }

    // If no route matched, return a basic "not found" response.
    sendJson(response, 404, { error: 'Route not found.' });
  } catch (error) {
    // Catch unexpected crashes so the server can respond gracefully.
    console.error('Server error:', error);
    sendJson(response, 500, { error: 'Something went wrong on the server.' });
  }
});

// Start listening for requests from the browser.
server.listen(PORT, () => {
  console.log(`Server running at ${BASE_URL}`);
});

function loadEnvFile(filePath) {
  // If the file is missing, return an empty object instead of crashing.
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const fileContents = fs.readFileSync(filePath, 'utf8');
  const lines = fileContents.split(/\r?\n/);
  const values = {};

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Ignore blank lines and comment lines in `.env`.
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    // `.env` lines are expected to look like KEY=VALUE.
    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

function sendJson(response, statusCode, data) {
  // Convert a JavaScript object into JSON text for the browser.
  const payload = JSON.stringify(data);

  response.writeHead(statusCode, {
    'Content-Length': Buffer.byteLength(payload),
    'Content-Type': 'application/json; charset=utf-8',
  });

  response.end(payload);
}

function serveFile(response, filePath) {
  // Look up the file extension so we can send the right content type.
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';
  const fileContents = fs.readFileSync(filePath);

  response.writeHead(200, { 'Content-Type': contentType });
  response.end(fileContents);
}

function readJsonBody(request) {
  // HTTP request data can arrive in chunks, so we collect it first.
  return new Promise((resolve, reject) => {
    let rawBody = '';

    request.on('data', chunk => {
      rawBody += chunk;
    });

    request.on('end', () => {
      try {
        // Parse the finished request body into a normal JavaScript object.
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch (error) {
        reject(new Error('Request body must be valid JSON.'));
      }
    });

    request.on('error', reject);
  });
}

async function createStripeCheckoutSession(amount) {
  // Stripe's API expects form-encoded fields for this endpoint.
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', `${BASE_URL}/?donation=success`);
  form.set('cancel_url', `${BASE_URL}/?donation=cancelled`);
  form.set('line_items[0][price_data][currency]', 'usd');
  form.set('line_items[0][price_data][product_data][name]', 'Scholarship Fund Donation');
  form.set(
    'line_items[0][price_data][product_data][description]',
    'Donation to the Equity in Healing Scholarship Fund',
  );
  form.set('line_items[0][price_data][unit_amount]', String(amount));
  form.set('line_items[0][quantity]', '1');

  // Send the payment details to Stripe using your secret key.
  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  const stripeData = await stripeResponse.json();

  // If Stripe rejects the request, show a readable error.
  if (!stripeResponse.ok) {
    const message = stripeData?.error?.message || 'Stripe request failed.';
    throw new Error(message);
  }

  // Stripe sends back a hosted checkout URL that the frontend can redirect to.
  return stripeData.url;
}
