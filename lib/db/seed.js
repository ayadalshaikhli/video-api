import { stripe } from '../payments/stripe';
import { db } from './drizzle';
import { users, teams, teamMembers, newsArticles } from './schema';
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

async function createTestNewsArticles() {
  console.log('Creating test news articles...');

  // Create some test news articles
  await db.insert(newsArticles).values([
    {
      title: 'AI Video Generation Reaches New Heights',
      url: 'https://example.com/ai-video-breakthrough',
      source: 'TechNews',
      content: 'AI video generation technology has reached new heights with advanced algorithms...',
      publishedAt: new Date(),
    },
    {
      title: 'Content Creation Tools Revolutionize Media',
      url: 'https://example.com/content-creation-revolution',
      source: 'MediaDaily',
      content: 'New content creation tools are revolutionizing the media industry...',
      publishedAt: new Date(),
    },
    {
      title: 'Automated Video Production on the Rise',
      url: 'https://example.com/automated-video-production',
      source: 'ProductionNews',
      content: 'Automated video production systems are becoming increasingly popular...',
      publishedAt: new Date(),
    },
  ]);

  console.log('Test news articles created successfully.');
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
      await createTestNewsArticles();
    } catch (error) {
      console.log('Some news articles might already exist:', error.message);
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
