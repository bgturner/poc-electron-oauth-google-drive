# Electron Google OAuth 2.0 App

A minimal Electron application demonstrating Google OAuth 2.0 authentication with PKCE (Proof Key for Code Exchange) flow.

NOTE: This was vibe-coded with [Aider](https://aider.chat/) which means it's definitely still a PoC and had not been reviewed with an eye towards security.

## Features

- Google OAuth 2.0 authentication with PKCE
- Local loopback server for secure redirect handling
- No client secret required (suitable for distributed desktop apps)
- Verbose logging for development and debugging

## Prerequisites

- Node.js (version 18 or higher - required for built-in fetch API)
- npm
- A Google Cloud Platform account

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/bgturner/poc-electron-oauth-google-drive.git
cd poc-electron-oauth-google-drive
npm install
```

### 2. Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the required APIs:
   - Go to "APIs & Services" > "Library"
   - Search for and enable "Google+ API" or "Google Identity API"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Desktop application" as the application type
   - Give it a name (e.g., "Electron OAuth App")
5. Configure the redirect URI:
   - No need to configure a redirect URI within the Google UI because we're using a "Desktop application" as well as a loopback device as recommended in the [Google Documentation](https://developers.google.com/identity/protocols/oauth2/native-app#installed_app_redirect_methods)
   - If you want to use a different port than the default `3000`, update the .env file
6. Copy the Client ID (you'll need this for the next step)

### 3. Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and replace the placeholder with your actual Google Client ID:
   ```
   GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
   REDIRECT_PORT=3000
   ```

### 4. Run the Application

```bash
npm start
```

## Usage

1. Launch the application with `npm start`
2. Click the "Authenticate" button
3. Your default browser will open with Google's OAuth consent screen
4. Sign in with your Google account and grant permissions
5. The browser will redirect back to the local server
6. Check the terminal/console for verbose logging of the OAuth flow
7. The authorization code will be logged (this can be exchanged for access tokens)

## OAuth Flow Details

This application implements the OAuth 2.0 Authorization Code flow with PKCE:

1. **PKCE Parameter Generation**: Creates `code_verifier` and `code_challenge`
2. **Local Server**: Starts an HTTP server on `127.0.0.1:3000` (or custom port)
3. **Authorization Request**: Opens browser to Google's OAuth endpoint
4. **User Consent**: User authenticates and grants permissions
5. **Authorization Code**: Google redirects back with authorization code
6. **Verification**: Validates state parameter to prevent CSRF attacks

## Security Features

- **PKCE**: Protects against authorization code interception attacks
- **State Parameter**: Prevents CSRF attacks
- **Loopback Interface**: Uses `127.0.0.1` instead of `localhost` for better security
- **No Client Secret**: Suitable for distributed desktop applications

## Development

### Verbose Logging

The application includes extensive console logging to help you understand the OAuth flow:

- PKCE parameter generation
- Server startup and requests
- Authorization URL construction
- Callback parameter validation
- Success/error states

### Customization

- **Port**: Change `REDIRECT_PORT` in `.env` to use a different port
- **Scopes**: Modify the `scope` parameter in the authorization URL
- **Additional Parameters**: Add more OAuth parameters as needed

## Troubleshooting

### Common Issues

1. **"GOOGLE_CLIENT_ID is not set"**
   - Make sure you've created a `.env` file with your Client ID

2. **"redirect_uri_mismatch"**
   - Ensure the redirect URI in Google Cloud Console matches exactly: `http://127.0.0.1:3000/callback`
   - Check that the port matches your `REDIRECT_PORT` setting

3. **"Server error: EADDRINUSE"**
   - The port is already in use. Change `REDIRECT_PORT` in `.env` to a different port
   - Make sure to update the redirect URI in Google Cloud Console accordingly

4. **Browser doesn't open**
   - Check that your system has a default browser configured
   - Look for any error messages in the console

### Debug Mode

Run with additional logging:
```bash
npm run dev
```

## Next Steps

This implementation currently only obtains the authorization code. To complete the OAuth flow:

1. Exchange the authorization code for access and refresh tokens. This is currently broken, with Google giving a 400 Bad Request response. The specific error description is 'client_secret is missing.'
2. Store tokens securely
3. Implement token refresh logic
4. Make authenticated API calls

## Security Considerations

- Never commit your `.env` file to version control
- Store tokens securely (consider using Electron's safeStorage API)
- Implement proper token refresh logic
- Validate all OAuth responses
- Use HTTPS in production environments

## License

MIT License - see LICENSE file for details
