import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateImageFromPrompt } from '../actions/image-generation.js';
import { uploadImageFile } from '../actions/cloudflare.js';
import { db } from '../lib/db/drizzle.js';
import { blogPosts } from '../lib/db/schema.js';
import { desc, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import slugify from 'slugify';
import { consola } from 'consola';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Google Generative AI with your API key from env
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); // Using the flash model as requested

// Keep track of the current schedule
let currentSchedule = null;
let lastGeneratedPost = null;
let isGenerating = false;
const WEBSITE_URL = 'https://vairality.fun';

// Define topics relevant to vairality.fun
const TOPICS = [
    'AI video generation',
    'text-to-speech technology',
    'automated video captioning',
    'AI transcription tools',
    'music video AI generators',
    'AI voice cloning',
    'video content automation',
    'AI content creation tools',
    'audio to video conversion',
    'speech recognition advancements',
    'AI image to video conversion',
    'AI for content creators',
    'automated caption generation',
    'AI for video editing',
    'generative AI for videos'
];

/**
 * Calculate the next post date based on frequency
 */
function calculateNextPostDate(frequency = 3) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + Number(frequency));
    return nextDate;
}

/**
 * Schedules blog post generation at regular intervals
 */
export async function scheduleBlogAutomation(req, res) {
    try {
        const { frequency, authorId } = req.body;

        // Validate inputs
        if (!frequency || !authorId) {
            return res.status(400).json({ error: 'Frequency and authorId are required' });
        }

        // Stop existing schedule if there is one
        if (currentSchedule) {
            currentSchedule.stop();
        }

        // Determine cron pattern based on frequency (days)
        const cronPattern = frequency === 3 ? '0 10 */3 * *' : '0 10 */5 * *';

        // Schedule the job
        currentSchedule = cron.schedule(cronPattern, async () => {
            if (!isGenerating) {
                isGenerating = true;
                try {
                    await generateAndPublishBlogPost(authorId);
                    consola.success('Blog post generated and published successfully');
                } catch (error) {
                    consola.error('Error generating blog post:', error);
                } finally {
                    isGenerating = false;
                }
            }
        });

        // Start the schedule
        currentSchedule.start();

        return res.status(200).json({
            message: `Blog post generation scheduled every ${frequency} days`,
            nextPost: calculateNextPostDate(frequency)
        });
    } catch (error) {
        consola.error('Error scheduling blog automation:', error);
        return res.status(500).json({ error: 'Failed to schedule blog automation' });
    }
}

/**
 * Manually trigger blog post generation for testing
 */
export async function runManualBlogGeneration(req, res) {
    try {
        const { authorId } = req.body;

        if (!authorId) {
            return res.status(400).json({ error: 'authorId is required' });
        }

        if (isGenerating) {
            return res.status(409).json({ error: 'A blog post is already being generated' });
        }

        isGenerating = true;

        // Start generation in background
        res.status(202).json({ message: 'Blog post generation started' });

        try {
            const post = await generateAndPublishBlogPost(authorId);
            lastGeneratedPost = {
                id: post.id,
                title: post.title,
                slug: post.slug,
                publishedAt: post.publishedAt
            };
        } catch (error) {
            consola.error('Error generating blog post:', error);
        } finally {
            isGenerating = false;
        }
    } catch (error) {
        isGenerating = false;
        consola.error('Error triggering manual blog generation:', error);
        return res.status(500).json({ error: 'Failed to generate blog post' });
    }
}

/**
 * Get the current status of the blog generation system
 */
export async function getBlogGenerationStatus(req, res) {
    try {
        // Get the latest blog post using Drizzle
        const latestPosts = await db.select({
            id: blogPosts.id,
            title: blogPosts.title,
            slug: blogPosts.slug,
            publishedAt: blogPosts.publishedAt
        })
            .from(blogPosts)
            .orderBy(desc(blogPosts.publishedAt))
            .limit(1);

        const latestPost = latestPosts.length > 0 ? latestPosts[0] : null;

        return res.status(200).json({
            isScheduleActive: currentSchedule !== null,
            isGenerating,
            lastGeneratedPost: lastGeneratedPost || latestPost,
            nextScheduledGeneration: currentSchedule ? calculateNextPostDate() : null
        });
    } catch (error) {
        consola.error('Error getting blog generation status:', error);
        return res.status(500).json({ error: 'Failed to get blog generation status' });
    }
}

