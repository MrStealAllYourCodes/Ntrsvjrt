const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { parse } = require('csv-parse'); // Import the parser

const app = express();
const port = process.env.PORT || 3000;

// --- CORS Configuration ---
// ... (keep your existing CORS config) ...
const allowedOrigins = [
    'https://wacare-backend.web.app', // Your Firebase Hosting frontend
    'http://localhost:5000',          // For local Firebase testing
    'http://127.0.0.1:5000'
];
const corsOptions = { /* ... keep your options ... */ };
app.use(cors(corsOptions));


// --- REMOVE the old parseCsv function ---
// function parseCsv(csvText) { ... } // DELETE THIS


// --- Function to get sheet data (using csv-parse) ---
const PUBLIC_SHEET_CSV_URL = process.env.PUBLIC_SHEET_CSV_URL;
async function getPublicSheetData() {
    console.log("Backend: Entering getPublicSheetData function.");
    if (!PUBLIC_SHEET_CSV_URL) {
        console.error('Backend: PUBLIC_SHEET_CSV_URL environment variable is not set.');
        throw new Error('Server configuration error: Missing sheet URL.');
    }

    console.log(`Backend: Attempting to fetch from URL: ${PUBLIC_SHEET_CSV_URL}`);
    try {
        const response = await axios.get(PUBLIC_SHEET_CSV_URL, { responseType: 'text', timeout: 10000 });
        console.log(`Backend: Axios request successful. Status: ${response.status}.`);
        const csvData = response.data;

        if (!csvData || typeof csvData !== 'string' || csvData.trim() === '') {
            console.warn("Backend: Received EMPTY or non-string data from the Google Sheet URL.");
            return []; // Return an empty array if no data
        }

        console.log("Backend: Received non-empty CSV data. Parsing with csv-parse...");

        // Use csv-parse (promise-based API)
        return new Promise((resolve, reject) => {
            // Configure the parser
            // - columns: true -> Use first row as header, results are objects
            // - skip_empty_lines: true -> Ignore empty rows
            // - trim: true -> Remove whitespace around fields
            // - relax_column_count: true -> Allows rows with different numbers of columns (safer)
            parse(csvData, {
                columns: true, // Use the first row as headers (e.g., 'Name', 'Value')
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true // More robust for slightly malformed sheets
            }, (err, records) => {
                if (err) {
                    console.error('Backend: csv-parse error:', err);
                    reject(new Error('Failed to parse CSV data from Google Sheet.'));
                } else {
                    console.log(`Backend: csv-parse finished. Parsed ${records.length} records.`);
                    // The 'records' variable is now an array of objects, like:
                    // [ { Name: '...', Value: '...' }, { Name: '...', Value: '...' } ]
                    resolve(records);
                }
            });
        });

    } catch (err) {
        // Handle Axios errors etc.
        if (err.response) { console.error(`Backend: Error fetching sheet URL - Status ${err.response.status}`, err.response.data); }
        else if (err.request) { console.error('Backend: Error fetching sheet URL - No response received.', err.request); }
        else { console.error('Backend: Error fetching sheet URL - Request setup error.', err.message); }
        throw new Error('Failed to retrieve data from the Google Sheet URL.');
    }
}

// --- Middleware ---
app.use(express.json());

// --- API Routes ---
app.get('/api/sheet-data', async (req, res) => {
    console.log("Backend: API route /api/sheet-data hit.");
    try {
        const data = await getPublicSheetData(); // This now returns an array of objects

        console.log('Backend: Data received from getPublicSheetData:', JSON.stringify(data.slice(0, 2), null, 2)); // Log first 2 records

        // No need to check structure like before, csv-parse gives array or throws error
        console.log("Backend: Sending parsed records as JSON response.");
        res.json(data); // Send the array of objects directly

    } catch (error) {
        console.error("Backend: Error caught in /api/sheet-data route handler:", error.message);
        res.status(500).json({ error: error.message || 'Failed to fetch sheet data.' });
    }
});

// --- Health Check & Start Server ---
app.get('/health', (req, res) => res.status(200).send('OK'));
app.listen(port, () => {
    console.log(`WaCare Backend server running on port ${port}`);
    // ... other startup logs ...
});
