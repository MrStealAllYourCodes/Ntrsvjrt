// server.js - Modified for separate hosting

const express = require('express');
const axios = require('axios'); // Or googleapis if using service account
const path = require('path');
const cors = require('cors'); // Import CORS

const app = express();
const port = process.env.PORT || 3000; // Render typically sets PORT env variable

// --- CORS Configuration ---
// Allow requests from your Firebase Hosting domain
const firebaseHostingUrl = process.env.FIREBASE_HOSTING_URL || 'https://wacare-backend.web.app'; // Replace with your actual URL or set in .env
const corsOptions = {
  origin: [firebaseHostingUrl, 'http://localhost:5000', 'http://127.0.0.1:5000'], // Add localhost for local Firebase testing (firebase serve)
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};
app.use(cors(corsOptions)); // Enable CORS with specific origin


// --- Public Sheet or Service Account Logic (Keep ONE) ---

// Option A: Public Sheet Fetching (using axios)
const PUBLIC_SHEET_CSV_URL = process.env.PUBLIC_SHEET_CSV_URL;
function parseCsv(csvText) { /* ... keep your parseCsv function ... */ }
async function getPublicSheetData() { /* ... keep your getPublicSheetData function ... */ }

/* // Option B: Service Account Fetching (using googleapis)
const { google } = require('googleapis');
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const RANGE = process.env.GOOGLE_SHEET_RANGE;
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json'); // Ensure credentials.json IS deployed with server.js if using this
async function getSheetData() { //... keep your getSheetData function ...}
*/

// --- Middleware ---
// app.use(express.static(...)); // REMOVE THIS LINE
app.use(express.json());

// --- API Routes ---
app.get('/api/sheet-data', async (req, res) => {
    try {
        // Call the appropriate function based on your chosen method
        const data = await getPublicSheetData(); // or await getSheetData() for service account
        res.json(data); // Send header/rows object directly if parsed/processed
    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: error.message || 'Failed to fetch sheet data.' });
    }
});

// --- Page Routes ---
// REMOVE THESE ROUTES - They are now served by Firebase Hosting
// app.get('/', (req, res) => { ... });
// app.get('/login', (req, res) => { ... });
// app.get('/dashboard', (req, res) => { ... });

// --- Basic Health Check Route (Good Practice) ---
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});


// --- Start Server ---
app.listen(port, () => {
    console.log(`WaCare Backend server running on port ${port}`);
    // Add any relevant config logging here (e.g., which sheet method is used)
});
