import { stripe } from '../payments/stripe';
import { db } from './drizzle';
import { users, teams, teamMembers, coins, newsArticles, coinRatings } from './schema';
import { hashPassword } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';

async function createStripeProducts() {
  console.log('Creating Stripe products and prices...');

  const baseProduct = await stripe.products.create({
    name: 'Base',
    description: 'Base subscription plan',
  });

  await stripe.prices.create({
    product: baseProduct.id,
    unit_amount: 800, // $8 in cents
    currency: 'usd',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  const plusProduct = await stripe.products.create({
    name: 'Plus',
    description: 'Plus subscription plan',
  });

  await stripe.prices.create({
    product: plusProduct.id,
    unit_amount: 1200, // $12 in cents
    currency: 'usd',
    recurring: {
      interval: 'month',
      trial_period_days: 7,
    },
  });

  console.log('Stripe products and prices created successfully.');
}

async function createTestCoins() {
  console.log('Creating test coins...');
  
  const testCoins = [
    {
      name: 'Bitcoin',
      symbol: 'BTC',
      description: 'The first and most well-known cryptocurrency.',
      marketCap: '1000000000.00',
    },
    {
      name: 'Ethereum',
      symbol: 'ETH',
      description: 'A decentralized platform that runs smart contracts.',
      marketCap: '500000000.00',
    },
    {
      name: 'Solana',
      symbol: 'SOL',
      description: 'High-performance blockchain platform.',
      marketCap: '100000000.00',
    },
  ];

  const [btc, eth, sol] = await db.insert(coins).values(testCoins).returning();
  
  // Create some test ratings
  await db.insert(coinRatings).values([
    {
      coinId: btc.id,
      mentionCount: 100,
      sentimentScore: 4.5,
      rating: 5,
    },
    {
      coinId: eth.id,
      mentionCount: 80,
      sentimentScore: 4.2,
      rating: 4,
    },
    {
      coinId: sol.id,
      mentionCount: 60,
      sentimentScore: 4.0,
      rating: 4,
    },
  ]);

  // Create some test news articles
  await db.insert(newsArticles).values([
    {
      title: 'Bitcoin Reaches New All-Time High',
      url: 'https://example.com/btc-ath',
      source: 'CryptoNews',
      content: 'Bitcoin has reached a new all-time high today...',
      publishedAt: new Date(),
    },
    {
      title: 'Ethereum 2.0 Update Coming Soon',
      url: 'https://example.com/eth2-update',
      source: 'CryptoDaily',
      content: 'The long-awaited Ethereum 2.0 update is scheduled for...',
      publishedAt: new Date(),
    },
    {
      title: 'Solana DeFi Ecosystem Growing',
      url: 'https://example.com/sol-defi',
      source: 'BlockchainNews',
      content: 'The Solana DeFi ecosystem continues to expand with...',
      publishedAt: new Date(),
    },
  ]);

  console.log('Test coins, ratings, and news articles created successfully.');
}

async function seed() {
  try {
    const email = 'test@test.com';
    
    // First check if the user exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    let user;
    if (existingUser.length === 0) {
      // Only create user if it doesn't exist
      const password = 'admin123';
      const passwordHash = await hashPassword(password);
      [user] = await db
        .insert(users)
        .values({
          email: email,
          passwordHash: passwordHash,
          role: "owner",
        })
        .returning();
      console.log('Initial user created.');
    } else {
      user = existingUser[0];
      console.log('Using existing user.');
    }

    // Check if team exists for this user
    const existingTeam = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id))
      .limit(1);

    let team;
    if (existingTeam.length === 0) {
      [team] = await db
        .insert(teams)
        .values({
          name: 'Test Team',
        })
        .returning();

      await db.insert(teamMembers).values({
        teamId: team.id,
        userId: user.id,
        role: 'owner',
      });
      console.log('New team created and linked to user.');
    } else {
      console.log('User already has a team.');
    }

    // Create test data
    try {
      await createStripeProducts();
    } catch (error) {
      console.log('Stripe products might already exist:', error.message);
    }

    try {
      await createTestCoins();
    } catch (error) {
      console.log('Some coins might already exist:', error.message);
    }

    console.log('All seed data processed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
  }
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
