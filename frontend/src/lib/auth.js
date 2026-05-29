// Thin wrapper around Cognito's InitiateAuth / SignUp / ConfirmSignUp APIs.
// Uses direct fetch — avoids pulling in the (chunky) amazon-cognito-identity-js
// package so the build stays small.

import { CONFIG } from "./config.js";

const STORAGE_KEYS = {
  idToken: "goals.idToken",
  accessToken: "goals.accessToken",
  refreshToken: "goals.refreshToken",
  expiresAt: "goals.expiresAt",
  email: "goals.email",
};

function endpoint() {
  return `https://cognito-idp.${CONFIG.cognitoRegion}.amazonaws.com/`;
}

async function cognitoCall(target, body) {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(json.message || json.__type || `Cognito ${target} failed`);
    err.code = json.__type;
    throw err;
  }
  return json;
}

export async function signUp(email, password) {
  return cognitoCall("SignUp", {
    ClientId: CONFIG.cognitoAppClientId,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });
}

export async function confirmSignUp(email, code) {
  return cognitoCall("ConfirmSignUp", {
    ClientId: CONFIG.cognitoAppClientId,
    Username: email,
    ConfirmationCode: code,
  });
}

export async function resendConfirmation(email) {
  return cognitoCall("ResendConfirmationCode", {
    ClientId: CONFIG.cognitoAppClientId,
    Username: email,
  });
}

export async function signIn(email, password) {
  const res = await cognitoCall("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CONFIG.cognitoAppClientId,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  const r = res.AuthenticationResult;
  if (!r) throw new Error("Sign in failed (no tokens returned).");
  storeTokens(r, email);
  return r;
}

function storeTokens(r, email) {
  const expiresAt = Date.now() + (r.ExpiresIn || 3600) * 1000;
  localStorage.setItem(STORAGE_KEYS.idToken, r.IdToken);
  localStorage.setItem(STORAGE_KEYS.accessToken, r.AccessToken);
  if (r.RefreshToken) localStorage.setItem(STORAGE_KEYS.refreshToken, r.RefreshToken);
  localStorage.setItem(STORAGE_KEYS.expiresAt, String(expiresAt));
  if (email) localStorage.setItem(STORAGE_KEYS.email, email);
}

export async function refreshSession() {
  const refresh = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refresh) throw new Error("no refresh token");
  const res = await cognitoCall("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: CONFIG.cognitoAppClientId,
    AuthParameters: { REFRESH_TOKEN: refresh },
  });
  const r = res.AuthenticationResult;
  if (!r) throw new Error("refresh failed");
  storeTokens(r);
  return r;
}

export function getIdToken() {
  return localStorage.getItem(STORAGE_KEYS.idToken);
}

export function getEmail() {
  return localStorage.getItem(STORAGE_KEYS.email);
}

export function isSessionFresh() {
  const exp = Number(localStorage.getItem(STORAGE_KEYS.expiresAt) || 0);
  return exp > Date.now() + 30_000;
}

export function isSignedIn() {
  return !!getIdToken();
}

export function signOut() {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
}
