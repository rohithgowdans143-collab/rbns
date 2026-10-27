
"use strict";

const express = require("express");
const mongoose = require("mongoose");
const Repayment = require("../models/repayment");
const Loan = require("../models/loan");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// Record a repayment
router.post("/", protect, async (req, res) => {
    try {
        const { loanId, amount, paymentDate, note } = req.body || {};

        if (
            !mongoose.isValidObjectId(loanId) ||
            !Number.isFinite(Number(amount)) ||
            Number(amount) <= 0 ||
            !paymentDate ||
            Number.isNaN(Date.parse(paymentDate))
        ) {
            return res.status(400).json({
                message: "Please provide valid repayment details."
            });
        }

        const loan = await Loan.findOne({
            _id: loanId,
            user: req.user.id
        });

        if (!loan) {
            return res.status(404).json({
                message: "Loan not found."
            });
        }

        if (Number(amount) > Number(loan.outstandingBalance)) {
            return res.status(400).json({
                message: "Repayment cannot exceed the outstanding balance."
            });
        }

        const repayment = await Repayment.create({
            user: req.user.id,
            loan: loan._id,
            amount: Number(amount),
            paymentDate: new Date(paymentDate),
            note: typeof note === "string" ? note.trim() : ""
        });

        loan.outstandingBalance =
            Number(loan.outstandingBalance) - Number(amount);

        if (loan.outstandingBalance <= 0) {
            loan.outstandingBalance = 0;
            loan.status = "paid";
        }

        await loan.save();

        return res.status(201).json({
            message: "Repayment recorded successfully.",
            repayment
        });
    } catch (error) {
        console.error("Create repayment error:", error);

        return res.status(500).json({
            message: "Failed to record repayment."
        });
    }
});

module.exports = router;
