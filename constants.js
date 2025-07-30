import 'dotenv/config';

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
export const REDIRECT_PORT = process.env.REDIRECT_PORT || 3000;
export const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
