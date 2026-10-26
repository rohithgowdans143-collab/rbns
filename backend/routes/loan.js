
"use strict";

const express = require("express");
const Loan = require("../models/loan");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// GET all loans
router.get("/", protect, async (req, res) => {
    try {
        const loans = await Loan.find({
            user: req.user.id
        }).sort({ createdAt: -1 });

        res.json({ loans });
    } catch (error) {
        console.error("Fetch loans error:", error);
        res.status(500).json({
            message: "Failed to fetch loans"
        });
    }
});

// CREATE a loan
router.post("/", protect, async (req, res) => {
    try {
        const {
            lenderName,
            principalAmount,
            interestRate,
            dueDate,
            note
        } = req.body;

        if (
            !lenderName ||
            principalAmount === undefined ||
            interestRate === undefined ||
            !dueDate
        ) {
            return res.status(400).json({
                message: "Please provide all required loan fields"
            });
        }

        const loan = await Loan.create({
            user: req.user.id,
            lenderName,
            principalAmount,
            interestRate,
            outstandingBalance: principalAmount,
            dueDate,
            note: note || ""
        });

        res.status(201).json({
            message: "Loan created successfully",
            loan
        });
    } catch (error) {
        console.error("Create loan error:", error);

        if (
            error.name === "ValidationError" ||
            error.name === "CastError"
        ) {
            return res.status(400).json({
                message: "Invalid loan details",
                error: error.message
            });
        }

        res.status(500).json({
            message: "Failed to create loan"
        });
    }
});

// GET dashboard summary
router.get("/dashboard", protect, async (req, res) => {
    try {
        const loans = await Loan.find({
            user: req.user.id
        });

        const totalLoans = loans.length;

        const totalBorrowed = loans.reduce(
            (sum, loan) => sum + loan.principalAmount,
            0
        );

        const totalOutstanding = loans.reduce(
            (sum, loan) => sum + loan.outstandingBalance,
            0
        );

        const overdueLoans = loans.filter(
            loan => loan.status === "overdue"
        ).length;

        res.json({
            totalLoans,
            totalBorrowed,
            totalOutstanding,
            overdueLoans,
            loans
        });
    } catch (error) {
        console.error("Dashboard error:", error);

        res.status(500).json({
            message: "Failed to load dashboard"
        });
    }
});

module.exports = router;
