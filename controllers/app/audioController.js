import { getUser, getUserAudios, getUserAudiosCount, getVoicesForUser } from "../../lib/db/queries.js";

/**
 * GET /api/audio/voices
 * - Authenticates user from session cookie
 * - Calls service to fetch system voices & user voices
 */
export async function fetchVoices(req, res) {
  try {
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Query Drizzle via the service
    const data = await getVoicesForUser(user.id);

    // { systemVoices, userVoices }
    return res.json(data);
  } catch (error) {
    console.error("[GET /api/audio/voices] error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * GET /api/audio/user-audios
 * - Authenticates user from session cookie
 * - Calls service to fetch user audio generation records
 */
export async function fetchUserAudios(req, res) {
  try {
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Parse pagination parameters from the query string
    const page = parseInt(req.query.page, 10) || 1; // default to page 1
    const limit = parseInt(req.query.limit, 10) || 10; // default to 10 items
    const offset = (page - 1) * limit;

    // Get total count for pagination
    const count = await getUserAudiosCount(user.id);
    
    // Calculate total pages
    const totalPages = Math.ceil(count / limit);
    
    // Query Drizzle via the service with pagination
    const userAudios = await getUserAudios(user.id, limit, offset);

    return res.json({ 
      count,
      totalPages,
      userAudios,
      currentPage: page
    });
  } catch (error) {
    console.error("[GET /api/audio/user-audios] error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}