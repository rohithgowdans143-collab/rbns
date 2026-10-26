
"use strict";

const mongoose = require("mongoose");

const repaymentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        loan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Loan",
            required: true,
            index: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0.01,
            max: 1000000000
        },

        paymentDate: {
            type: Date,
            required: true
        },

        note: {
            type: String,
            trim: true,
            maxlength: 200,
            default: ""
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

repaymentSchema.index({ user: 1, paymentDate: -1 });

module.exports = mongoose.model("Repayment", repaymentSchema);