/**
 * Update schedule settings
 */
export async function updateScheduleSettings(req, res) {
    try {
        const { frequency, active } = req.body;

        if (active === false && currentSchedule) {
            currentSchedule.stop();
            currentSchedule = null;
            return res.status(200).json({ message: 'Blog automation schedule stopped' });
        }

        if (frequency && active !== false) {
            // Stop existing schedule if there is one
            if (currentSchedule) {
                currentSchedule.stop();
            }

            // Create new schedule
            const cronPattern = frequency === 3 ? '0 10 */3 * *' : '0 10 */5 * *';
            currentSchedule = cron.schedule(cronPattern, async () => {
                if (!isGenerating) {
                    isGenerating = true;
                    try {
                        await generateAndPublishBlogPost(req.body.authorId || 1);
                    } catch (error) {
                        consola.error('Error generating blog post:', error);
                    } finally {
                        isGenerating = false;
                    }
                }
            });

            currentSchedule.start();

            return res.status(200).json({
                message: `Blog post generation rescheduled every ${frequency} days`,
                nextPost: calculateNextPostDate(frequency)
            });
        }

        return res.status(400).json({ error: 'Invalid settings provided' });
    } catch (error) {
        consola.error('Error updating schedule settings:', error);
        return res.status(500).json({ error: 'Failed to update schedule settings' });
    }
}

/**
 * Core function to generate and publish a blog post
 */
async function generateAndPublishBlogPost(authorId) {
    try {
        consola.info('Starting blog post generation process');

        // Step 1: Get existing blog posts to reference for internal linking
        const existingPosts = await db.select({
            id: blogPosts.id,
            title: blogPosts.title,
            slug: blogPosts.slug
        })
            .from(blogPosts)
            .orderBy(desc(blogPosts.publishedAt))
            .limit(10);

        // Step 2: Select a random topic from our list
        const randomTopic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

        // Step 3: Generate the blog post content using Google Gemini
        const blogContent = await generateBlogContent(randomTopic, existingPosts);

        // Step 4: Generate and upload images
        const heroImagePrompt = `High quality professional image for a blog post about ${blogContent.title} related to ${randomTopic} and AI technology, clear, vibrant, professional looking`;
        const contentImagePrompt = `Illustrative image showing concept of ${randomTopic} in action, professional quality, clear visualization`;

        consola.info('Generating hero image');
        const heroImage = await generateAndUploadImage(heroImagePrompt);

        consola.info('Generating content image');
        const contentImage = await generateAndUploadImage(contentImagePrompt);

        // Insert the content image into the blog content
        const contentWithImage = insertImageIntoContent(blogContent.content, contentImage);

        // Step 5: Create a slug from the title
        const slug = slugify(blogContent.title, { lower: true, strict: true });

        // Step 6: Save to database using Drizzle
        consola.info('Saving blog post to database');
        const [newPost] = await db.insert(blogPosts).values({
            title: blogContent.title,
            slug: slug,
            excerpt: blogContent.excerpt,
            content: contentWithImage,
            metaTitle: blogContent.metaTitle,
            metaDescription: blogContent.metaDescription,
            authorId: authorId,
            publishedAt: new Date(),
            heroImageUrl: heroImage,
            ogImageUrl: heroImage,
            seoDescription: blogContent.seoDescription,
            seoKeywords: blogContent.keywords,
            canonicalUrl: `${WEBSITE_URL}/blog/${slug}`
        }).returning();

        consola.success('Blog post created:', newPost.title);
        return newPost;
    } catch (error) {
        consola.error('Error in blog post generation:', error);
        throw error;
    }
}

/**
 * Generate blog content using Google Gemini API
 */
