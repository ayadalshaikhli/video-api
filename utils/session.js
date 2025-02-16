import { verifyToken } from "../lib/auth/session.js"; // Assuming you have this function for token verification

export async function getUserFromSession(req) {
    console.log("[getUserFromSession] Extracting user from session...");

    // Extract session cookie
    const sessionCookie = req.cookies.session; // Assuming session is stored in cookies

    if (!sessionCookie) {
        console.error("[getUserFromSession] No session cookie provided.");
        throw new Error("Not authenticated (no session cookie)");
    }

    let payload;
    try {
        // Verify the token using the session cookie
        payload = await verifyToken(sessionCookie);
        console.log("[getUserFromSession] Token verified. Payload:", payload);
    } catch (err) {
        console.error("[getUserFromSession] Token verification failed:", err);
        throw new Error("Invalid session token");
    }

    // Extract the user details from the payload
    const user = payload?.user;

    if (!user || !user.id) {
        console.error("[getUserFromSession] Invalid session payload. User data:", user);
        throw new Error("Invalid session payload");
    }

    console.log("[getUserFromSession] User extracted:", user);
    return user;
}
