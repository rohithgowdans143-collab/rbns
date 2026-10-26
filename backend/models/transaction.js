
"use strict";

const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        type: {
            type: String,
            enum: ["sale", "expense"],
            required: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0.01,
            max: 1000000000
        },

        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },

        date: {
            type: Date,
            required: true
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

transactionSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);