async function generateBlogContent(topic, existingPosts) {
    try {
        // Prepare links to existing posts for internal linking
        const existingLinks = existingPosts.map(post => `- [${post.title}](${WEBSITE_URL}/blog/${post.slug})`).join('\n');

        const prompt = `
    You are a professional content writer for a website called Vairality (vairality.fun) that specializes in AI video generation, text-to-speech, caption, and transcription technologies.
    
    Please write a high-quality, SEO-optimized blog post about "${topic}" that would rank well in Google search.

    The blog post should:
    1. Have an engaging, SEO-optimized title (max 60 characters)
    2. Include a brief excerpt/introduction (2-3 sentences)
    3. Have 4-5 sections with proper H2 headings
    4. Include at least 2 internal links to our other blog posts (choose from the list below)
    5. Be written in a conversational, human-like style (not overly formal)
    6. Be approximately 1000-1500 words
    7. Include practical examples, use cases or actionable tips
    8. Reference current trends or recent developments in the field
    
    Existing blog posts you should link to:
    ${existingLinks || "No existing posts yet."}
    
    Please format your response in the following JSON structure:
    {
      "title": "The blog post title",
      "excerpt": "Brief excerpt for the blog",
      "content": "The full blog post content with HTML formatting, headings, and internal links",
      "metaTitle": "SEO title (max 60 chars)",
      "metaDescription": "SEO meta description (max 155 chars)",
      "seoDescription": "Longer SEO description for Google",
      "keywords": "comma, separated, keywords, for, seo"
    }
    
    Note: Write the content in HTML format with proper <h2>, <p>, <ul>, <li>, <a href="...">, etc. tags.
    `;

        // Generate content with Gemini
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from response
        const jsonStr = text.substring(
            text.indexOf('{'),
            text.lastIndexOf('}') + 1
        );

        const blogData = JSON.parse(jsonStr);
        return blogData;
    } catch (error) {
        consola.error('Error generating blog content with Gemini:', error);
        throw new Error('Failed to generate blog content');
    }
}

/**
 * Generate and upload an image based on a prompt
 */
/**
 * Generate and upload an image based on a prompt
 */
async function generateAndUploadImage(imagePrompt) {
    try {
        // Add negative prompt to prevent text generation in images
        const sdxlParams = {
            negative_prompt: "text, watermark, signature, words, letters, writing, label, caption, low quality, blurry"
        };

        // Generate image using the existing image generation function with text prevention
        const generatedImage = await generateImageFromPrompt(
            imagePrompt,
            "high quality, professional photograph, detailed, clean image", // Style prompt for better quality
            "flux-1-schnell", // Using default model
            sdxlParams // Pass the negative prompt
        );

        // Read the image file
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const imagePath = path.resolve(generatedImage.image);

        // Create file object from the generated image
        const imageFile = {
            buffer: fs.readFileSync(imagePath),
            originalname: path.basename(imagePath),
            mimetype: 'image/jpeg'
        };

        // Upload to Cloudflare R2
        const uploadResult = await uploadImageFile(imageFile);

        // Clean up the local file
        fs.unlinkSync(imagePath);

        return uploadResult.publicUrl;
    } catch (error) {
        consola.error('Error generating/uploading image:', error);
        // Handle errors gracefully by throwing them to the caller
        throw error;
    }
}

/**
 * Insert an image into the blog content at an appropriate location
 */
function insertImageIntoContent(content, imageUrl) {
    // Find a good position to insert the image (after the first or second h2 tag)
    const h2Positions = [];
    let pos = content.indexOf('<h2');
    while (pos !== -1) {
        h2Positions.push(pos);
        pos = content.indexOf('<h2', pos + 1);
    }

    // If we have at least 2 h2 tags, insert after the second one
    // Otherwise insert after the first paragraph
    let insertPosition;
    if (h2Positions.length >= 2) {
        // Find the end of the paragraph after second h2
        const h2EndPos = content.indexOf('</h2>', h2Positions[1]) + 5;
        const nextParagraphEnd = content.indexOf('</p>', h2EndPos) + 4;
        insertPosition = nextParagraphEnd;
    } else {
        // Insert after the first paragraph
        insertPosition = content.indexOf('</p>') + 4;
        // If no paragraph found, insert at 1/3 of the content
        if (insertPosition <= 4) {
            insertPosition = Math.floor(content.length / 3);
        }
    }

    // Create the image HTML
    const imageHtml = `
    <figure class="image-container">
      <img src="${imageUrl}" alt="Illustrative image for this article" class="content-image" />
    </figure>
    `;

    // Insert the image
    return content.substring(0, insertPosition) + imageHtml + content.substring(insertPosition);
}