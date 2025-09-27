// Required libraries. node-fetch for HTTP requests, socket.io-client for WebSockets.
const fetch = require('node-fetch');
const { io } = require('socket.io-client');

// --- CONFIGURATION: You must change these values ---
// This is the base URL of the API server.
// It's retrieved in the original code via `s.sendSync("get-env").API_URL`
const API_BASE_URL = 'https://api.ricecall.com'; // <-- IMPORTANT: Replace with the actual API URL

// The WebSocket URL is usually the same as the API URL, just without the path.
const SOCKET_URL = 'https://api.ricecall.com'; // <-- IMPORTANT: Replace if different

const DELAY_BETWEEN_CALLS_MS = 500;                 // 0.5 seconds

/**
 * A helper function to create a delay.
 * @param {number} ms - The number of milliseconds to wait.
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Step 1 & 2: Performs an HTTP POST request to get an auth token for a specific user.
 * @param {string} username - The user's account name.
 * @param {string} password - The user's password.
 * @returns {Promise<string>} The authentication token.
 */
async function loginAndGetToken(username, password) {
  const loginUrl = `${API_BASE_URL}/login`;
  console.log(`[${username}] [1/4] Sending login request to: ${loginUrl}`);

  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Login failed: ${errorData.message}`);
    }

    const responseData = await response.json();
    const token = responseData?.data?.token;

    if (!token) {
      throw new Error('Token not found in login response.');
    }

    console.log(`[${username}] [2/4] Successfully retrieved authentication token.`);
    return token;
  } catch (error) {
    console.error(`[${username}] Error during login:`, error.message);
    throw error;
  }
}

/**
 * Step 3 & 4: Connects to the WebSocket and waits for a successful connection before proceeding.
 * @param {string} token - The authentication token from the login step.
 * @param {string} serverId - The ID of the server to connect to.
 * @param {string} username - The username for logging purposes.
 * @returns {Promise<Socket>} A promise that resolves with the connected socket instance.
 */
function connectAndJoinServer(token, serverId, username) {
  console.log(`[${username}] [3/4] Attempting to connect to WebSocket...`);

  // We wrap the connection logic in a Promise to await the 'connect' event.
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      query: { token },
      // Optional: Prevent automatic reconnection for this Promise-based flow
      reconnection: false,
    });

    // --- Promise-controlling Event Listeners ---
    socket.on('connect', () => {
      console.log(`[${username}] ✅ SUCCESS: WebSocket connected! Socket ID: ${socket.id}`);
      console.log(`[${username}] [4/4] Sending request to connect to server: ${serverId}`);
      socket.emit('connectServer', { serverId });

      // The promise is now fulfilled, and the main loop can continue.
      resolve(socket);
    });

    socket.on('connect_error', (error) => {
      console.error(`[${username}] ❌ ERROR: WebSocket connection failed: ${error.message}`);
      socket.disconnect(); // Clean up the failed socket
      // The promise is rejected, and the catch block in the main loop will handle it.
      reject(error);
    });

    // --- Standard Informational Event Listeners ---
    socket.on('disconnect', (reason) => {
      console.error(`[${username}] ❌ CONNECTION LOST! Reason: ${reason}`);
    });

    socket.on('userUpdate', (data) => {
        if (data?.update?.currentServerId === serverId) {
            console.log(`[${username}] ✅ SERVER JOIN CONFIRMED!`);
        }
    });
  });
}

/**
 * Main function to run the entire flow for multiple users sequentially.
 */
async function main() {
  // --- USER CREDENTIALS & SERVER ID: Replace with your details ---
  const USERNAMES = []

  for (let i = 900; i < 1000; i++) {
    const num = String(i).padStart(3, "0");
    USERNAMES.push('ry'+num);
  }
  const PASSWORD = process.env.password; // <-- Replace with the shared password
  const SERVER_ID = 'ca5af53a-6386-4b9c-a7e1-12d5a93cd0a1'; // Your Server ID

  if (USERNAMES.includes('user_a') || API_BASE_URL === 'https://your-api-server.com') {
      console.error("Please update the USERNAMES array, PASSWORD, and API_BASE_URL variables before running.");
      return;
  }

  const connectedSockets = {};
  console.log(`Starting to connect ${USERNAMES.length} users sequentially with a ${DELAY_BETWEEN_CALLS_MS}ms delay...`);

  // Use a for...of loop to process each user one by one
  for (const username of USERNAMES) {
    try {
      console.log(`\n--- [START] Processing user: ${username} ---`);
      
      const token = await loginAndGetToken(username, PASSWORD);
      
      // The script will PAUSE here until the socket reports 'connect' or 'connect_error'
      const socket = await connectAndJoinServer(token, SERVER_ID, username);
      
      connectedSockets[username] = socket;
      
      console.log(`--- [SUCCESS] User '${username}' is fully connected. ---`);

    } catch (error) {
      console.error(`--- [FAILED] Could not complete connection for user '${username}'. Moving to next. ---`);
    }

    // Wait before starting the next user's connection process
    if (USERNAMES.indexOf(username) < USERNAMES.length - 1) {
      console.log(`... Waiting for ${DELAY_BETWEEN_CALLS_MS}ms before starting next user ...`);
      await delay(DELAY_BETWEEN_CALLS_MS);
    }
  }

  console.log('\n--- All Connection Attempts Initiated ---');
  console.log(`Total successful initiations: ${Object.keys(connectedSockets).length} / ${USERNAMES.length}`);
  // Note: The sockets will continue to run in the background.
}

// Run the main function
main();
