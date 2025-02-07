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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
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
    id: serial('id').primaryKey(),
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
    id: serial('id').primaryKey(),
    userId: integer('user_id')
        .notNull()
        .references(() => users.id),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id),
    role: varchar('role', { length: 50 }).notNull(),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id),
    userId: integer('user_id').references(() => users.id),
    action: text('action').notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    invitedBy: integer('invited_by')
        .notNull()
        .references(() => users.id),
    invitedAt: timestamp('invited_at').notNull().defaultNow(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
});

export const newsArticles = pgTable('news_articles', {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    url: text('url').notNull().unique(),
    source: varchar('source', { length: 100 }).notNull(),
    content: text('content').notNull(),
    publishedAt: timestamp('published_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const coins = pgTable('coins', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    symbol: varchar('symbol', { length: 20 }).notNull(),
    description: text('description'),
    contractAddress: varchar('contract_address', { length: 100 }).notNull(),
    blockchain: varchar('blockchain', { length: 50 }).notNull().default('solana'),
    marketCap: numeric('market_cap', { precision: 20, scale: 2 }),
    price: numeric('price', { precision: 20, scale: 10 }),
    liquidity: numeric('liquidity', { precision: 20, scale: 2 }),
    pairAddress: varchar('pair_address', { length: 100 }),
    dexId: varchar('dex_id', { length: 50 }),
    twitter: varchar('twitter', { length: 255 }),
    telegram: varchar('telegram', { length: 255 }),
    website: varchar('website', { length: 255 }),
    discord: varchar('discord', { length: 255 }),
    totalSupply: numeric('total_supply', { precision: 30, scale: 0 }),
    circulatingSupply: numeric('circulating_supply', { precision: 30, scale: 0 }),
    launchDate: timestamp('launch_date'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const pumpFun = pgTable('pump_fun', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    symbol: varchar('symbol', { length: 20 }).notNull(),
    uri: varchar('uri', { length: 255 }).notNull(),
    updateAuthorityAddress: varchar('update_authority_address', { length: 100 }).notNull(),
    creators: jsonb('creators').default('[]'), // JSON array for creator details
    collection: jsonb('collection'), // JSON for optional collection details
    uses: jsonb('uses'), // JSON for optional uses
    address: varchar('address', { length: 100 }).notNull(),
    // Mint details
    mintModel: varchar('mint_model', { length: 50 }).notNull().default('mint'),
    mintAddress: varchar('mint_address', { length: 100 }).notNull().unique(),
    mintAuthorityAddress: varchar('mint_authority_address', { length: 100 }),
    freezeAuthorityAddress: varchar('freeze_authority_address', { length: 100 }),
    decimals: integer('decimals').notNull().default(6),
    supplyBasisPoints: numeric('supply_basis_points', { precision: 30, scale: 0 }).notNull(),
    isWrappedSol: boolean('is_wrapped_sol').notNull().default(false),
    currencySymbol: varchar('currency_symbol', { length: 20 }).notNull(),
    currencyDecimals: integer('currency_decimals').notNull().default(6),
    currencyNamespace: varchar('currency_namespace', { length: 50 }).notNull().default('spl-token'),
    // Blockchain info
    blockchain: varchar('blockchain', { length: 50 }).notNull().default('solana'),
    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const solanaPriceHistory = pgTable('solana_price_history', {
    id: serial('id').primaryKey(),
    date: timestamp('date').notNull(),
    price: numeric('price', { precision: 20, scale: 10 }).notNull(),
    openPrice: numeric('open_price', { precision: 20, scale: 10 }).notNull(),
    highPrice: numeric('high_price', { precision: 20, scale: 10 }).notNull(),
    lowPrice: numeric('low_price', { precision: 20, scale: 10 }).notNull(),
    volume: numeric('volume', { precision: 20, scale: 2 }),
    changePercentage: numeric('change_percentage', { precision: 5, scale: 2 }),
});

export const coinRatings = pgTable('coin_ratings', {
    id: serial('id').primaryKey(),
    coinId: integer('coin_id')
        .notNull()
        .references(() => coins.id),
    mentionCount: integer('mention_count').notNull().default(0),
    sentimentScore: numeric('sentiment_score', { precision: 5, scale: 2 }).notNull().default(0.0),
    rating: integer('rating').notNull(),
    calculatedAt: timestamp('calculated_at').notNull().defaultNow(),
});

export const coinSources = pgTable('coin_sources', {
    id: serial('id').primaryKey(),
    coinId: integer('coin_id')
        .notNull()
        .references(() => coins.id),
    sourceName: varchar('source_name', { length: 50 }).notNull(),
    sourceId: varchar('source_id', { length: 100 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const mentions = pgTable('mentions', {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }),
    url: text('url').notNull().unique(),
    source: varchar('source', { length: 100 }),
    content: text('content'),
    author: varchar('author', { length: 100 }),
    publishedAt: timestamp('published_at'),
    sentimentScore: numeric('sentiment_score', { precision: 5, scale: 2 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const coinMentions = pgTable('coin_mentions', {
    id: serial('id').primaryKey(),
    coinId: integer('coin_id')
        .notNull()
        .references(() => coins.id),
    mentionId: integer('mention_id')
        .notNull()
        .references(() => mentions.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const coinPrices = pgTable('coin_prices', {
    id: serial('id').primaryKey(),
    coinId: integer('coin_id')
        .notNull()
        .references(() => coins.id),
    price: numeric('price', { precision: 20, scale: 10 }).notNull(),
    volume: numeric('volume', { precision: 20, scale: 2 }),
    liquidity: numeric('liquidity', { precision: 20, scale: 2 }),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
});

export const coinHolders = pgTable('coin_holders', {
    id: serial('id').primaryKey(),
    coinId: integer('coin_id')
        .notNull()
        .references(() => coins.id),
    address: varchar('address', { length: 100 }).notNull(),
    balance: numeric('balance', { precision: 30, scale: 0 }).notNull(),
    percentage: numeric('percentage', { precision: 5, scale: 2 }),
    lastUpdated: timestamp('last_updated').notNull().defaultNow(),
});

export const tokenBoosts = pgTable('token_boosts', {
    id: serial('id').primaryKey(),
    tokenAddress: varchar('token_address', { length: 100 }).notNull(),
    pairAddress: varchar('pair_address', { length: 100 }),
    chainId: varchar('chain_id', { length: 50 }).notNull(),
    cumulativeAmount: numeric('cumulative_amount', { precision: 20, scale: 10 }).notNull().default(0),
    totalBoosts: integer('total_boosts').notNull().default(0),
    icon: varchar('icon', { length: 255 }),
    header: varchar('header', { length: 255 }),
    description: text('description'),
    links: jsonb('links'),
    tokenCreatedAt: timestamp('token_created_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const boostEvents = pgTable('boost_events', {
    id: serial('id').primaryKey(),
    tokenBoostId: integer('token_boost_id')
        .references(() => tokenBoosts.id),
    amount: numeric('amount', { precision: 20, scale: 10 }).notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    boostIdentifier: text('boost_identifier').notNull(),
});

export const tokenProfiles = pgTable('token_profiles', {
    id: serial('id').primaryKey(),
    tokenAddress: varchar('token_address', { length: 100 }).notNull().unique(),
    chainId: varchar('chain_id', { length: 50 }).notNull(),
    icon: varchar('icon', { length: 255 }),
    description: text('description'),
    links: jsonb('links'), // JSON array for social links
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const tokenOrders = pgTable('token_orders', {
    id: serial('id').primaryKey(),
    tokenAddress: varchar('token_address', { length: 100 }).notNull(),
    chainId: varchar('chain_id', { length: 50 }).notNull(),
    type: varchar('type', { length: 50 }), // tokenProfile, communityTakeover, etc.
    status: varchar('status', { length: 20 }), // processing, cancelled, etc.
    paymentTimestamp: timestamp('payment_timestamp').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const tokenPriceHistory = pgTable('token_price_history', {
    id: serial('id').primaryKey(),
    tokenAddress: varchar('token_address', { length: 100 }).notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    priceUsd: numeric('price_usd', { precision: 20, scale: 10 }),
    liquidityUsd: numeric('liquidity_usd', { precision: 20, scale: 2 }),
    marketCap: numeric('market_cap', { precision: 20, scale: 2 }),
});

export const boostedTokenInfo = pgTable('boosted_token_info', {
    id: serial('id').primaryKey(),
    boostEventId: integer('boost_event_id')
        .references(() => boostEvents.id),
    tokenBoostId: integer('token_boost_id')
        .references(() => tokenBoosts.id),
    schemaVersion: text('schema_version'),
    chainId: text('chain_id').notNull(),
    dexId: text('dex_id').notNull(),
    url: text('url'),
    pairAddress: text('pair_address').notNull(),
    labels: jsonb('labels'), // Array of text labels

    // Base Token
    baseTokenAddress: text('base_token_address').notNull(),
    baseTokenName: text('base_token_name').notNull(),
    baseTokenSymbol: text('base_token_symbol').notNull(),

    // Quote Token
    quoteTokenAddress: text('quote_token_address').notNull(),
    quoteTokenName: text('quote_token_name').notNull(),
    quoteTokenSymbol: text('quote_token_symbol').notNull(),

    // Price Information
    priceNative: text('price_native'),
    priceUsd: text('price_usd'),

    // Liquidity Information
    liquidityUsd: numeric('liquidity_usd', { precision: 20, scale: 2 }),
    liquidityBase: numeric('liquidity_base', { precision: 20, scale: 8 }),
    liquidityQuote: numeric('liquidity_quote', { precision: 20, scale: 8 }),

    // Market Information
    fdv: numeric('fdv', { precision: 20, scale: 2 }),
    marketCap: numeric('market_cap', { precision: 20, scale: 2 }),

    // Additional Info
    imageUrl: text('image_url'),
    websites: jsonb('websites'), // Array of website objects
    socials: jsonb('socials'), // Array of social objects

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    notes: text('notes'),
});

export const tokenTransactions = pgTable('token_transactions', {
    id: serial('id').primaryKey(),
    signature: text('signature').notNull().unique(),
    tokenAddress: text('token_address').notNull(),
    type: text('type').notNull(), // 'buy' or 'sell'
    amount: numeric('amount').notNull(),
    price: numeric('price').notNull(),
    value: numeric('value').notNull(),
    timestamp: timestamp('timestamp').notNull(),
    wallet: text('wallet').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userWallets = pgTable('user_wallets', {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
        .references(() => users.id),
    name: varchar('name', { length: 100 }),
    address: varchar('address', { length: 200 }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    color: varchar('color', { length: 7 }).notNull().default('#000000'),
    tags: jsonb('tags').default('[]'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const bannedWallets = pgTable('banned_wallets', {
    id: serial('id').primaryKey(),
    address: varchar('address', { length: 200 }).notNull().unique(),
    reason: text('reason'),
    bannedBy: integer('banned_by')
        .references(() => users.id),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const tweets = pgTable('tweets', {
    id: serial('id').primaryKey(),
    tweetId: varchar('tweet_id', { length: 100 }).notNull().unique(),
    tweetUrl: varchar('tweet_url', { length: 500 }),
    userId: varchar('user_id', { length: 100 }).notNull(),
    username: varchar('username', { length: 100 }).notNull(),
    displayName: varchar('display_name', { length: 200 }),
    profileImageUrl: varchar('profile_image_url', { length: 500 }),
    content: text('content').notNull(),
    tweetType: varchar('tweet_type', { length: 20 }).notNull(),

    hasImage: boolean('has_image').notNull().default(false),
    hasVideo: boolean('has_video').notNull().default(false),
    mediaUrls: jsonb('media_urls').default('[]'),

    mentionedCoins: jsonb('mentioned_coins').default('[]'),
    mentionedAddresses: jsonb('mentioned_addresses').default('[]'),

    likeCount: integer('like_count').default(0),
    retweetCount: integer('retweet_count').default(0),
    replyCount: integer('reply_count').default(0),

    referencedTweetId: varchar('referenced_tweet_id', { length: 100 }),

    tweetCreatedAt: timestamp('tweet_created_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const solanaPayments = pgTable('solana_payments', {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
        .notNull()
        .references(() => teams.id),
    signature: varchar('signature', { length: 100 }).notNull().unique(),
    fromAddress: varchar('from_address', { length: 44 }).notNull(),
    amount: numeric('amount', { precision: 20, scale: 9 }).notNull(),
    priceUsd: numeric('price_usd', { precision: 10, scale: 2 }),
    status: varchar('status', { length: 20 }).notNull(), // 'confirmed', 'failed'
    paymentTimestamp: timestamp('payment_timestamp').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const blogAuthors = pgTable('blog_authors', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    bio: text('bio'),
    profileImageUrl: varchar('profile_image_url', { length: 500 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const blogPosts = pgTable('blog_posts', {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(), // Add slug field
    content: text('content').notNull(),
    authorId: integer('author_id')
        .notNull()
        .references(() => blogAuthors.id),
    publishedAt: timestamp('published_at').notNull(),
    heroImageUrl: varchar('hero_image_url', { length: 500 }),
    seoMeta: jsonb('seo_meta').default('{}'), // JSON for SEO metadata
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const videos = pgTable('videos', {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
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
    id: serial('id').primaryKey(),
    userId: integer('user_id')
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

export const externalProjects = pgTable("external_projects", {
    id: serial('id').primaryKey(),
    externalId: varchar("external_id", { length: 50 }).unique().notNull(),
    userId: varchar("user_id", { length: 50 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    createDate: timestamp("create_date", { mode: "string" }),
    animationModeId: varchar("animation_mode_id", { length: 50 }),
    genreId: varchar("genre_id", { length: 50 }),
    resolutionId: varchar("resolution_id", { length: 50 }),
    projectStatusId: varchar("project_status_id", { length: 50 }),
    generativeVideoIntegrationId: varchar("generative_video_integration_id", { length: 50 }),
    audioSynchronizationId: varchar("audio_synchronization_id", { length: 50 }),
    width: numeric("width"), // Changed to numeric for flexibility
    height: numeric("height"), // Changed to numeric for flexibility
    framesPerSecond: numeric("frames_per_second"), // Changed to numeric for flexibility
    smoothness: numeric("smoothness"), // Changed to numeric for flexibility
    positiveKeywords: json("positive_keywords"),
    negativeKeywords: json("negative_keywords"),
    translation: json("translation"),
    rotation: json("rotation"),
    dynamicCamera: boolean("dynamic_camera"),
    oscillation: json("oscillation"),
    intensity: numeric("intensity"), // Changed to numeric for flexibility
    audio: json("audio"),
    completedForm: json("completed_form"),
    video: json("video"),
    status: varchar("status", { length: 50 }),
    minutes: numeric("minutes"), // Changed to numeric to support decimals
    isSubmitted: boolean("is_submitted"),
    userName: varchar("user_name", { length: 255 }),
    completedPercentage: numeric("completed_percentage"), // Changed to numeric for flexibility
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const externalGenras = pgTable("external_genres", {
    id: serial("id").primaryKey(),
    externalId: varchar("external_id", { length: 50 }).unique().notNull(),
    name: varchar("name", { length: 50 }).notNull(),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User Credits Table
export const userCredits = pgTable('user_credits', {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
        .notNull()
        .references(() => users.id),
    totalCredits: numeric('total_credits', { precision: 20, scale: 2 }).notNull().default(0),
    usedCredits: numeric('used_credits', { precision: 20, scale: 2 }).notNull().default(0),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const currentCredits = pgTable('current_credits', {
    userId: varchar('user_id', { length: 50 }).primaryKey(),
    apiKey: varchar('api_key', { length: 50 }).primaryKey(),
    totalCredits: numeric('total_credits', { precision: 20, scale: 2 })
  });
  
// Credit Usage Table
export const creditUsage = pgTable('credit_usage', {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
        .notNull()
        .references(() => users.id),
    videoId: integer('video_id')
        .notNull()
        .references(() => videos.id),
    creditsSpent: numeric('credits_spent', { precision: 20, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Credit Transactions Table
export const creditTransactions = pgTable('credit_transactions', {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
        .notNull()
        .references(() => users.id),
    solAmount: numeric('sol_amount', { precision: 20, scale: 9 }).notNull(),
    creditsPurchased: numeric('credits_purchased', { precision: 20, scale: 2 }).notNull(),
    pricePerCredit: numeric('price_per_credit', { precision: 20, scale: 9 }).notNull(),
    transactionHash: text('transaction_hash').notNull().unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});



export const tweetsRelations = relations(tweets, ({ many }) => ({
}));

export const userWalletsRelations = relations(userWallets, ({ one }) => ({
    user: one(users, {
        fields: [userWallets.userId],
        references: [users.id],
    }),
}));

export const bannedWalletsRelations = relations(bannedWallets, ({ one }) => ({
    bannedByUser: one(users, {
        fields: [bannedWallets.bannedBy],
        references: [users.id],
    }),
}));

export const boostedTokenInfoRelations = relations(boostedTokenInfo, ({ one }) => ({
    boostEvent: one(boostEvents, {
        fields: [boostedTokenInfo.boostEventId],
        references: [boostEvents.id],
    }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
    teamMembers: many(teamMembers),
    activityLogs: many(activityLogs),
    invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
    teamMembers: many(teamMembers),
    invitationsSent: many(invitations),
    bannedWallets: many(bannedWallets),
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

export const newsArticleRelations = relations(newsArticles, ({ one }) => ({
    coin: one(coins, {
        fields: [newsArticles.id],
        references: [coins.id],
    }),
}));

export const coinRelations = relations(coins, ({ many }) => ({
    coinRatings: many(coinRatings),
    newsArticles: many(newsArticles),
    coinSources: many(coinSources),
    coinMentions: many(coinMentions),
    coinPrices: many(coinPrices),
    coinHolders: many(coinHolders),
}));

export const coinRatingRelations = relations(coinRatings, ({ one }) => ({
    coin: one(coins, {
        fields: [coinRatings.coinId],
        references: [coins.id],
    }),
}));

export const coinSourcesRelations = relations(coinSources, ({ one }) => ({
    coin: one(coins, {
        fields: [coinSources.coinId],
        references: [coins.id],
    }),
}));

export const mentionsRelations = relations(mentions, ({ many }) => ({
    coinMentions: many(coinMentions),
}));

export const coinMentionsRelations = relations(coinMentions, ({ one }) => ({
    coin: one(coins, {
        fields: [coinMentions.coinId],
        references: [coins.id],
    }),
    mention: one(mentions, {
        fields: [coinMentions.mentionId],
        references: [mentions.id],
    }),
}));

export const coinPricesRelations = relations(coinPrices, ({ one }) => ({
    coin: one(coins, {
        fields: [coinPrices.coinId],
        references: [coins.id],
    }),
}));

export const coinHoldersRelations = relations(coinHolders, ({ one }) => ({
    coin: one(coins, {
        fields: [coinHolders.coinId],
        references: [coins.id],
    }),
}));

export const boostEventsRelations = relations(boostEvents, ({ one, many }) => ({
    tokenBoost: one(tokenBoosts, {
        fields: [boostEvents.tokenBoostId],
        references: [tokenBoosts.id],
    }),
    boostedTokenInfo: many(boostedTokenInfo),
}));

export const solanaPaymentsRelations = relations(solanaPayments, ({ one }) => ({
    team: one(teams, {
        fields: [solanaPayments.teamId],
        references: [teams.id],
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

export const ActivityType = {
    SIGN_UP: 'SIGN_UP',
    SIGN_IN: 'SIGN_IN',
    SIGN_OUT: 'SIGN_OUT',
    UPDATE_PASSWORD: 'UPDATE_PASSWORD',
    DELETE_ACCOUNT: 'DELETE_ACCOUNT',
    UPDATE_ACCOUNT: 'UPDATE_ACCOUNT',
    CREATE_TEAM: 'CREATE_TEAM',
    REMOVE_TEAM_MEMBER: 'REMOVE_TEAM_MEMBER',
    INVITE_TEAM_MEMBER: 'INVITE_TEAM_MEMBER',
    ACCEPT_INVITATION: 'ACCEPT_INVITATION',
};