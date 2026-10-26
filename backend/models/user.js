
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
