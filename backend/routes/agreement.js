
"use strict";

const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");

const Loan = require("../models/loan");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// Accept or reject a loan agreement.
router.post("/:loanId/respond", protect, async (req, res) => {
    const { decision } = req.body || {};
    const { loanId } = req.params;

    if (
        !mongoose.isValidObjectId(loanId) ||
        !["accept", "reject"].includes(decision)
    ) {
        return res.status(400).json({
            message: "Provide a valid loan ID and decision."
        });
    }

    try {
        const loan = await Loan.findById(loanId);

        if (!loan) {
            return res.status(404).json({
                message: "Loan not found."
            });
        }

        const userId = String(req.user.id);
        const isLender = String(loan.lender || "") === userId;
        const isBorrower = String(loan.borrower || "") === userId;

        // Legacy loans have no linked borrower and cannot use this endpoint.
        if (!isLender && !isBorrower) {
            return res.status(403).json({
                message: "You are not a party to this loan."
            });
        }

        if (!loan.lender || !loan.borrower) {
            return res.status(409).json({
                message: "This older loan must be linked to both parties first."
            });
        }

        if (loan.agreement?.status === "accepted") {
            return res.status(409).json({
                message: "This agreement has already been accepted."
            });
        }

        if (loan.agreement?.status === "rejected") {
            return res.status(409).json({
                message: "This agreement has been rejected."
            });
        }

        if (decision === "reject") {
            loan.agreement.status = "rejected";

            loan.auditLog.push({
                action: "rejected",
                actor: req.user.id,
                details: "A party rejected the loan agreement."
            });

            await loan.save();

            return res.json({
                message: "Loan agreement rejected.",
                agreement: loan.agreement
            });
        }

        const terms = JSON.stringify({
            lender: String(loan.lender),
            borrower: String(loan.borrower),
            principalAmount: loan.principalAmount,
            interestRate: loan.interestRate,
            dueDate: loan.dueDate.toISOString(),
            note: loan.note || "",
            version: loan.agreement.version
        });

        const termsHash = crypto
            .createHash("sha256")
            .update(terms)
            .digest("hex");

        if (isLender) {
            loan.agreement.lenderAcceptedAt = new Date();

            loan.auditLog.push({
                action: "lender_accepted",
                actor: req.user.id,
                details: "Lender accepted the recorded loan terms."
            });
        }

        if (isBorrower) {
            loan.agreement.borrowerAcceptedAt = new Date();

            loan.auditLog.push({
                action: "borrower_accepted",
                actor: req.user.id,
                details: "Borrower accepted the recorded loan terms."
            });
        }

        loan.agreement.termsHash = termsHash;

        if (
            loan.agreement.lenderAcceptedAt &&
            loan.agreement.borrowerAcceptedAt
        ) {
            loan.agreement.status = "accepted";
        } else {
            loan.agreement.status = "pending";
        }

        await loan.save();

        return res.json({
            message: loan.agreement.status === "accepted"
                ? "Both parties have accepted the agreement."
                : "Your acceptance was recorded. Waiting for the other party.",
            agreement: loan.agreement
        });
    } catch (error) {
        console.error("Agreement response error:", error);

        return res.status(500).json({
            message: "Failed to update the loan agreement."
        });
    }
});

module.exports = router;
