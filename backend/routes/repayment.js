
"use strict";

const express = require("express");
const mongoose = require("mongoose");

const Repayment = require("../models/repayment");
const Loan = require("../models/loan");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// Record a repayment for a loan involving the signed-in user.
router.post("/", protect, async (req, res) => {
    const { loanId, amount, paymentDate, note } = req.body || {};

    if (
        typeof loanId !== "string" ||
        !mongoose.isValidObjectId(loanId) ||
        amount === "" ||
        amount === null ||
        amount === undefined ||
        !Number.isFinite(Number(amount)) ||
        Number(amount) <= 0 ||
        Number(amount) > 1000000000 ||
        !paymentDate ||
        Number.isNaN(Date.parse(paymentDate)) ||
        (note !== undefined && typeof note !== "string") ||
        (typeof note === "string" && note.length > 300)
    ) {
        return res.status(400).json({
            message: "Please provide valid repayment details."
        });
    }

    const userId = req.user.id;
    const session = await mongoose.startSession();

    try {
        let repayment;

        await session.withTransaction(async () => {
            const loan = await Loan.findOne({
                _id: loanId,
                $or: [
                    { user: userId },
                    { lender: userId },
                    { borrower: userId }
                ]
            }).session(session);

            if (!loan) {
                const error = new Error("Loan not found or access denied.");
                error.statusCode = 404;
                throw error;
            }

            if (loan.agreement?.status !== "accepted" &&
                loan.lender && loan.borrower) {
                const error = new Error(
                    "Both parties must accept the loan agreement before recording repayments."
                );
                error.statusCode = 409;
                throw error;
            }

            const paymentAmount = Number(amount);
            const currentBalance = Number(loan.outstandingBalance);

            if (paymentAmount > currentBalance) {
                const error = new Error(
                    "Repayment cannot exceed the outstanding balance."
                );
                error.statusCode = 400;
                throw error;
            }

            if (loan.status === "paid" || currentBalance <= 0) {
                const error = new Error("This loan has already been paid.");
                error.statusCode = 409;
                throw error;
            }

            loan.outstandingBalance = Number(
                (currentBalance - paymentAmount).toFixed(2)
            );

            if (loan.outstandingBalance <= 0) {
                loan.outstandingBalance = 0;
                loan.status = "paid";
            } else if (new Date(loan.dueDate) < new Date()) {
                loan.status = "overdue";
            } else {
                loan.status = "pending";
            }

            await loan.save({ session });

            const records = await Repayment.create(
                [{
                    user: userId,
                    loan: loan._id,
                    amount: paymentAmount,
                    paymentDate: new Date(paymentDate),
                    note: typeof note === "string" ? note.trim() : ""
                }],
                { session }
            );

            repayment = records[0];
            
            loan.auditLog.push({
                action: "repayment_recorded",
                actor: new mongoose.Types.ObjectId(userId),
                details: `Repayment recorded: ${paymentAmount}`,
                occurredAt: new Date()
            });

            await loan.save({ session });
        });

        return res.status(201).json({
            message: "Repayment recorded successfully.",
            repayment
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message
            });
        }

        console.error("Create repayment error:", error);

        return res.status(500).json({
            message: "Failed to record repayment. No partial update should be retained."
        });
    } finally {
        await session.endSession();
    }
});

module.exports = router;
