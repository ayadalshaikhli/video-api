import { getUser, getUserAudios, getUserAudiosCount, getVoicesForUser } from "../../lib/db/queries.js";

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


export async function fetchUserAudios(req, res) {

  try {
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const page = parseInt(req.query.page, 10) || 1; 
    const limit = parseInt(req.query.limit, 10) || 10; 
    const offset = (page - 1) * limit;

    const count = await getUserAudiosCount(user.id);
    const totalPages = Math.ceil(count / limit);
    
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