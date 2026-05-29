// DynamoDB data access layer.
//
// Single table, two item kinds, all partitioned by USER#<userId>:
//
//   GOAL#<goalId>          attrs: label, icon, frequency, sortOrder, createdAt
//   COMP#<date>#<goalId>   attr:  completed = true
//
// We only ever store COMPLETED records. Missed periods store nothing — the
// history/streak math in the handlers infers misses by enumerating dates and
// checking which completions exist. Per-user data is tiny, so a single Query
// against PK = USER#<userId> pulls everything the API needs.
//
// Table name comes from the TABLE_NAME env var, set by Terraform.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

const TABLE = process.env.TABLE_NAME;
if (!TABLE) console.warn("TABLE_NAME env var not set");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const pk = (userId) => `USER#${userId}`;
const goalSk = (goalId) => `GOAL#${goalId}`;
const compSk = (date, goalId) => `COMP#${date}#${goalId}`;

// ----- Goals --------------------------------------------------------------

export async function listGoals(userId) {
  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": pk(userId), ":prefix": "GOAL#" },
  }));
  return (res.Items || [])
    .map(stripKeys)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export async function createGoal(userId, { label, icon, frequency }) {
  const goalId = randomUUID();
  const item = {
    PK: pk(userId),
    SK: goalSk(goalId),
    goalId,
    label,
    icon,
    frequency,
    sortOrder: Date.now(),
    createdAt: Date.now(),
  };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return stripKeys(item);
}

// Delete a goal AND every completion record tied to it.
export async function deleteGoal(userId, goalId) {
  await ddb.send(new DeleteCommand({
    TableName: TABLE,
    Key: { PK: pk(userId), SK: goalSk(goalId) },
  }));
  const comps = await listCompletions(userId);
  const orphans = comps
    .filter((c) => c.goalId === goalId)
    .map((c) => ({ DeleteRequest: { Key: { PK: pk(userId), SK: compSk(c.date, c.goalId) } } }));
  await batchWriteChunked(orphans);
}

// ----- Completions --------------------------------------------------------

// Returns [{ date, goalId, completed }]
export async function listCompletions(userId) {
  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
    ExpressionAttributeValues: { ":pk": pk(userId), ":prefix": "COMP#" },
  }));
  return (res.Items || []).map((it) => {
    // SK = COMP#<date>#<goalId>
    const rest = it.SK.slice("COMP#".length);
    const sep = rest.indexOf("#");
    return { date: rest.slice(0, sep), goalId: rest.slice(sep + 1), completed: it.completed === true };
  });
}

export async function setCompletion(userId, goalId, date, completed) {
  if (completed) {
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: { PK: pk(userId), SK: compSk(date, goalId), completed: true },
    }));
  } else {
    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { PK: pk(userId), SK: compSk(date, goalId) },
    }));
  }
}

// ----- Defaults -----------------------------------------------------------

export const DEFAULT_GOALS = [
  { label: "Read Scriptures", icon: "📖", frequency: "daily" },
  { label: "LeetCode Problem", icon: "💻", frequency: "daily" },
  { label: "Exercise", icon: "🏋️", frequency: "daily" },
];

// Seed the starter goal set for a brand-new user. Called by the /goals
// handler on first read when the user has none.
export async function seedDefaultGoals(userId) {
  const created = [];
  // Sequential so sortOrder (Date.now()) preserves the listed order.
  for (const def of DEFAULT_GOALS) {
    created.push(await createGoal(userId, def));
  }
  return created;
}

// ----- helpers ------------------------------------------------------------

function stripKeys(row) {
  const { PK, SK, ...rest } = row;
  return rest;
}

// DynamoDB BatchWrite caps at 25 items per call. Chunk and send in parallel.
async function batchWriteChunked(requests) {
  if (!requests.length) return;
  const chunks = [];
  for (let i = 0; i < requests.length; i += 25) {
    chunks.push(requests.slice(i, i + 25));
  }
  for (const chunk of chunks) {
    await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE]: chunk } }));
  }
}
