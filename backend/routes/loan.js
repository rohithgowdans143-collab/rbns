
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

// GET loans belonging to, provided by, or received by the signed-in user.
router.get("/", protect, async (req, res) => {
    try {
        const loans = await Loan.find(
            visibleTo(req.user.id)
        ).sort({ createdAt: -1 });

        return res.json({ loans });
    } catch (error) {
        console.error("Fetch loans error:", error);
        return res.status(500).json({
            message: "Failed to fetch loans."
        });
    }
});

/* GET registered users for the borrower selector */
router.get("/borrowers", protect, async (req, res) => {
    try {
        const users = await User.find({
            _id: { $ne: req.user.id }
        })
            .select("fullName businessName phone phoneVerified")
            .sort({ fullName: 1 })
            .limit(200)
            .lean();

        return res.json({
            borrowers: users.map(user => ({
                id: String(user._id),
                fullName: user.fullName,
                businessName: user.businessName,
                phone: user.phone,
                phoneVerified: user.phoneVerified === true
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

        if (
            typeof borrowerId !== "string" ||
            !mongoose.isValidObjectId(borrowerId) ||
            !Number.isFinite(Number(principalAmount)) ||
            Number(principalAmount) <= 0 ||
            Number(principalAmount) > 1000000000 ||
            !Number.isFinite(Number(interestRate)) ||
            Number(interestRate) < 0 ||
            Number(interestRate) > 100 ||
            !dueDate ||
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
            User.findById(lenderId).select("fullName businessName phone"),
            User.findById(borrowerId).select("fullName businessName phone")
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
            // Keep this field for compatibility with existing code.
            user: lender._id,

            lender: lender._id,
            borrower: borrower._id,

            lenderName: lender.fullName,
            borrowerName: borrower.fullName,
            borrowerPhone: borrower.phone,

            principalAmount: Number(principalAmount),
            interestRate: Number(interestRate),
            outstandingBalance: Number(principalAmount),
            dueDate: new Date(dueDate),
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

        return res.status(201).json({
            message: "Loan created. It is awaiting agreement acceptance.",
            loan
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
            User.findById(userId).select("fullName"),
            Loan.find(visibleTo(userId)).sort({ createdAt: -1 }),
            Transaction.find({ user: userId }).sort({ date: -1 })
        ]);

        // Include repayments for loans involving this user.
        const loanIds = loans.map(loan => loan._id);

        const repayments = loanIds.length
            ? await Repayment.find({
                $or: [
                    { user: userId },
                    { loan: { $in: loanIds } }
                ]
            })
                .populate("loan", "lenderName borrowerName")
                .sort({ paymentDate: -1 })
            : await Repayment.find({ user: userId })
                .populate("loan", "lenderName borrowerName")
                .sort({ paymentDate: -1 });

        const repaymentRows = repayments.map(item => ({
            _id: item._id,
            loanId: item.loan?._id,
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
            vendor: vendor ? { fullName: vendor.fullName } : null,
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
