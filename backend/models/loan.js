
"use strict";

const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        lenderName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        principalAmount: {
            type: Number,
            required: true,
            min: 0.01,
            max: 1000000000
        },

        interestRate: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 0
        },

        outstandingBalance: {
            type: Number,
            required: true,
            min: 0
        },

        dueDate: {
            type: Date,
            required: true
        },

        note: {
            type: String,
            trim: true,
            maxlength: 300,
            default: ""
        },

        status: {
            type: String,
            enum: ["pending", "paid", "overdue"],
            default: "pending"
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

loanSchema.index({ user: 1, dueDate: 1 });

module.exports = mongoose.model("Loan", loanSchema);
