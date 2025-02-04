import mongoose from "mongoose";

const walletTokens = new mongoose.Schema({
    amount: {
        type: String,
    },
    mint: {
        type: String,
    },
    owner: {
        type: String,
    },
    programId: {
        type: Array,
    },

    pubkey: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.model("WalletTokens", walletTokens);
