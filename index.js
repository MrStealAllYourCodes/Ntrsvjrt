const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { parse } = require('csv-parse'); // Import the parser

const app = express();
const port = process.env.PORT || 3000;

// --- CORS Configuration ---
const allowedOrigins = [
    'https://wacare-backend.web.app', // Your Firebase Hosting frontend
    'http://localhost:5000',          // For local Firebase testing
    'http://127.0.0.1:5000'           // Alternate local
    // Add any other origins if needed
];
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true // If you need cookies or authorization headers
};
app.use(cors(corsOptions));


// *** MODIFIED: Accepts the full sheet URL ***
async function getPublicSheetData(sheetUrl) {
    console.log(`Backend: Entering getPublicSheetData for URL: ${sheetUrl}`);

    // ** REMOVED Switch statement and environment variable mapping **

    if (!sheetUrl) {
        console.error(`Backend: Missing sheetUrl parameter.`);
        throw new Error(`Sheet URL was not provided.`);
    }

    // ** Basic Validation: Ensure it looks like a Google Sheet export URL **
    // Adjust this pattern if your URLs differ (e.g., different export format)
    const googleSheetPattern = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/[a-zA-Z0-9_-]+\/pub\?(?:gid=\d+&single=true&|single=true&gid=\d+&)output=csv$/;
    if (!googleSheetPattern.test(sheetUrl)) {
        console.error(`Backend: Invalid sheet URL format provided (expecting /pub?output=csv): ${sheetUrl}`);
        // Avoid echoing the potentially malicious URL back in the error to the client
        throw new Error(`Invalid or unsupported sheet URL format.`);
    }


    console.log(`Backend: Attempting to fetch from validated URL: ${sheetUrl}`);
    try {
        // ** Use the provided sheetUrl directly **
        const response = await axios.get(sheetUrl, { responseType: 'text', timeout: 15000 });
        console.log(`Backend: Axios request successful for the sheet. Status: ${response.status}.`);
        const csvData = response.data;

        if (!csvData || typeof csvData !== 'string' || csvData.trim() === '') {
            console.warn(`Backend: Received EMPTY data from Google Sheet URL: ${sheetUrl}`);
            return []; // Return empty array for empty sheets
        }

        console.log(`Backend: Parsing CSV for the sheet...`);
        // Use csv-parse (promise-based API)
        return new Promise((resolve, reject) => {
            parse(csvData, {
                columns: true, // Assumes first row is header
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true // Be flexible with column count inconsistencies
            }, (err, records) => {
                if (err) {
                    console.error(`Backend: csv-parse error for sheet URL: ${sheetUrl}`, err);
                    reject(new Error(`Failed to parse CSV data.`)); // Generic parse error
                } else {
                    console.log(`Backend: csv-parse finished. Parsed ${records.length} records.`);
                    resolve(records);
                }
            });
        });

    } catch (err) {
        // Handle Axios errors etc.
        let errorMsg = `Failed to retrieve or process data from the provided sheet URL.`;
        if (err.response) {
             // Got response from server, but status code indicates error (e.g. 404, 403)
             console.error(`Backend: Error fetching sheet URL ${sheetUrl}. Status: ${err.response.status}`, err.message);
             errorMsg = `Error fetching sheet data (Status: ${err.response.status}). Check if the URL is correct and public.`;
        } else if (err.request) {
             // Request made, but no response received (e.g., network error, timeout)
             console.error(`Backend: No response received for sheet URL ${sheetUrl}.`, err.message);
             errorMsg = `Could not reach the sheet URL. Check network or URL validity.`;
        } else {
            // Other errors (setup issues, parsing errors re-thrown)
            console.error(`Backend: Error processing request for sheet URL ${sheetUrl}.`, err.message);
             errorMsg = err.message; // Use the specific error message if it was thrown previously
        }
        throw new Error(errorMsg);
    }
}

// --- Middleware ---
app.use(express.json()); // Keep if you plan POST routes, otherwise optional for GET only

// --- API Routes ---
// *** MODIFIED: Expects 'sheetUrl' query parameter ***
app.get('/api/sheet-data', async (req, res) => {
    // ** Get sheetUrl from query parameter **
    const sheetUrl = req.query.sheetUrl;

    // ** Validate sheetUrl parameter presence **
    if (!sheetUrl || typeof sheetUrl !== 'string' || sheetUrl.trim() === '') {
         console.warn("Backend: API request missing or empty 'sheetUrl' query parameter.");
         return res.status(400).json({ error: "Missing 'sheetUrl' query parameter." });
    }

    // ** Optional: Decode URL component if needed (usually browser/fetch handles this) **
    // const decodedSheetUrl = decodeURIComponent(sheetUrl);
    // console.log(`Backend: API route /api/sheet-data hit for URL: ${decodedSheetUrl}`);

    console.log(`Backend: API route /api/sheet-data hit for URL: ${sheetUrl}`);

    try {
        // ** Pass the sheetUrl directly to the fetcher function **
        const data = await getPublicSheetData(sheetUrl);
        console.log(`Backend: Sending data for the requested sheet. Record count: ${data.length}`);
        res.json(data); // Send the array of objects

    } catch (error) {
        console.error(`Backend: Error caught in API route for sheet URL: ${sheetUrl}:`, error.message);
        // Determine appropriate status code based on error type if possible
        let statusCode = 500;
        if (error.message.includes("Invalid or unsupported sheet URL format") || error.message.includes("Missing sheet URL")) {
            statusCode = 400; // Bad Request
        } else if (error.message.includes("Status: 404") || error.message.includes("Status: 403")) {
             statusCode = 404; // Or 403 depending on context, treat as Not Found/Forbidden from client perspective
        }
        // Send specific error message if available
        res.status(statusCode).json({ error: error.message || `Failed to fetch data for the provided sheet URL.` });
    }
});

// --- Health Check & Start Server ---
app.get('/health', (req, res) => res.status(200).send('OK'));
app.listen(port, () => {
    console.log(`WaCare Backend server running on port ${port}`);
    // Log environment variables status (optional but helpful)
    // console.log(`PUBLIC_SHEET_URL_PAGE1 set: ${!!process.env.PUBLIC_SHEET_URL_PAGE1}`); // No longer needed
});
