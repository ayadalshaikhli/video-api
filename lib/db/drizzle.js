import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

// For migrations
export const migrationClient = postgres(connectionString, { max: 1 });

// For queries
export const client = postgres(connectionString);
export const db = drizzle(client, { schema });
