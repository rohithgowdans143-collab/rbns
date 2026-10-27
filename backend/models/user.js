
"use strict";

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 80
        },

        businessName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            maxlength: 254,
            unique: true,
            index: true
        },

        phone: {
            type: String,
            required: true,
            match: /^[6-9]\d{9}$/
        },

        phoneVerified: {
            type: Boolean,
            default: false
        },

        address: {
            type: String,
            trim: true,
            maxlength: 300,
            default: ""
        },

        city: {
            type: String,
            trim: true,
            maxlength: 80,
            default: ""
        },

        state: {
            type: String,
            trim: true,
            maxlength: 80,
            default: ""
        },

        pincode: {
            type: String,
            match: /^\d{6}$/,
            default: undefined
        },

        identityVerification: {
            status: {
                type: String,
                enum: ["not_started", "pending", "verified", "rejected"],
                default: "not_started"
            },

            provider: {
                type: String,
                trim: true,
                maxlength: 100,
                default: ""
            },

            referenceId: {
                type: String,
                trim: true,
                maxlength: 200,
                default: ""
            },

            verifiedAt: {
                type: Date,
                default: null
            }
        },

        language: {
            type: String,
            enum: ["en", "kn", "hi"],
            default: "en"
        },

        passwordHash: {
            type: String,
            required: true,
            select: false
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model("User", userSchema);
