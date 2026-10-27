
"use strict";

const express = require("express");
const Transaction = require("../models/transaction");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// Get transactions for the signed-in user
router.get("/", protect, async (req, res) => {
    try {
        const transactions = await Transaction.find({
            user: req.user.id
        }).sort({ date: -1 });

        res.json({ transactions });
    } catch (error) {
        console.error("Fetch transactions error:", error);
        res.status(500).json({
            message: "Failed to fetch transactions."
        });
    }
});

// Create a sale or expense
router.post("/", protect, async (req, res) => {
    try {
        const { type, amount, description, date } = req.body || {};

        if (
            !["sale", "expense"].includes(type) ||
            !Number.isFinite(Number(amount)) ||
            Number(amount) <= 0 ||
            Number(amount) > 1000000000 ||
            typeof description !== "string" ||
            !description.trim() ||
            description.trim().length > 120 ||
            !date ||
            Number.isNaN(Date.parse(date))
        ) {
            return res.status(400).json({
                message: "Please provide valid transaction details."
            });
        }

        const transaction = await Transaction.create({
            user: req.user.id,
            type,
            amount: Number(amount),
            description: description.trim(),
            date: new Date(date)
        });

        res.status(201).json({
            message: "Transaction saved successfully.",
            transaction
        });
    } catch (error) {
        console.error("Create transaction error:", error);
        res.status(500).json({
            message: "Failed to save transaction."
        });
    }
});

module.exports = router;
