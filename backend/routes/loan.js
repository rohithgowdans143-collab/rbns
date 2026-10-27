
"use strict";

const express = require("express");
const Loan = require("../models/loan");
const Repayment = require("../models/repayment");
const Transaction = require("../models/transaction");
const User = require("../models/user");
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
            message: "Failed to fetch loans."
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
        } = req.body || {};

        if (
            typeof lenderName !== "string" ||
            !lenderName.trim() ||
            !Number.isFinite(Number(principalAmount)) ||
            Number(principalAmount) <= 0 ||
            !Number.isFinite(Number(interestRate)) ||
            Number(interestRate) < 0 ||
            Number(interestRate) > 100 ||
            !dueDate ||
            Number.isNaN(Date.parse(dueDate))
        ) {
            return res.status(400).json({
                message: "Please provide valid loan details."
            });
        }

        const loan = await Loan.create({
            user: req.user.id,
            lenderName: lenderName.trim(),
            principalAmount: Number(principalAmount),
            interestRate: Number(interestRate),
            outstandingBalance: Number(principalAmount),
            dueDate: new Date(dueDate),
            note: typeof note === "string" ? note.trim() : ""
        });

        res.status(201).json({
            message: "Loan created successfully.",
            loan
        });
    } catch (error) {
        console.error("Create loan error:", error);
        res.status(500).json({
            message: "Failed to create loan."
        });
    }
});

// GET dashboard data
router.get("/dashboard", protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const [vendor, loans, repayments, transactions] =
            await Promise.all([
                User.findById(userId).select("fullName"),
                Loan.find({ user: userId }).sort({ createdAt: -1 }),
                Repayment.find({ user: userId })
                    .populate("loan", "lenderName")
                    .sort({ paymentDate: -1 }),
                Transaction.find({ user: userId })
                    .sort({ date: -1 })
            ]);

        const repaymentRows = repayments.map(item => ({
            _id: item._id,
            loanId: item.loan?._id,
            lenderName: item.loan?.lenderName || "Unknown loan",
            amount: item.amount,
            paymentDate: item.paymentDate,
            note: item.note
        }));

        const sales = transactions.filter(item => item.type === "sale");
        const expenses = transactions.filter(item => item.type === "expense");

        res.json({
            vendor: vendor ? { fullName: vendor.fullName } : null,
            loans,
            repayments: repaymentRows,
            transactions,
            sales,
            expenses
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).json({
            message: "Failed to load dashboard."
        });
    }
});

module.exports = router;
