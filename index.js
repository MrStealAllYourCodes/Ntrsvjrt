const express = require('express');
const axios = require('axios'); // Or googleapis
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// --- CORS Configuration ---
const allowedOrigins = [
    'https://wacare-backend.web.app', // Your Firebase Hosting frontend
    'http://localhost:5000',          // For local Firebase testing
    'http://127.0.0.1:5000'
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked origin - ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: 'Content-Type, Authorization',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions)); // Apply CORS FIRST


// --- Helper function to parse basic CSV ---
function parseCsv(csvText) {
    console.log("Backend: Entering parseCsv function."); // Log entry
    if (!csvText || typeof csvText !== 'string' || csvText.trim() === '') {
        console.warn("Backend: parseCsv received empty or invalid input text.");
        // Return a valid empty structure if input is bad
        return { header: [], rows: [] };
    }
    console.log("Backend: parseCsv input text (first 100 chars):", csvText.substring(0, 100));

    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length === 0) {
        console.warn("Backend: parseCsv found no lines after splitting.");
        return { header: [], rows: [] };
    }

    const header = lines[0].split(',');
    const rows = lines.slice(1).map(line => line.split(','));
    console.log(`Backend: parseCsv parsed header: ${header.length} columns, ${rows.length} data rows.`);

    const result = { header, rows };
    // console.log("Backend: parseCsv result:", JSON.stringify(result)); // Can be verbose, log count instead
    return result;
}


// --- Function to get sheet data (assuming public CSV method) ---
const PUBLIC_SHEET_CSV_URL = process.env.PUBLIC_SHEET_CSV_URL;
async function getPublicSheetData() {
    console.log("Backend: Entering getPublicSheetData function."); // Log entry
    if (!PUBLIC_SHEET_CSV_URL) {
        console.error('Backend: PUBLIC_SHEET_CSV_URL environment variable is not set.');
        throw new Error('Server configuration error: Missing sheet URL.'); // Throw specific error
    }

    console.log(`Backend: Attempting to fetch from URL: ${PUBLIC_SHEET_CSV_URL}`);
    try {
        const response = await axios.get(PUBLIC_SHEET_CSV_URL, {
             responseType: 'text', // Ensure we get text back
             timeout: 10000 // Add a timeout (10 seconds)
            });

        console.log(`Backend: Axios request successful. Status: ${response.status}.`);

        const csvData = response.data;

        // *** CRITICAL CHECK: Is the data from Google empty? ***
        if (!csvData || typeof csvData !== 'string' || csvData.trim() === '') {
            console.warn("Backend: Received EMPTY or non-string data from the Google Sheet URL.");
            // Return a valid empty structure instead of letting parseCsv fail
            return { header: [], rows: [] };
        } else {
            console.log("Backend: Received non-empty CSV data (first 200 chars):", csvData.substring(0, 200));
        }

        // Call the parser
        console.log("Backend: Calling parseCsv...");
        const parsedData = parseCsv(csvData);
        console.log("Backend: parseCsv finished.");
        return parsedData;

    } catch (err) {
        // Log detailed Axios/fetch errors
        if (err.response) {
            console.error(`Backend: Error fetching sheet URL - Status ${err.response.status}`, err.response.data);
        } else if (err.request) {
            console.error('Backend: Error fetching sheet URL - No response received.', err.request);
        } else {
            console.error('Backend: Error fetching sheet URL - Request setup error.', err.message);
        }
         console.error('Backend: Overall error in getPublicSheetData:', err.message); // Log simplified message
        // Re-throw a user-friendly error for the main handler
        throw new Error('Failed to retrieve or process data from the Google Sheet.');
    }
}


// --- Middleware ---
app.use(express.json()); // For parsing JSON bodies


// --- API Routes ---
app.get('/api/sheet-data', async (req, res) => {
    console.log("Backend: API route /api/sheet-data hit.");
    try {
        console.log("Backend: Calling getPublicSheetData from route handler...");
        const data = await getPublicSheetData(); // Call the function

        // *** Log the data received just before sending ***
        console.log('Backend: Data received back from getPublicSheetData:', JSON.stringify(data, null, 2));

        // Explicitly check if the result is structured correctly
        if (!data || typeof data !== 'object' || !Array.isArray(data.header) || !Array.isArray(data.rows)) {
           console.error("Backend: ERROR - Invalid data structure prepared by getPublicSheetData!", data);
           // Send a specific error status and message
           return res.status(500).json({ error: 'Internal server error: Failed to prepare sheet data.' });
        }

        console.log("Backend: Sending successfully structured data as JSON response.");
        res.json(data); // Send the data

    } catch (error) {
        // Catch errors thrown from getPublicSheetData or other issues
        console.error("Backend: Error caught in /api/sheet-data route handler:", error.message);
        res.status(500).json({ error: error.message || 'Failed to fetch sheet data.' });
    }
});

// --- Health Check & Start Server ---
app.get('/health', (req, res) => res.status(200).send('OK'));
app.listen(port, () => {
    console.log(`WaCare Backend server running on port ${port}`);
    console.log(`Allowing CORS origins: ${allowedOrigins.join(', ')}`);
    if (!PUBLIC_SHEET_CSV_URL) {
        console.warn("WARNING: PUBLIC_SHEET_CSV_URL is not set in environment variables!");
    }
});
