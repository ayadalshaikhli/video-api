// lib/db/queries.js
import { desc, and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./drizzle.js";
import { activityLogs, teamMembers, teams, userAudioGenerations, users, voices } from "./schema.js";
import { verifyToken } from "../auth/session.js";

/**
 * Extracts the user from the session cookie.
 * This version expects an Express request object, which must have been processed by cookie-parser.
 */
export async function getUser(req) {
  const sessionCookie = req.cookies.session; // Read the cookie from the request
  if (!sessionCookie) {
    return null;
  }

  let sessionData;
  try {
    sessionData = await verifyToken(sessionCookie);
  } catch (error) {
    console.error("Error verifying session token:", error);
    return null;
  }

  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== "number"
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

export async function getTeamByStripeCustomerId(customerId) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(teamId, subscriptionData) {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs(req) {
  const user = await getUser(req);
  if (!user) {
    throw new Error("User not authenticated");
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser(userId) {
  const result = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      teamMembers: {
        with: {
          team: {
            with: {
              teamMembers: {
                with: {
                  user: {
                    columns: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return result?.teamMembers[0]?.team || null;
}



export async function getVoicesForUser(userId) {
  // System voices
  const systemVoices = await db
    .select()
    .from(voices)
    .where(eq(voices.isSystem, true));

  // User voices
  const userVoices = await db
    .select()
    .from(voices)
    .where(eq(voices.createdBy, userId));

  return { systemVoices, userVoices };
}



export async function getUserAudiosCount(userId) {
  const result = await db
    .select({ count: sql`count(*)` })
    .from(userAudioGenerations)
    .where(eq(userAudioGenerations.userId, userId));
  
  return parseInt(result[0].count, 10);
}

export async function getUserAudios(userId, limit = 10, offset = 0) {
  const userAudios = await db
    .select()
    .from(userAudioGenerations)
    .where(eq(userAudioGenerations.userId, userId))
    .orderBy(desc(userAudioGenerations.createdAt)) // Add sorting by creation date descending
    .limit(limit)
    .offset(offset);
  return userAudios;
}