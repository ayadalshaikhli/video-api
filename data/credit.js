
import { db } from "../lib/db/drizzle.js";
import { getUser } from "../lib/db/queries.js";
import { userCredits, creditUsage, creditTransactions } from "../lib/db/schema.js";
import { eq } from "drizzle-orm";


export async function getUserCredits(userId) {
    // Instead of calling "getUser()" from Next.js, we do a direct query by userId
    const credits = await db
      .select()
      .from(userCredits)
      .where(eq(userCredits.userId, userId))
      .limit(1);
  
    if (!credits || credits.length === 0) {
      return { totalCredits: 0, usedCredits: 0 };
    }
    return credits[0];
  }

export const getUserCreditTransactions = async () => {
    const user = await getUser();
    if (!user) {
        return { error: "Not authenticated" };
    }

    const transactions = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.userId, user.id))
        .orderBy(creditTransactions.transactionTimestamp, "DESC");

    return transactions;
}

// export const getUserSolanaPayments = async () => {
//     const user = await getUser();
//     if (!user) {
//         return { error: "Not authenticated" };
//     }

//     const payments = await db
//         .select()
//         .from(solanaPayments)
//         .where(eq(solanaPayments.userId, user.id))
//         .orderBy(solanaPayments.paymentTimestamp, "DESC");

//     return payments;
// }

export const getUserWallets = async () => {
    const user = await getUser();
    if (!user) {
        return { error: "Not authenticated" };
    }

    const wallets = await db
        .select()
        .from(creditUsage)
        .where(eq(creditUsage.userId, user.id))
        .orderBy(creditUsage.usageTimestamp, "DESC");

    return wallets;
}

