import crypto from 'crypto';

export const base64URLEncode = function (str) {
    return str.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

export const sha256 = function (buffer) {
    return crypto.createHash('sha256').update(buffer).digest();
}

export const generateCodeVerifier = function () {
    const codeVerifier = base64URLEncode(crypto.randomBytes(32));
    console.log('Generated code_verifier:', codeVerifier);
    return codeVerifier;
}

export const generateCodeChallenge = function (codeVerifier) {
    const codeChallenge = base64URLEncode(sha256(codeVerifier));
    console.log('Generated code_challenge:', codeChallenge);
    return codeChallenge;
}

