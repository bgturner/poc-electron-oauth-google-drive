const { app, BrowserWindow, ipcMain, shell } = require('electron');
const http = require('http');
const url = require('url');
const crypto = require('crypto');
const {
	GOOGLE_CLIENT_ID,
	REDIRECT_URI,
	GOOGLE_TOKEN_URL,
	GOOGLE_USERINFO_URL,
	REDIRECT_PORT,
	GOOGLE_AUTH_URL,
} = require('./constants.js');
const {
	generateCodeVerifier,
	generateCodeChallenge,
	base64URLEncode,
} = require('./helpers.js');

// Validate required environment variables
if (!GOOGLE_CLIENT_ID) {
  console.error('❌ GOOGLE_CLIENT_ID is not set in .env file');
  console.error('Please check the README.md for setup instructions');
  process.exit(1);
}

// Store user data globally
let currentUser = null;

async function exchangeCodeForTokens(code, codeVerifier) {
  console.log('Exchanging authorization code for tokens...');
  
  const tokenParams = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    code: code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI
  });

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString()
    });

	const json = await response.json();

    if (!response.ok) {
		throw new Error(`Token exchange failed: ${response.status} ${response.statusText}\n\tError: ${json.error}\n\tDescription: ${json.error_description}`);
    }

    const tokens = await response.json();
    console.log('✅ Tokens received successfully!');
    console.log('Access token:', tokens.access_token ? 'present' : 'missing');
    console.log('Refresh token:', tokens.refresh_token ? 'present' : 'missing');
    
    return tokens;
  } catch (error) {
    console.error('❌ Error exchanging code for tokens:', error);
    throw error;
  }
}

async function fetchUserInfo(accessToken) {
  console.log('Fetching user information...');
  
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`User info fetch failed: ${response.status} ${response.statusText}`);
    }

    const userInfo = await response.json();
    console.log('✅ User info received:', userInfo);
    
    return userInfo;
  } catch (error) {
    console.error('❌ Error fetching user info:', error);
    throw error;
  }
}

function authorize(codeChallenge, state) {
  return new Promise((resolve, reject) => {
    console.log('Starting authorization flow...');
    
    // Define OAuth scopes
    const scopes = ['openid', 'email', 'profile'];
    
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
          reject(new Error(`OAuth error: ${error}`));
        } else if (returnedState !== state) {
          console.error('State mismatch! Expected:', state, 'Received:', returnedState);
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication Error</h1><p>State parameter mismatch</p>');
          reject(new Error('State parameter mismatch'));
        } else if (code) {
          console.log('✅ Authorization code received successfully!');
          console.log('Authorization code:', code);
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <h1>Authorization Successful!</h1>
            <p>You can close this window and return to the application.</p>
            <script>window.close();</script>
          `);
          
          resolve(code);
        } else {
          console.error('No authorization code received');
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Authentication Error</h1><p>No authorization code received</p>');
          reject(new Error('No authorization code received'));
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
        scope: scopes.join(' '),
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
      reject(err);
    });
  });
}

function logOut() {
  console.log('logOut() function called in main process');
  currentUser = null;
  
  // Notify all windows that user logged out
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('auth-logout');
  });
}

async function authenticate() {
  console.log('authenticate() function called in main process');
  console.log('Starting Google OAuth 2.0 with PKCE flow...');
  console.log('Using Client ID:', GOOGLE_CLIENT_ID.substring(0, 20) + '...');
  console.log('Using Redirect URI:', REDIRECT_URI);
  
  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = base64URLEncode(crypto.randomBytes(16));
  
  console.log('Generated state parameter:', state);
  console.log('Code verifier for token exchange:', codeVerifier);
  
  try {
    // Get authorization code
    const code = await authorize(codeChallenge, state);
    
    // Exchange code for tokens and fetch user info
    const tokens = await exchangeCodeForTokens(code, codeVerifier);
    const userInfo = await fetchUserInfo(tokens.access_token);
    
    // Store user data
    currentUser = {
      ...userInfo,
      tokens: tokens
    };
    
    // Notify all windows that authentication was successful with user data
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('auth-success', { 
        user: userInfo,
        tokens: tokens 
      });
    });
    
  } catch (error) {
    console.error('❌ Error in authentication flow:', error);
    
    // Notify windows of the error
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('auth-error', { 
        error: error.message 
      });
    });
  }
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

ipcMain.handle('logout', async () => {
  logOut();
  return 'Logout function called';
});
