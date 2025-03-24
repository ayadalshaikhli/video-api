// File: controllers/audioController.js
import { getUser, getUserAudios, getVoicesForUser } from "../../lib/db/queries.js";

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
      const limit = parseInt(req.query.limit, 10) || 10; // default to 10 items
      const offset = parseInt(req.query.offset, 10) || 0;  // default to 0
  
      // Query Drizzle via the service with pagination
      const audios = await getUserAudios(user.id, limit, offset);
  
      return res.json({ userAudios: audios });
    } catch (error) {
      console.error("[GET /api/audio/user-audios] error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }