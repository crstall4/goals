// Tiny method+path router for API Gateway HTTP API v2 events.
//
// All routes require a Cognito JWT (validated by API Gateway's JWT
// authorizer, which forwards claims at event.requestContext.authorizer.jwt.claims).
// Unlike the finance app, goals does NOT gate on a Cognito group — any
// signed-in user of the shared pool is allowed. We only require a `sub`.

const routes = []; // { method, path, handler }

export const router = {
  get: (path, handler) => routes.push({ method: "GET", path, handler }),
  post: (path, handler) => routes.push({ method: "POST", path, handler }),

  async dispatch(event, origin) {
    const method = (event.requestContext?.http?.method || "GET").toUpperCase();
    const path = event.requestContext?.http?.path || event.rawPath || "/";

    if (method === "OPTIONS") return cors(204, "", origin);

    const route = routes.find((r) => r.method === method && r.path === path);
    if (!route) return cors(404, JSON.stringify({ error: `no route for ${method} ${path}` }), origin);

    const claims = event.requestContext?.authorizer?.jwt?.claims;
    if (!claims || !claims.sub) {
      return cors(401, JSON.stringify({ error: "unauthenticated" }), origin);
    }

    const ctx = {
      userId: claims.sub,
      email: claims.email,
      query: event.queryStringParameters || {},
      body: parseBody(event),
    };

    const out = await route.handler(ctx);
    const status = out?.statusCode ?? 200;
    const body = out?.body ?? out ?? {};
    return cors(status, typeof body === "string" ? body : JSON.stringify(body), origin);
  },
};

function parseBody(event) {
  if (!event.body) return null;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cors(statusCode, body, origin) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "600",
    },
    body,
  };
}
