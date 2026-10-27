
"use strict";

const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema(
    {
        // Kept for compatibility with existing MicroLoanX records.
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        // Registered account that provides the loan.
        lender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },

        // Registered account that receives the loan.
        borrower: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true
        },

        // Snapshots preserve the original names if a profile changes.
        lenderName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        borrowerName: {
            type: String,
            trim: true,
            maxlength: 100,
            default: ""
        },

        borrowerPhone: {
            type: String,
            match: /^[6-9]\d{9}$/,
            default: undefined
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
        },

        // Both parties must accept the recorded loan terms.
        agreement: {
            status: {
                type: String,
                enum: [
                    "draft",
                    "pending",
                    "accepted",
                    "rejected"
                ],
                default: "draft"
            },

            version: {
                type: Number,
                min: 1,
                default: 1
            },

            lenderAcceptedAt: {
                type: Date,
                default: null
            },

            borrowerAcceptedAt: {
                type: Date,
                default: null
            },

            termsHash: {
                type: String,
                maxlength: 128,
                default: ""
            }
        },

        // Records important events for an audit trail.
        auditLog: {
            type: [
                {
                    action: {
                        type: String,
                        required: true,
                        enum: [
                            "created",
                            "lender_accepted",
                            "borrower_accepted",
                            "rejected",
                            "repayment_recorded",
                            "terms_updated",
                            "status_updated"
                        ]
                    },

                    actor: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User",
                        required: true
                    },

                    details: {
                        type: String,
                        maxlength: 300,
                        default: ""
                    },

                    occurredAt: {
                        type: Date,
                        default: Date.now
                    }
                }
            ],
            default: []
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Support loan searches for both parties.
loanSchema.index({ user: 1, dueDate: 1 });
loanSchema.index({ lender: 1, dueDate: 1 });
loanSchema.index({ borrower: 1, dueDate: 1 });

module.exports = mongoose.model("Loan", loanSchema);
