import {
    pgTable,
    serial,
    varchar,
    text,
    timestamp,
    numeric,
    integer,
    jsonb,
    boolean,
    json,
    uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    name: varchar('name', { length: 100 }),
    email: varchar('email', { length: 255 }).unique(),

    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 20 }).default('member'),
    solanaWalletAddress: varchar('solana_wallet_address', { length: 44 }).unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId: text('stripe_subscription_id').unique(),
    stripeProductId: text('stripe_product_id'),
    planName: varchar('plan_name', { length: 50 }),
    subscriptionStatus: varchar('subscription_status', { length: 20 }),
    solanaWalletAddress: varchar('solana_wallet_address', { length: 44 }),
    lastPaymentType: varchar('last_payment_type', { length: 20 }), // 'stripe' or 'solana'
});

export const teamMembers = pgTable('team_members', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    teamId: uuid('team_id')
        .notNull()
        .references(() => teams.id),
    role: varchar('role', { length: 50 }).notNull(),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
        .notNull()
        .references(() => teams.id),
    userId: uuid('user_id').references(() => users.id),
    action: text('action').notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
        .notNull()
        .references(() => teams.id),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    invitedBy: uuid('invited_by')
        .notNull()
        .references(() => users.id),
    invitedAt: timestamp('invited_at').notNull().defaultNow(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const newsArticles = pgTable('news_articles', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 255 }).notNull(),
    url: text('url').notNull().unique(),
    source: varchar('source', { length: 100 }).notNull(),
    content: text('content').notNull(),
    publishedAt: timestamp('published_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const blogAuthors = pgTable('blog_authors', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    bio: text('bio'),
    profileImageUrl: varchar('profile_image_url', { length: 500 }),
    twitterHandle: varchar('twitter_handle', { length: 50 }),
    linkedinUrl: varchar('linkedin_url', { length: 500 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const blogPosts = pgTable('blog_posts', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    excerpt: text('excerpt'),
    content: text('content').notNull(),
    metaTitle: varchar('meta_title', { length: 70 }),
    metaDescription: varchar('meta_description', { length: 160 }),
    canonicalUrl: varchar('canonical_url', { length: 500 }),
    authorId: uuid('author_id')
        .notNull()
        .references(() => blogAuthors.id),
    publishedAt: timestamp('published_at'),
    heroImageUrl: varchar('hero_image_url', { length: 500 }),
    ogImageUrl: varchar('og_image_url', { length: 500 }),
    seoDescription: text('seo_description').default(''),
    seoKeywords: text('seo_keywords').default(''),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const videos = pgTable('videos', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    videoUrl: text('video_url').notNull(),
    prompt: text('prompt').notNull(),
    keywords: jsonb('keywords').default('[]'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    costSol: numeric('cost_sol', { precision: 20, scale: 9 }).notNull(),

    // Metadata
    resolutionId: varchar('resolution_id', { length: 50 }),
    projectStatusId: varchar('project_status_id', { length: 50 }),
    animationModeId: varchar('animation_mode_id', { length: 50 }),
    genreId: varchar('genre_id', { length: 50 }),
    width: integer('width').notNull().default(1920),
    height: integer('height').notNull().default(1080),
    framesPerSecond: integer('frames_per_second').notNull().default(30),
    smoothness: integer('smoothness'),
    intensity: integer('intensity'),
    positiveKeywords: jsonb('positive_keywords').default('[]'),
    negativeKeywords: jsonb('negative_keywords').default('[]'),
    translation: jsonb('translation').default('[]'),
    rotation: jsonb('rotation').default('[]'),
    dynamicCamera: boolean('dynamic_camera').default(false),
    oscillation: boolean('oscillation'),
    condPrompt: text('cond_prompt'),
    uncondPrompt: text('uncond_prompt'),
    status: varchar('status', { length: 20 }).notNull().default('Draft'),
    minutes: numeric('minutes', { precision: 10, scale: 2 }).default(0.04),

    // Audio
    audioTempFileId: varchar('audio_temp_file_id', { length: 100 }),
    audioFilename: varchar('audio_filename', { length: 255 }),
    audioUrl: text('audio_url'),
    audioSynchronizationId: varchar('audio_synchronization_id', { length: 50 }),

    isSubmitted: boolean('is_submitted').default(false),
    completedPercentage: integer('completed_percentage').notNull().default(0),
});

// Video Projects Table
export const videoProjects = pgTable('video_projects', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    projectId: varchar('project_id', { length: 50 }).unique(),
    awsId: varchar('aws_id', { length: 50 }).unique(),
    projectName: varchar('project_name', { length: 255 }).notNull(),
    url: text('url').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    status: varchar('status', { length: 20 }).notNull().default('Draft'),
});

// User Credits Table
export const userCredits = pgTable('user_credits', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    totalCredits: numeric('total_credits', { precision: 20, scale: 2 }).notNull().default(0),
    usedCredits: numeric('used_credits', { precision: 20, scale: 2 }).notNull().default(0),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Credit Usage Table
export const creditUsage = pgTable('credit_usage', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    projectId: varchar('project_id', { length: 50 })
        .notNull()
        .references(() => videoProjects.projectId),
    creditsSpent: numeric('credits_spent', { precision: 20, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Credit Transactions Table
export const creditTransactions = pgTable('credit_transactions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    solAmount: numeric('sol_amount', { precision: 20, scale: 9 }).notNull(),
    creditsPurchased: numeric('credits_purchased', { precision: 20, scale: 2 }).notNull(),
    pricePerCredit: numeric('price_per_credit', { precision: 20, scale: 9 }).notNull(),
    transactionHash: text('transaction_hash').notNull().unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const imageGenerations = pgTable('image_generations', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    prompt: text('prompt').notNull(),
    model: varchar('model', { length: 50 }).notNull(),
    imageUrl: text('image_url'),
    generationDuration: integer('generation_duration'),
    costCredits: numeric('cost_credits', { precision: 20, scale: 2 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('completed'),
    generationParameters: jsonb('generation_parameters').default('{}'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const imageCreditUsage = pgTable('image_credit_usage', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    imageGenerationId: uuid('image_generation_id')
        .notNull()
        .references(() => imageGenerations.id),
    creditsSpent: numeric('credits_spent', { precision: 20, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const voices = pgTable('voices', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    voiceUrl: text('voice_url').notNull(),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id),
    isSystem: boolean('is_system').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const userAudioGenerations = pgTable('user_audio_generations', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    voiceId: uuid('voice_id').references(() => voices.id),
    prompt: text('prompt'),
    audioUrl: text('audio_url').notNull(),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const currentCredits = pgTable('current_credits', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 50 }).notNull(),
    apiKey: varchar('api_key', { length: 50 }).notNull(),
    totalCredits: numeric('total_credits', { precision: 20, scale: 2 })
});

export const captionStyles = pgTable('caption_styles', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 50 }).notNull().unique(),
    description: text('description'),
    fontFileName: text('font_file_name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    isAdminOnly: boolean('is_admin_only').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Video Styles Table
export const videoStyles = pgTable("video_styles", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 50 }).notNull().unique(),
    imageUrl: text("image_url"),
    description: text("description"),
    prompts: jsonb("prompts").default("[]"),
    sdxlParams: jsonb("sdxl_params").default("{}"),
    isActive: boolean("is_active").notNull().default(true),
    isAdminOnly: boolean("is_admin_only").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Short Videos Table
export const shortVideos = pgTable('short_videos', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    projectTitle: text('project_title').notNull(),
    videoTopic: text('video_topic').notNull(),
    generatedScript: text('generated_script').notNull(),
    // Updated to reference the new column:
    videoStyleId: uuid('video_style_id').references(() => videoStyles.id),
    voiceId: uuid('voice_id').notNull().references(() => voices.id),
    captionStyleId: uuid('caption_style_id').references(() => captionStyles.id),
    videoUrl: text('video_url'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Video Composition System Tables
export const compositions = pgTable('compositions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id),
    script: text('script').notNull(),
    voice: varchar('voice', { length: 100 }).notNull(),
    musicUrl: text('music_url'),
    aspect: varchar('aspect', { length: 10 }).notNull().default('9:16'), // '9:16' | '16:9' | '1:1'
    status: varchar('status', { length: 20 }).notNull().default('draft'), // 'draft' | 'rendering' | 'completed' | 'failed'
    finalVideoUrl: text('final_video_url'),
    audioDuration: numeric('audio_duration', { precision: 10, scale: 3 }), // audio duration in seconds
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const segments = pgTable('segments', {
    id: uuid('id').primaryKey().defaultRandom(),
    compositionId: uuid('composition_id')
        .notNull()
        .references(() => compositions.id),
    text: text('text').notNull(),
    start: numeric('start', { precision: 10, scale: 3 }).notNull(), // seconds
    end: numeric('end', { precision: 10, scale: 3 }).notNull(), // seconds
    mediaUrl: text('media_url').notNull(), // image or video URL
    animation: varchar('animation', { length: 50 }).notNull().default('fade'), // 'fade', 'pop', 'slide', 'zoom'
    style: jsonb('style').notNull().default('{"fontFamily": "Arial", "fontSize": 24, "color": "#ffffff", "background": "transparent"}'),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const captions = pgTable('captions', {
    id: uuid('id').primaryKey().defaultRandom(),
    compositionId: uuid('composition_id')
        .notNull()
        .references(() => compositions.id),
    segmentId: varchar('segment_id', { length: 255 }), // For associating captions with specific segments
    text: text('text').notNull(),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    timestampMs: integer('timestamp_ms'),
    confidence: numeric('confidence', { precision: 5, scale: 2 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Social Media Integration Tables
export const socialChannels = pgTable('social_channels', {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id').notNull().references(() => teams.id),
    platform: varchar('platform', { length: 20 }).notNull(), // 'youtube' | 'tiktok' | 'instagram' | 'facebook'
    channelName: varchar('channel_name', { length: 255 }),
    channelId: varchar('channel_id', { length: 255 }),
    channelUrl: text('channel_url'),
    profileImageUrl: text('profile_image_url'),
    isActive: boolean('is_active').notNull().default(true),
    connectedAt: timestamp('connected_at').notNull().defaultNow(),
    lastSyncAt: timestamp('last_sync_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const socialChannelTokens = pgTable('social_channel_tokens', {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id').notNull().references(() => socialChannels.id),
    accessToken: text('access_token').notNull(), // store encrypted
    refreshToken: text('refresh_token'), // store encrypted
    tokenExpiresAt: timestamp('token_expires_at'),
    scopes: jsonb('scopes').default('[]'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const socialPosts = pgTable('social_posts', {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id').notNull().references(() => socialChannels.id),
    content: text('content'),
    mediaUrls: jsonb('media_urls').default('[]'),
    scheduledFor: timestamp('scheduled_for'),
    status: varchar('status', { length: 20 }).notNull().default('draft'), // 'draft' | 'scheduled' | 'published' | 'failed'
    platformPostId: varchar('platform_post_id', { length: 255 }),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const socialChannelAnalytics = pgTable('social_channel_analytics', {
    id: uuid('id').primaryKey().defaultRandom(),
    channelId: uuid('channel_id').notNull().references(() => socialChannels.id),
    postId: uuid('post_id').references(() => socialPosts.id),
    metrics: jsonb('metrics').default('{}'), // e.g., { views, likes, comments, shares }
    date: timestamp('date').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
    teamMembers: many(teamMembers),
    activityLogs: many(activityLogs),
    invitations: many(invitations),
    socialChannels: many(socialChannels),
}));

export const usersRelations = relations(users, ({ many }) => ({
    teamMembers: many(teamMembers),
    invitationsSent: many(invitations),
    videos: many(videos),
    videoProjects: many(videoProjects),
    userCredits: many(userCredits),
    creditUsage: many(creditUsage),
    creditTransactions: many(creditTransactions),
    imageGenerations: many(imageGenerations),
    imageCreditUsage: many(imageCreditUsage),
    userAudioGenerations: many(userAudioGenerations),
    shortVideos: many(shortVideos),
    compositions: many(compositions),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
    team: one(teams, {
        fields: [invitations.teamId],
        references: [teams.id],
    }),
    invitedBy: one(users, {
        fields: [invitations.invitedBy],
        references: [users.id],
    }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
    user: one(users, {
        fields: [teamMembers.userId],
        references: [users.id],
    }),
    team: one(teams, {
        fields: [teamMembers.teamId],
        references: [teams.id],
    }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
    team: one(teams, {
        fields: [activityLogs.teamId],
        references: [teams.id],
    }),
    user: one(users, {
        fields: [activityLogs.userId],
        references: [users.id],
    }),
}));

export const blogAuthorsRelations = relations(blogAuthors, ({ many }) => ({
    blogPosts: many(blogPosts),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
    author: one(blogAuthors, {
        fields: [blogPosts.authorId],
        references: [blogAuthors.id],
    }),
}));

export const videosRelations = relations(videos, ({ one }) => ({
    user: one(users, {
        fields: [videos.userId],
        references: [users.id],
    }),
}));

export const videoProjectsRelations = relations(videoProjects, ({ one, many }) => ({
    user: one(users, {
        fields: [videoProjects.userId],
        references: [users.id],
    }),
    creditUsage: many(creditUsage),
}));

export const userCreditsRelations = relations(userCredits, ({ one }) => ({
    user: one(users, {
        fields: [userCredits.userId],
        references: [users.id],
    }),
}));

export const creditUsageRelations = relations(creditUsage, ({ one }) => ({
    user: one(users, {
        fields: [creditUsage.userId],
        references: [users.id],
    }),
    project: one(videoProjects, {
        fields: [creditUsage.projectId],
        references: [videoProjects.projectId],
    }),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
    user: one(users, {
        fields: [creditTransactions.userId],
        references: [users.id],
    }),
}));

export const imageGenerationsRelations = relations(imageGenerations, ({ one }) => ({
    user: one(users, {
        fields: [imageGenerations.userId],
        references: [users.id],
    }),
}));

export const imageCreditUsageRelations = relations(imageCreditUsage, ({ one }) => ({
    user: one(users, {
        fields: [imageCreditUsage.userId],
        references: [users.id],
    }),
    imageGeneration: one(imageGenerations, {
        fields: [imageCreditUsage.imageGenerationId],
        references: [imageGenerations.id],
    }),
}));

export const voicesRelations = relations(voices, ({ many, one }) => ({
    userAudioGenerations: many(userAudioGenerations),
    shortVideos: many(shortVideos),
    createdBy: one(users, {
        fields: [voices.createdBy],
        references: [users.id],
    }),
}));

export const userAudioGenerationsRelations = relations(userAudioGenerations, ({ one }) => ({
    user: one(users, {
        fields: [userAudioGenerations.userId],
        references: [users.id],
    }),
    voice: one(voices, {
        fields: [userAudioGenerations.voiceId],
        references: [voices.id],
    }),
}));

export const shortVideosRelations = relations(shortVideos, ({ one }) => ({
    user: one(users, {
        fields: [shortVideos.userId],
        references: [users.id],
    }),
    videoStyle: one(videoStyles, {
        fields: [shortVideos.videoStyleId],
        references: [videoStyles.id],
    }),
    voice: one(voices, {
        fields: [shortVideos.voiceId],
        references: [voices.id],
    }),
    captionStyle: one(captionStyles, {
        fields: [shortVideos.captionStyleId],
        references: [captionStyles.id],
    }),
}));

// Video Composition Relations
export const compositionsRelations = relations(compositions, ({ one, many }) => ({
    user: one(users, {
        fields: [compositions.userId],
        references: [users.id],
    }),
    segments: many(segments),
    captions: many(captions),
}));

export const segmentsRelations = relations(segments, ({ one }) => ({
    composition: one(compositions, {
        fields: [segments.compositionId],
        references: [compositions.id],
    }),
}));

export const captionsRelations = relations(captions, ({ one }) => ({
    composition: one(compositions, {
        fields: [captions.compositionId],
        references: [compositions.id],
    }),
}));

export const socialChannelsRelations = relations(socialChannels, ({ one, many }) => ({
    team: one(teams, {
        fields: [socialChannels.teamId],
        references: [teams.id],
    }),
    tokens: many(socialChannelTokens),
    posts: many(socialPosts),
    analytics: many(socialChannelAnalytics),
}));

export const socialChannelTokensRelations = relations(socialChannelTokens, ({ one }) => ({
    channel: one(socialChannels, {
        fields: [socialChannelTokens.channelId],
        references: [socialChannels.id],
    }),
}));

export const socialPostsRelations = relations(socialPosts, ({ one, many }) => ({
    channel: one(socialChannels, {
        fields: [socialPosts.channelId],
        references: [socialChannels.id],
    }),
    analytics: many(socialChannelAnalytics),
}));

export const socialChannelAnalyticsRelations = relations(socialChannelAnalytics, ({ one }) => ({
    channel: one(socialChannels, {
        fields: [socialChannelAnalytics.channelId],
        references: [socialChannels.id],
    }),
    post: one(socialPosts, {
        fields: [socialChannelAnalytics.postId],
        references: [socialPosts.id],
    }),
}));

export const ActivityType = {
    // Authentication & Account Management
    SIGN_UP: 'SIGN_UP',
    SIGN_IN: 'SIGN_IN',
    SIGN_OUT: 'SIGN_OUT',
    UPDATE_PASSWORD: 'UPDATE_PASSWORD',
    DELETE_ACCOUNT: 'DELETE_ACCOUNT',
    UPDATE_ACCOUNT: 'UPDATE_ACCOUNT',
    
    // Team Management
    CREATE_TEAM: 'CREATE_TEAM',
    UPDATE_TEAM: 'UPDATE_TEAM',
    DELETE_TEAM: 'DELETE_TEAM',
    INVITE_TEAM_MEMBER: 'INVITE_TEAM_MEMBER',
    ACCEPT_INVITATION: 'ACCEPT_INVITATION',
    DECLINE_INVITATION: 'DECLINE_INVITATION',
    REMOVE_TEAM_MEMBER: 'REMOVE_TEAM_MEMBER',
    LEAVE_TEAM: 'LEAVE_TEAM',
    UPDATE_TEAM_MEMBER_ROLE: 'UPDATE_TEAM_MEMBER_ROLE',
    
    // Video Management
    CREATE_VIDEO: 'CREATE_VIDEO',
    UPDATE_VIDEO: 'UPDATE_VIDEO',
    DELETE_VIDEO: 'DELETE_VIDEO',
    SUBMIT_VIDEO: 'SUBMIT_VIDEO',
    COMPLETE_VIDEO: 'COMPLETE_VIDEO',
    FAIL_VIDEO: 'FAIL_VIDEO',
    
    // Video Projects
    CREATE_VIDEO_PROJECT: 'CREATE_VIDEO_PROJECT',
    UPDATE_VIDEO_PROJECT: 'UPDATE_VIDEO_PROJECT',
    DELETE_VIDEO_PROJECT: 'DELETE_VIDEO_PROJECT',
    
    // Short Videos
    CREATE_SHORT_VIDEO: 'CREATE_SHORT_VIDEO',
    UPDATE_SHORT_VIDEO: 'UPDATE_SHORT_VIDEO',
    DELETE_SHORT_VIDEO: 'DELETE_SHORT_VIDEO',
    
    // Video Compositions
    CREATE_COMPOSITION: 'CREATE_COMPOSITION',
    UPDATE_COMPOSITION: 'UPDATE_COMPOSITION',
    DELETE_COMPOSITION: 'DELETE_COMPOSITION',
    RENDER_COMPOSITION: 'RENDER_COMPOSITION',
    COMPLETE_COMPOSITION: 'COMPLETE_COMPOSITION',
    FAIL_COMPOSITION: 'FAIL_COMPOSITION',
    
    // Segments & Captions
    ADD_SEGMENT: 'ADD_SEGMENT',
    UPDATE_SEGMENT: 'UPDATE_SEGMENT',
    DELETE_SEGMENT: 'DELETE_SEGMENT',
    ADD_CAPTION: 'ADD_CAPTION',
    UPDATE_CAPTION: 'UPDATE_CAPTION',
    DELETE_CAPTION: 'DELETE_CAPTION',
    
    // Image Generation
    GENERATE_IMAGE: 'GENERATE_IMAGE',
    DELETE_IMAGE: 'DELETE_IMAGE',
    
    // Audio Generation
    GENERATE_AUDIO: 'GENERATE_AUDIO',
    DELETE_AUDIO: 'DELETE_AUDIO',
    
    // Voice Management
    CREATE_VOICE: 'CREATE_VOICE',
    UPDATE_VOICE: 'UPDATE_VOICE',
    DELETE_VOICE: 'DELETE_VOICE',
    
    // Credit Management
    PURCHASE_CREDITS: 'PURCHASE_CREDITS',
    USE_CREDITS: 'USE_CREDITS',
    REFUND_CREDITS: 'REFUND_CREDITS',
    
    // Blog Management
    CREATE_BLOG_POST: 'CREATE_BLOG_POST',
    UPDATE_BLOG_POST: 'UPDATE_BLOG_POST',
    DELETE_BLOG_POST: 'DELETE_BLOG_POST',
    PUBLISH_BLOG_POST: 'PUBLISH_BLOG_POST',
    UNPUBLISH_BLOG_POST: 'UNPUBLISH_BLOG_POST',
    
    // Blog Authors
    CREATE_BLOG_AUTHOR: 'CREATE_BLOG_AUTHOR',
    UPDATE_BLOG_AUTHOR: 'UPDATE_BLOG_AUTHOR',
    DELETE_BLOG_AUTHOR: 'DELETE_BLOG_AUTHOR',
    
    // News Articles
    CREATE_NEWS_ARTICLE: 'CREATE_NEWS_ARTICLE',
    UPDATE_NEWS_ARTICLE: 'UPDATE_NEWS_ARTICLE',
    DELETE_NEWS_ARTICLE: 'DELETE_NEWS_ARTICLE',
    
    // Styles Management
    CREATE_CAPTION_STYLE: 'CREATE_CAPTION_STYLE',
    UPDATE_CAPTION_STYLE: 'UPDATE_CAPTION_STYLE',
    DELETE_CAPTION_STYLE: 'DELETE_CAPTION_STYLE',
    CREATE_VIDEO_STYLE: 'CREATE_VIDEO_STYLE',
    UPDATE_VIDEO_STYLE: 'UPDATE_VIDEO_STYLE',
    DELETE_VIDEO_STYLE: 'DELETE_VIDEO_STYLE',
    
    // API & System
    API_REQUEST: 'API_REQUEST',
    API_ERROR: 'API_ERROR',
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    DATA_EXPORT: 'DATA_EXPORT',
    DATA_IMPORT: 'DATA_IMPORT',
    
    // Security
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
    PASSWORD_RESET: 'PASSWORD_RESET',
    EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
    TWO_FACTOR_ENABLED: 'TWO_FACTOR_ENABLED',
    TWO_FACTOR_DISABLED: 'TWO_FACTOR_DISABLED',
    
    // File Management
    UPLOAD_FILE: 'UPLOAD_FILE',
    DELETE_FILE: 'DELETE_FILE',
    DOWNLOAD_FILE: 'DOWNLOAD_FILE',
    
    // Settings & Preferences
    UPDATE_SETTINGS: 'UPDATE_SETTINGS',
    UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
    UPDATE_NOTIFICATION_SETTINGS: 'UPDATE_NOTIFICATION_SETTINGS',
};
