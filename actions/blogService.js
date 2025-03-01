
import { db } from "../lib/db/drizzle.js";
import { blogPosts } from "../lib/db/schema.js";

export async function createBlogPost(post) {
    try {
        const [insertedPost] = await db
            .insert(blogPosts)
            .values({
                title: post.title,
                slug: post.slug,
                excerpt: post.excerpt,
                content: post.content,
                metaTitle: post.metaTitle,
                metaDescription: post.metaDescription,
                canonicalUrl: post.canonicalUrl,
                authorId: post.authorId,
                publishedAt: post.publishedAt,
                heroImageUrl: post.heroImageUrl,
                ogImageUrl: post.ogImageUrl,
                seoDescription: post.seoDescription,
                seoKeywords: post.seoKeywords,
                createdAt: post.createdAt,
                updatedAt: post.updatedAt,
            })
            .returning();

        return insertedPost;
    } catch (error) {
        console.error("Error inserting blog post:", error);
        throw error;
    }
}
