
"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 1000 * 60 * 60 * 8
};

function createSession(res, userId) {
    const token = jwt.sign(
        {},
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            subject: String(userId),
            issuer: "microloanx",
            audience: "microloanx-users",
            expiresIn: "8h"
        }
    );

    res.cookie("microloanx_session", token, cookieOptions);
}

function publicUser(user) {
    return {
        id: user._id,
        fullName: user.fullName,
        businessName: user.businessName,
        email: user.email,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        address: user.address || "",
        city: user.city || "",
        state: user.state || "",
        pincode: user.pincode || "",
        identityVerification: {
            status: user.identityVerification?.status || "not_started",
            verifiedAt: user.identityVerification?.verifiedAt || null
        },
        language: user.language
    };
}

// Register a user.
router.post("/register", async (req, res, next) => {
    try {
        const {
            fullName,
            businessName,
            email,
            phone,
            language,
            password,
            address,
            city,
            state,
            pincode
        } = req.body || {};

        if (
            typeof fullName !== "string" ||
            typeof businessName !== "string" ||
            typeof email !== "string" ||
            typeof phone !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                message: "Please provide all required fields."
            });
        }

        const cleanName = fullName.trim();
        const cleanBusiness = businessName.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();

        if (
            cleanName.length < 2 ||
            cleanName.length > 80 ||
            cleanBusiness.length < 1 ||
            cleanBusiness.length > 100
        ) {
            return res.status(400).json({
                message: "Please check your name and business name."
            });
        }

        if (
            cleanEmail.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
        ) {
            return res.status(400).json({
                message: "Please provide a valid email address."
            });
        }

        if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
            return res.status(400).json({
                message: "Enter a valid 10-digit Indian mobile number."
            });
        }

        if (
            password.length < 8 ||
            password.length > 128 ||
            !/[A-Za-z]/.test(password) ||
            !/\d/.test(password)
        ) {
            return res.status(400).json({
                message: "Use at least 8 characters, including a letter and a number."
            });
        }

        const supportedLanguages = ["en", "kn", "hi"];
        const selectedLanguage = language || "en";

        if (!supportedLanguages.includes(selectedLanguage)) {
            return res.status(400).json({
                message: "Please select a supported language."
            });
        }

        const optionalFields = {
            address: typeof address === "string" ? address.trim() : "",
            city: typeof city === "string" ? city.trim() : "",
            state: typeof state === "string" ? state.trim() : ""
        };

        if (
            optionalFields.address.length > 300 ||
            optionalFields.city.length > 80 ||
            optionalFields.state.length > 80
        ) {
            return res.status(400).json({
                message: "Please check your address details."
            });
        }

        let cleanPincode;

        if (pincode !== undefined && pincode !== "") {
            if (
                typeof pincode !== "string" ||
                !/^\d{6}$/.test(pincode.trim())
            ) {
                return res.status(400).json({
                    message: "Enter a valid 6-digit PIN code."
                });
            }

            cleanPincode = pincode.trim();
        }

        const existing = await User.findOne({
            email: cleanEmail
        }).lean();

        if (existing) {
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        let user;

        try {
            user = await User.create({
                fullName: cleanName,
                businessName: cleanBusiness,
                email: cleanEmail,
                phone: cleanPhone,
                language: selectedLanguage,
                passwordHash,
                ...optionalFields,
                ...(cleanPincode ? { pincode: cleanPincode } : {}),
                phoneVerified: false,
                identityVerification: {
                    status: "not_started"
                }
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({
                    message: "An account with this email already exists."
                });
            }

            throw error;
        }

        return res.status(201).json({
            message: "Account created successfully. Please sign in.",
            user: publicUser(user)
        });
    } catch (error) {
        next(error);
    }
});

// Sign in a user.
router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            email.length > 254 ||
            password.length > 128
        ) {
            return res.status(400).json({
                message: "Please enter a valid email and password."
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        }).select("+passwordHash");

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!validPassword) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        createSession(res, user._id);

        return res.json({
            message: "Login successful.",
            user: publicUser(user)
        });
    } catch (error) {
        next(error);
    }
});

// Return the current signed-in user.
router.get("/me", authMiddleware, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(401).json({
                message: "Account not found."
            });
        }

        return res.json({
            user: publicUser(user)
        });
    } catch (error) {
        next(error);
    }
});

// Log out by clearing the authentication cookie.
router.post("/logout", (req, res) => {
    res.clearCookie("microloanx_session", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/"
    });

    return res.json({
        message: "Logged out successfully."
    });
});

module.exports = router;
