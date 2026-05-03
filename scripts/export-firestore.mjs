/**
 * Export all Firestore documents to a local JSON file.
 *
 * Prerequisites:
 * 1. Firebase Console → Project settings → Service accounts → Generate new private key.
 *    Save the JSON file somewhere safe (never commit it).
 * 2. Set credentials before running, e.g. in PowerShell:
 *      $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\serviceAccountKey.json"
 *    Or one-off:
 *      set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\serviceAccountKey.json
 *
 * Output: firestore-export.json in the project root (overwrites if present).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, getApps, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_FILE = join(ROOT, "firestore-export.json");

const COLLECTIONS = ["links", "collections"];

function loadEnvLocal() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  const text = readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function serializeValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val.toMillis === "function") return val.toMillis();
  if (Array.isArray(val)) return val.map(serializeValue);
  if (typeof val === "object") {
    if (val.constructor === Object) {
      const o = {};
      for (const [k, v] of Object.entries(val)) o[k] = serializeValue(v);
      return o;
    }
  }
  return val;
}

function serializeDoc(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = serializeValue(v);
  }
  return out;
}

function initAdmin() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error(
      "Missing project ID. Set NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local or FIREBASE_PROJECT_ID."
    );
    process.exit(1);
  }

  if (getApps().length > 0) return getFirestore();

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const explicitJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (explicitJson) {
    try {
      const parsed = JSON.parse(explicitJson);
      initializeApp({ credential: cert(parsed), projectId });
    } catch {
      console.error("FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON.");
      process.exit(1);
    }
  } else if (keyPath && existsSync(keyPath)) {
    const raw = readFileSync(keyPath, "utf8");
    initializeApp({ credential: cert(JSON.parse(raw)), projectId });
  } else {
    try {
      initializeApp({ credential: applicationDefault(), projectId });
    } catch (e) {
      console.error(
        "Could not initialize Firebase Admin. Do one of the following:\n" +
          "  • Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path\n" +
          "  • Or set FIREBASE_SERVICE_ACCOUNT_JSON to the JSON string\n" +
          "  • Or run `gcloud auth application-default login` (if using user ADC)\n",
        e.message
      );
      process.exit(1);
    }
  }

  return getFirestore();
}

async function fetchCollection(db, name) {
  const snap = await db.collection(name).get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...serializeDoc(d.data()),
  }));
}

async function main() {
  loadEnvLocal();
  const db = initAdmin();
  const exportedAt = new Date().toISOString();
  const payload = {
    exportedAt,
    projectId:
      process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    collections: {},
  };

  for (const col of COLLECTIONS) {
    console.error(`Reading "${col}"…`);
    payload.collections[col] = await fetchCollection(db, col);
    console.error(`  → ${payload.collections[col].length} documents`);
  }

  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.error(`Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
