// middleware/apiKeyAuth.js

import { getTotalCredits } from "../lib/db/data.js";


export const apiKeyAuth = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        return res.status(401).json({ error: "Authorization header is missing" });
    }
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
        return res.status(401).json({ error: "Invalid authorization format. Use 'Bearer <token>'" });
    }
    const apiKey = parts[1];
    const credits = await getTotalCredits(apiKey);
    if (!credits) {
        return res.status(401).json({ error: "Incorrect API key" });
    }
    req.apiKey = apiKey;
    next();
};
