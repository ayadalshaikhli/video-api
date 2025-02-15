
import { userAudioGenerations, voices } from "@/lib/db/schema";
import { getUser } from "@/lib/db/queries";
import { db } from "@/lib/db/drizzle";
import { eq } from "drizzle-orm";

export async function fetchVoices() {
    const user = await getUser();
    if (!user) {
        throw new Error("User not authenticated");
    }

    const systemVoices = await db
        .select()
        .from(voices)
        .where(eq(voices.isSystem, true));

    const userVoices = await db
        .select()
        .from(voices)
        .where(eq(voices.createdBy, user.id));

    return { systemVoices, userVoices };
}

export async function fetchUserAudios() {
    console.log('fetchUserAudios');
    const user = await getUser();
    if (!user) {
        throw new Error("User not authenticated");
    }

    const userAudios = await db
        .select()
        .from(userAudioGenerations)
        .where(eq(userAudioGenerations.userId, user.id));
    return userAudios;
}
