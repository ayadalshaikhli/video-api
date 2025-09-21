/**
 * Temporary schema for UUID migration
 * This schema includes both integer IDs (for existing data) and UUID columns (for new system)
 * Use this during the migration phase before switching to full UUID schema
 */

import {
    pgTable,
    serial,
    varchar,
    text,
    timestamp,
    numeric,
    integer,
    jsonb,
    boolean,
    json,
    uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Example of how tables will look during migration
// Each table has both the old integer ID and new UUID columns

export const users = pgTable('users', {
    // Old integer ID (keep for now)
    id: serial('id').primaryKey(),
    // New UUID ID (this will become primary key later)
    uuidId: uuid('uuid_id').unique().defaultRandom(),
    
    name: varchar('name', { length: 100 }),
    email: varchar('email', { length: 255 }).unique(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 20 }).default('member'),
    solanaWalletAddress: varchar('solana_wallet_address', { length: 44 }).unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
    // Old integer ID (keep for now)
    id: serial('id').primaryKey(),
    // New UUID ID (this will become primary key later)
    uuidId: uuid('uuid_id').unique().defaultRandom(),
    
    name: varchar('name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId: text('stripe_subscription_id').unique(),
    stripeProductId: text('stripe_product_id'),
    planName: varchar('plan_name', { length: 50 }),
    subscriptionStatus: varchar('subscription_status', { length: 20 }),
    solanaWalletAddress: varchar('solana_wallet_address', { length: 44 }),
    lastPaymentType: varchar('last_payment_type', { length: 20 }),
});

export const teamMembers = pgTable('team_members', {
    // Old integer ID (keep for now)
    id: serial('id').primaryKey(),
    // New UUID ID (this will become primary key later)
    uuidId: uuid('uuid_id').unique().defaultRandom(),
    
    // Old foreign keys (keep for now)
    userId: integer('user_id')
        .notNull()
        .references(() => users.id),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id),
    
    // New UUID foreign keys (populated during migration)
    uuidUserId: uuid('uuid_user_id'),
    uuidTeamId: uuid('uuid_team_id'),
    
    role: varchar('role', { length: 50 }).notNull(),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

// Add similar structure for other tables...
// This is just an example to show the pattern

/* 
MIGRATION PROCESS:

1. Run Phase 1: Add UUID columns to all tables
2. Run Phase 2: Populate UUID foreign key relationships  
3. Update application code to use UUID columns instead of integer IDs
4. Run Phase 3: Make UUID columns the primary keys and drop integer columns
5. Update schema.js to final UUID-only version

During the migration, your app can read from both columns but should start writing to UUID columns.
*/

export const ActivityType = {
    SIGN_UP: 'SIGN_UP',
    SIGN_IN: 'SIGN_IN',
    SIGN_OUT: 'SIGN_OUT',
    UPDATE_PASSWORD: 'UPDATE_PASSWORD',
    DELETE_ACCOUNT: 'DELETE_ACCOUNT',
    UPDATE_ACCOUNT: 'UPDATE_ACCOUNT',
    CREATE_TEAM: 'CREATE_TEAM',
    REMOVE_TEAM_MEMBER: 'REMOVE_TEAM_MEMBER',
    INVITE_TEAM_MEMBER: 'INVITE_TEAM_MEMBER',
    ACCEPT_INVITATION: 'ACCEPT_INVITATION',
};
