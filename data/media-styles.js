import { db } from "../lib/db/drizzle.js";
import { captionStyles, videoStyles, voices } from "../lib/db/schema.js";
import { sql, desc, and, eq } from "drizzle-orm";

export const fetchAllVideoStyles = async (
  page = 1,
  limit = 10,
  q = "",
  sortField = "createdAt",
  sortOrder = "desc"
) => {
  const skip = (page - 1) * limit;
  const conditions = [];

  if (q && q.trim() !== "") {
    const searchTerm = `%${q.trim()}%`;
    conditions.push(sql`${videoStyles.name} ILIKE ${searchTerm}`);
  }
  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  let stylesQuery = db.select().from(videoStyles);
  if (whereCondition) {
    stylesQuery = stylesQuery.where(whereCondition);
  }

  const sortColumn = videoStyles[sortField] || videoStyles.createdAt;
  stylesQuery =
    sortOrder === "asc" ? stylesQuery.orderBy(sortColumn) : stylesQuery.orderBy(desc(sortColumn));

  stylesQuery = stylesQuery.limit(limit).offset(skip);
  const styles = await stylesQuery;
  const countResult = await db.select({ count: sql`count(*)` }).from(videoStyles).where(whereCondition);
  const totalStyles = Number(countResult[0].count);

  return {
    styles,
    totalStyles,
    totalPages: Math.ceil(totalStyles / limit),
    currentPage: page,
  };
};

export const fetchVideoStyleCounts = async () => {
  const activeResult = await db
    .select({ count: sql`count(*)` })
    .from(videoStyles)
    .where(sql`${videoStyles.isActive} = true`);
  const inactiveResult = await db
    .select({ count: sql`count(*)` })
    .from(videoStyles)
    .where(sql`${videoStyles.isActive} = false`);

  return {
    activeStyles: Number(activeResult[0].count),
    inactiveStyles: Number(inactiveResult[0].count),
  };
};

export const fetchActiveVideoStyles = async () => {
  const activeVideoStyles = await db
    .select({
      id: videoStyles.id,
      name: videoStyles.name,
      imageUrl: videoStyles.imageUrl,
      description: videoStyles.description,
    })
    .from(videoStyles)
    .where(eq(videoStyles.isActive, true));

  return activeVideoStyles;
};

export const fetchVideoStylesByIds = async (ids) => {
  const styles = await db
    .select()
    .from(videoStyles)
    .where(sql`${videoStyles.id} IN (${ids})`);

  return styles;
}

export const fetchAllCaptionStyles = async (
  page = 1,
  limit = 10,
  q = "",
  sortField = "createdAt",
  sortOrder = "desc"
) => {
  const skip = (page - 1) * limit;
  const conditions = [];

  if (q && q.trim() !== "") {
    const searchTerm = `%${q.trim()}%`;
    conditions.push(sql`${captionStyles.name} ILIKE ${searchTerm}`);
  }
  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  let stylesQuery = db.select().from(captionStyles);
  if (whereCondition) {
    stylesQuery = stylesQuery.where(whereCondition);
  }

  const sortColumn = captionStyles[sortField] || captionStyles.createdAt;
  stylesQuery =
    sortOrder === "asc"
      ? stylesQuery.orderBy(sortColumn)
      : stylesQuery.orderBy(desc(sortColumn));

  stylesQuery = stylesQuery.limit(limit).offset(skip);
  const styles = await stylesQuery;
  const countResult = await db
    .select({ count: sql`count(*)` })
    .from(captionStyles)
    .where(whereCondition);
  const totalStyles = Number(countResult[0].count);

  return {
    styles,
    totalStyles,
    totalPages: Math.ceil(totalStyles / limit),
    currentPage: page,
  };
};

export const fetchCaptionStyleCounts = async () => {
  const activeResult = await db
    .select({ count: sql`count(*)` })
    .from(captionStyles)
    .where(eq(captionStyles.isActive, true));
  const inactiveResult = await db
    .select({ count: sql`count(*)` })
    .from(captionStyles)
    .where(eq(captionStyles.isActive, false));

  return {
    activeStyles: Number(activeResult[0].count),
    inactiveStyles: Number(inactiveResult[0].count),
  };
};

export const fetchActiveCaptionStyles = async () => {
  const activeCaptionStyles = await db
    .select({
      id: captionStyles.id,
      name: captionStyles.name,
      fontFileName: captionStyles.fontFileName,
      description: captionStyles.description,
    })
    .from(captionStyles)
    .where(eq(captionStyles.isActive, true));

  return activeCaptionStyles;
};

export const fetchCaptionStylesByIds = async (ids) => {
  const styles = await db
    .select()
    .from(captionStyles)
    .where(sql`${captionStyles.id} IN (${ids})`);

  return styles;
};

export const fetchAllVoices = async (
  page = 1,
  limit = 10,
  q = "",
  sortField = "createdAt",
  sortOrder = "desc"
) => {
  const skip = (page - 1) * limit;
  const conditions = [];

  if (q && q.trim() !== "") {
    const searchTerm = `%${q.trim()}%`;
    conditions.push(sql`${voices.name} ILIKE ${searchTerm}`);
  }
  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  let voicesQuery = db.select().from(voices);
  if (whereCondition) {
    voicesQuery = voicesQuery.where(whereCondition);
  }

  const sortColumn = voices[sortField] || voices.createdAt;
  voicesQuery =
    sortOrder === "asc"
      ? voicesQuery.orderBy(sortColumn)
      : voicesQuery.orderBy(desc(sortColumn));

  voicesQuery = voicesQuery.limit(limit).offset(skip);
  const voices = await voicesQuery;
  const countResult = await db
    .select({ count: sql`count(*)` })
    .from(voices)
    .where(whereCondition);
  const totalVoices = Number(countResult[0].count);

  return {
    voices,
    totalVoices,
    totalPages: Math.ceil(totalVoices / limit),
    currentPage: page,
  };
};

export const fetchVoiceCounts = async () => {
  const activeResult = await db
    .select({ count: sql`count(*)` })
    .from(voices)
    .where(eq(voices.isActive, true));
  const inactiveResult = await db
    .select({ count: sql`count(*)` })
    .from(voices)
    .where(eq(voices.isActive, false));

  return {
    activeVoices: Number(activeResult[0].count),
    inactiveVoices: Number(inactiveResult[0].count),
  };
};

export const fetchActiveVoices = async () => {
  const activeVoices = await db
    .select({
      id: voices.id,
      name: voices.name,
      description: voices.description
    })
    .from(voices)
    .where(eq(voices.isActive, true));

  return activeVoices;
}

export const fetchVoicesByIds = async (ids) => {
  const result = await db
    .select()
    .from(voices)
    .where(sql`${voices.id} IN (${ids})`);
  return result;
};


