const express = require('express');
const axios = require('axios'); // Use axios to fetch the public URL
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// --- Public Google Sheet CSV URL (Store in .env) ---
const PUBLIC_SHEET_CSV_URL = process.env.PUBLIC_SHEET_CSV_URL; // Get URL from .env

// --- Helper function to parse basic CSV ---
// NOTE: This is a simple parser. It won't handle complex cases
// like commas within quoted fields perfectly.
function parseCsv(csvText) {
    if (!csvText || typeof csvText !== 'string') {
        return { header: [], rows: [] };
    }
    // Split into lines, handling potential '\r\n' or just '\n'
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length === 0) {
        return { header: [], rows: [] };
    }

    // Assume first line is header
    const header = lines[0].split(',');

    // Process remaining lines as data rows
    const rows = lines.slice(1).map(line => {
        // Simple split by comma for data rows
        return line.split(',');
        // For slightly more robustness (handling simple quotes), you might use:
        // return line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(cell => cell.replace(/^"|"$/g, '')) || [];
    });

    return { header, rows };
}


async function getPublicSheetData() {
    if (!PUBLIC_SHEET_CSV_URL) {
        throw new Error('PUBLIC_SHEET_CSV_URL is not defined in your .env file.');
    }
    try {
        console.log(`Fetching data from: ${PUBLIC_SHEET_CSV_URL}`);
        const response = await axios.get(PUBLIC_SHEET_CSV_URL);
        const csvData = response.data; // The raw CSV text
        console.log("CSV Data received.");
        return parseCsv(csvData); // Parse the CSV text
    } catch (err) {
        console.error('Error fetching or parsing public sheet data:', err.message);
        if (err.response) {
            console.error('Response Status:', err.response.status);
            console.error('Response Data:', err.response.data);
        }
        throw new Error('Could not fetch or parse data from the public Google Sheet URL.');
    }
}

// --- Middleware ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- API Routes ---
app.get('/api/sheet-data', async (req, res) => {
    // NOTE: Still relying on Firebase Auth on the client-side to protect access
    // to this API endpoint itself.
    try {
        const { header, rows } = await getPublicSheetData();
        res.json({ header, rows });
    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: error.message || 'Failed to fetch sheet data.' });
    }
});

// --- Page Routes ---
app.get('https://wacare-backend.web.app', (req, res) => {
    res.sendFile(path.join('https://wacare-backend.web.app', 'login.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join('https://wacare-backend.web.app', 'login.html'));
});
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join('https://wacare-backend.web.app', 'dashboard.html'));
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`WaCare Dashboard server running at http://localhost:${port}`);
    if (!PUBLIC_SHEET_CSV_URL) {
        console.warn("WARNING: PUBLIC_SHEET_CSV_URL is not set in .env. API will fail.");
    } else {
        console.log("Fetching data from public CSV URL.");
    }
    console.log("REMINDER: Using a public sheet is insecure for sensitive data.");
});
