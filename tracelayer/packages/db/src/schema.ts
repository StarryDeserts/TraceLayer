import { resolve } from 'node:path';
import { initializeSchema, openTraceLayerDb } from './index.js';

const dbPath = process.env.TRACE_LAYER_DB_PATH ?? resolve(process.cwd(), 'data', 'tracelayer.sqlite');
const db = openTraceLayerDb(dbPath);
initializeSchema(db);
db.close();
