// Site configuration. In production these are baked in at `vite build` time
// from VITE_* env vars set by the GitHub Actions workflow. For local dev,
// put them in frontend/.env.local (gitignored).
//
// We assert the presence of each value at module load — better to fail
// immediately with a clear error than to send a half-broken bundle that
// silently 401s every API call.

function required(name) {
  const v = import.meta.env[name];
  if (!v) throw new Error(`Missing build-time env var: ${name}`);
  return v;
}

export const CONFIG = {
  apiUrl: required("VITE_API_URL"),
  cognitoRegion: required("VITE_COGNITO_REGION"),
  cognitoUserPoolId: required("VITE_COGNITO_USER_POOL_ID"),
  cognitoAppClientId: required("VITE_COGNITO_APP_CLIENT_ID"),
};
