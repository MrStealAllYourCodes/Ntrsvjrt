const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { parse } = require('csv-parse');

const app = express();
const port = process.env.PORT || 3000;

// --- CORS Configuration ---
// ... (keep your existing CORS config) ...
const allowedOrigins = [ /* ... */ ];
const corsOptions = { /* ... keep your options ... */ };
app.use(cors(corsOptions));


// --- Function to get sheet data (accepts page name) ---
async function getPublicSheetData(pageName) { // Added pageName argument
    console.log(`Backend: Entering getPublicSheetData for page: ${pageName}`);

    let targetUrl;
    // Select the correct URL based on the pageName parameter
    switch (pageName) {
        case 'PAGE1': // Use the exact names you'll send from the frontend
            targetUrl = process.env.PUBLIC_SHEET_URL_PAGE1;
            break;
        case 'PAGE2':
            targetUrl = process.env.PUBLIC_SHEET_URL_PAGE2;
            break;
        case 'PAGE3':
            targetUrl = process.env.PUBLIC_SHEET_URL_PAGE3;
            break;
        case 'PAGE4':
            targetUrl = process.env.PUBLIC_SHEET_URL_PAGE4;
            break;
        default:
            console.error(`Backend: Invalid page name requested: ${pageName}`);
            throw new Error(`Invalid data page requested: ${pageName}`);
    }

    if (!targetUrl) {
        console.error(`Backend: Environment variable for page ${pageName} URL is not set.`);
        throw new Error(`Server configuration error: Missing URL for page ${pageName}.`);
    }

    console.log(`Backend: Attempting to fetch from URL: ${targetUrl}`);
    try {
        const response = await axios.get(targetUrl, { responseType: 'text', timeout: 15000 }); // Increased timeout slightly
        console.log(`Backend: Axios request successful for ${pageName}. Status: ${response.status}.`);
        const csvData = response.data;

        if (!csvData || typeof csvData !== 'string' || csvData.trim() === '') {
            console.warn(`Backend: Received EMPTY data for page ${pageName} from Google Sheet URL.`);
            return []; // Return empty array for empty sheets
        }

        console.log(`Backend: Parsing CSV for page ${pageName}...`);
        // Use csv-parse (promise-based API)
        return new Promise((resolve, reject) => {
            parse(csvData, {
                columns: true, // Assumes first row is header for all sheets
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true
            }, (err, records) => {
                if (err) {
                    console.error(`Backend: csv-parse error for page ${pageName}:`, err);
                    reject(new Error(`Failed to parse CSV data for page ${pageName}.`));
                } else {
                    console.log(`Backend: csv-parse finished for ${pageName}. Parsed ${records.length} records.`);
                    resolve(records);
                }
            });
        });

    } catch (err) {
        // Handle Axios errors etc.
        console.error(`Backend: Error fetching or processing sheet URL for page ${pageName}.`, err.message);
        throw new Error(`Failed to retrieve or process data for page ${pageName}.`);
    }
}

// --- Middleware ---
app.use(express.json());

// --- API Route (modified) ---
// Now expects a query parameter like /api/sheet-data?page=PAGE1
app.get('/api/sheet-data', async (req, res) => {
    const pageName = req.query.page; // Get page name from query parameter

    // Basic validation for pageName
    if (!pageName) {
         console.warn("Backend: API request missing 'page' query parameter.");
         return res.status(400).json({ error: "Missing 'page' query parameter." });
    }
     // Optional: Validate against expected page names
     const validPages = ['PAGE1', 'PAGE2', 'PAGE3', 'PAGE4']; // Use your actual identifiers
     if (!validPages.includes(pageName)) {
         console.warn(`Backend: API request with invalid 'page' query parameter: ${pageName}`);
         return res.status(400).json({ error: `Invalid page name: ${pageName}` });
     }

    console.log(`Backend: API route /api/sheet-data hit for page: ${pageName}`);
    try {
        const data = await getPublicSheetData(pageName); // Pass pageName to fetcher
        console.log(`Backend: Sending data for page ${pageName}. Record count: ${data.length}`);
        res.json(data); // Send the array of objects

    } catch (error) {
        console.error(`Backend: Error caught in API route for page ${pageName}:`, error.message);
        // Send specific error message if available
        res.status(500).json({ error: error.message || `Failed to fetch data for page ${pageName}.` });
    }
});

// --- Health Check & Start Server ---
// ... (keep existing health check and app.listen) ...
app.get('/health', (req, res) => res.status(200).send('OK'));
app.listen(port, () => {
    console.log(`WaCare Backend server running on port ${port}`);
    // ... other startup logs ...
});
