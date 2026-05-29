// Goals backend — single Lambda, internal router.
//
// API Gateway HTTP API in front, with a Cognito JWT authorizer that
// pre-validates tokens and forwards claims at:
//     event.requestContext.authorizer.jwt.claims
//
// Every signed-in user of the shared Cognito pool may use goals — there is
// no group gate (cf. the finance app). The router just requires a `sub`.
//
// Routes (all auth-required):
//   GET  /me             -> { userId, email }
//   GET  /goals          -> { goals: [{ id, label, icon, frequency, completed }] }
//   POST /goals          -> create a goal { label, icon?, frequency? }
//   POST /goals/delete   -> { id }
//   POST /goals/toggle   -> { id } flips completion for the current period
//   GET  /goals/stats    -> { goals: [{ id, ..., streak }] }
//   GET  /goals/history  -> { daily: [...], weekly: [...] }

import { router } from "./lib/router.js";
import * as handlers from "./handlers/index.js";

router.get("/me", handlers.getMe);
router.get("/goals", handlers.getGoals);
router.post("/goals", handlers.postGoal);
router.post("/goals/delete", handlers.postGoalDelete);
router.post("/goals/toggle", handlers.postGoalToggle);
router.get("/goals/stats", handlers.getStats);
router.get("/goals/history", handlers.getHistory);

export const handler = async (event) => {
  const origin = event?.headers?.origin || "*";
  try {
    return await router.dispatch(event, origin);
  } catch (err) {
    console.error("UNHANDLED", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
      body: JSON.stringify({ error: err.message || "internal error" }),
    };
  }
};
