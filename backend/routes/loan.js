
"use strict";

const express = require("express");
const mongoose = require("mongoose");

const Loan = require("../models/loan");
const Repayment = require("../models/repayment");
const Transaction = require("../models/transaction");
const User = require("../models/user");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

function visibleTo(userId) {
    return {
        $or: [
            { user: userId },
            { lender: userId },
            { borrower: userId }
        ]
    };
}

// Populate only the profile fields needed by the loan dashboard.
const loanPopulation = [
    {
        path: "lender",
        select: "fullName businessName phone phoneVerified identityVerification"
    },
    {
        path: "borrower",
        select: "fullName businessName phone phoneVerified identityVerification"
    }
];

// GET loans visible to the signed-in user.
router.get("/", protect, async (req, res) => {
    try {
        const loans = await Loan.find(
            visibleTo(req.user.id)
        )
            .populate(loanPopulation)
            .sort({ createdAt: -1 })
            .lean();

        return res.json({ loans });
    } catch (error) {
        console.error("Fetch loans error:", error);

        return res.status(500).json({
            message: "Failed to fetch loans."
        });
    }
});

// GET registered users for the borrower selector.
// Do not expose phone numbers or identity-verification details here.
router.get("/borrowers", protect, async (req, res) => {
    try {
        const users = await User.find({
            _id: { $ne: req.user.id }
        })
            .select("fullName businessName")
            .sort({ fullName: 1 })
            .limit(200)
            .lean();

        return res.json({
            borrowers: users.map(user => ({
                id: String(user._id),
                fullName: user.fullName,
                businessName: user.businessName
            }))
        });
    } catch (error) {
        console.error("Fetch borrowers error:", error);

        return res.status(500).json({
            message: "Failed to load registered borrowers."
        });
    }
});

// CREATE a loan linked to a registered borrower.
router.post("/", protect, async (req, res) => {
    try {
        const {
            borrowerId,
            principalAmount,
            interestRate = 0,
            dueDate,
            note
        } = req.body || {};

        const amount = Number(principalAmount);
        const rate = Number(interestRate);

        if (
            typeof borrowerId !== "string" ||
            !mongoose.isValidObjectId(borrowerId) ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount > 1000000000 ||
            !Number.isFinite(rate) ||
            rate < 0 ||
            rate > 100 ||
            typeof dueDate !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
            Number.isNaN(Date.parse(dueDate)) ||
            (note !== undefined && typeof note !== "string") ||
            (typeof note === "string" && note.length > 300)
        ) {
            return res.status(400).json({
                message: "Please provide valid borrower and loan details."
            });
        }

        const lenderId = req.user.id;

        if (String(borrowerId) === String(lenderId)) {
            return res.status(400).json({
                message: "You cannot create a loan to yourself."
            });
        }

        const [lender, borrower] = await Promise.all([
            User.findById(lenderId)
                .select("fullName businessName phone"),
            User.findById(borrowerId)
                .select("fullName businessName phone")
        ]);

        if (!lender) {
            return res.status(401).json({
                message: "Lender account not found."
            });
        }

        if (!borrower) {
            return res.status(404).json({
                message: "Borrower account not found. Ask them to register first."
            });
        }

        const loan = await Loan.create({
            // Retain the legacy field for compatibility.
            user: lender._id,

            lender: lender._id,
            borrower: borrower._id,

            lenderName: lender.fullName,
            borrowerName: borrower.fullName,
            borrowerPhone: borrower.phone,

            principalAmount: amount,
            interestRate: rate,
            outstandingBalance: amount,
            dueDate: new Date(`${dueDate}T12:00:00.000Z`),
            note: typeof note === "string" ? note.trim() : "",

            status: "pending",

            agreement: {
                status: "pending",
                version: 1,
                lenderAcceptedAt: null,
                borrowerAcceptedAt: null
            },

            auditLog: [{
                action: "created",
                actor: lender._id,
                details: "Loan created; awaiting agreement acceptance."
            }]
        });

        const populatedLoan = await Loan.findById(loan._id)
            .populate(loanPopulation)
            .lean();

        return res.status(201).json({
            message: "Loan created. It is awaiting agreement acceptance.",
            loan: populatedLoan
        });
    } catch (error) {
        console.error("Create loan error:", error);

        return res.status(500).json({
            message: "Failed to create loan."
        });
    }
});

// GET dashboard data.
router.get("/dashboard", protect, async (req, res) => {
    try {
        const userId = req.user.id;

        const [vendor, loans, transactions] = await Promise.all([
            User.findById(userId)
                .select("fullName businessName")
                .lean(),

            Loan.find(visibleTo(userId))
                .populate(loanPopulation)
                .sort({ createdAt: -1 })
                .lean(),

            Transaction.find({ user: userId })
                .sort({ date: -1 })
                .lean()
        ]);

        // Load repayments for this user's loans.
        const loanIds = loans.map(loan => loan._id);

        const repaymentQuery = loanIds.length
            ? {
                $or: [
                    { user: userId },
                    { loan: { $in: loanIds } }
                ]
            }
            : { user: userId };

        const repayments = await Repayment.find(repaymentQuery)
            .populate("loan", "lenderName borrowerName")
            .sort({ paymentDate: -1 })
            .lean();

        const repaymentRows = repayments.map(item => ({
            _id: item._id,
            loanId: item.loan?._id || item.loan || null,
            lenderName: item.loan?.lenderName || "Unknown loan",
            borrowerName: item.loan?.borrowerName || "",
            amount: item.amount,
            paymentDate: item.paymentDate,
            note: item.note
        }));

        const sales = transactions.filter(
            item => item.type === "sale"
        );

        const expenses = transactions.filter(
            item => item.type === "expense"
        );

        return res.json({
            // Include _id because the frontend uses it to identify
            // whether the signed-in user is the lender or borrower.
            vendor: vendor
                ? {
                    _id: String(vendor._id),
                    fullName: vendor.fullName,
                    businessName: vendor.businessName
                }
                : null,

            loans,
            repayments: repaymentRows,
            transactions,
            sales,
            expenses
        });
    } catch (error) {
        console.error("Dashboard error:", error);

        return res.status(500).json({
            message: "Failed to load dashboard."
        });
    }
});

module.exports = router;
