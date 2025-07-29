const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const url = require('url');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config();

// Google OAuth 2.0 configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REDIRECT_PORT = process.env.REDIRECT_PORT || 3000;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

// Validate required environment variables
if (!GOOGLE_CLIENT_ID) {
  console.error('❌ GOOGLE_CLIENT_ID is not set in .env file');
  console.error('Please check the README.md for setup instructions');
  process.exit(1);
}

// PKCE helper functions
function base64URLEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

function generateCodeVerifier() {
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  console.log('Generated code_verifier:', codeVerifier);
  return codeVerifier;
}

function generateCodeChallenge(codeVerifier) {
  const codeChallenge = base64URLEncode(sha256(codeVerifier));
  console.log('Generated code_challenge:', codeChallenge);
  return codeChallenge;
}

function authenticate() {
  console.log('authenticate() function called in main process');
  console.log('Starting Google OAuth 2.0 with PKCE flow...');
  console.log('Using Client ID:', GOOGLE_CLIENT_ID.substring(0, 20) + '...');
  console.log('Using Redirect URI:', REDIRECT_URI);
  
  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = base64URLEncode(crypto.randomBytes(16));
  
  console.log('Generated state parameter:', state);
  
  // Create local server to handle the redirect
  const server = http.createServer((req, res) => {
    console.log('Received request on local server:', req.url);
    
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/callback') {
      const { code, state: returnedState, error } = parsedUrl.query;
      
      console.log('Callback received with parameters:');
      console.log('- code:', code ? 'present' : 'missing');
      console.log('- state:', returnedState);
      console.log('- error:', error);
      
      if (error) {
        console.error('OAuth error:', error);
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authentication Error</h1><p>${error}</p>`);
      } else if (returnedState !== state) {
        console.error('State mismatch! Expected:', state, 'Received:', returnedState);
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Authentication Error</h1><p>State parameter mismatch</p>');
      } else if (code) {
        console.log('✅ Authorization code received successfully!');
        console.log('Authorization code:', code);
        console.log('Code verifier for token exchange:', codeVerifier);
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <h1>Authentication Successful!</h1>
          <p>You can close this window and return to the application.</p>
          <script>window.close();</script>
        `);
      } else {
        console.error('No authorization code received');
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Authentication Error</h1><p>No authorization code received</p>');
      }
      
      // Close the server after handling the callback
      console.log('Closing local server...');
      server.close();
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>Not Found</h1>');
    }
  });
  
  // Start the server
  server.listen(REDIRECT_PORT, '127.0.0.1', () => {
    console.log(`Local server started on http://127.0.0.1:${REDIRECT_PORT}`);
    
    // Build the authorization URL
    const authParams = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state,
      access_type: 'offline',
      prompt: 'consent'
    });
    
    const authUrl = `${GOOGLE_AUTH_URL}?${authParams.toString()}`;
    console.log('Opening authorization URL in browser...');
    console.log('Auth URL:', authUrl);
    
    // Open the authorization URL in the default browser
    shell.openExternal(authUrl);
  });
  
  // Handle server errors
  server.on('error', (err) => {
    console.error('Server error:', err);
  });
}

function createWindow() {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle IPC call from renderer process
ipcMain.handle('authenticate', async () => {
  authenticate();
  return 'Authentication function called';
});
