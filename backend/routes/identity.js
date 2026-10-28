"use strict";

const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/user");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

function statusOf(check) {
    const allowed = [
        "not_started",
        "pending",
        "verified",
        "rejected"
    ];

    return allowed.includes(check?.status)
        ? check.status
        : "not_started";
}

// Get the signed-in user's KYC status.
router.get("/status", async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select(
                "identityVerification panVerification bankVerification kycSharingConsent"
            )
            .lean();

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        return res.json({
            kyc: {
                aadhaar: {
                    status: statusOf(user.identityVerification),
                    verifiedAt:
                        user.identityVerification?.verifiedAt || null
                },
                pan: {
                    status: statusOf(user.panVerification),
                    verifiedAt:
                        user.panVerification?.verifiedAt || null,
                    maskedNumber:
                        user.panVerification?.maskedNumber || ""
                },
                bank: {
                    status: statusOf(user.bankVerification),
                    verifiedAt:
                        user.bankVerification?.verifiedAt || null,
                    bankName:
                        user.bankVerification?.bankName || "",
                    maskedAccountNumber:
                        user.bankVerification?.maskedAccountNumber || ""
                },
                sharingConsent:
                    user.kycSharingConsent?.granted === true
            },
            providerConfigured:
                process.env.IDENTITY_PROVIDER_ENABLED === "true"
        });
    } catch (error) {
        console.error("KYC status error:", error.message);

        return res.status(500).json({
            message: "Unable to load KYC status."
        });
    }
});

// Start identity verification.
// A real identity provider must be configured before verification can start.
router.post("/start", async (req, res) => {
    try {
        if (process.env.IDENTITY_PROVIDER_ENABLED !== "true") {
            return res.status(503).json({
                message:
                    "Identity verification is not available yet. An authorized identity provider must be configured first."
            });
        }

        // Do not claim verification has started until a real provider
        // integration has been implemented.
        return res.status(503).json({
            message:
                "The identity provider is enabled, but its verification integration is not implemented yet. Please contact the administrator."
        });
    } catch (error) {
        console.error("Start KYC error:", error.message);

        return res.status(500).json({
            message: "Unable to start identity verification."
        });
    }
});

// Save or withdraw the borrower's KYC sharing consent.
router.post("/share-consent", async (req, res) => {
    try {
        const granted = req.body?.granted;

        if (typeof granted !== "boolean") {
            return res.status(400).json({
                message: "Provide granted as true or false."
            });
        }

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        user.kycSharingConsent = {
            granted,
            grantedAt: granted ? new Date() : null
        };

        await user.save();

        return res.json({
            message: granted
                ? "KYC sharing consent granted."
                : "KYC sharing consent withdrawn.",
            granted
        });
    } catch (error) {
        console.error("KYC consent error:", error.message);

        return res.status(500).json({
            message: "Unable to update KYC sharing consent."
        });
    }
});

// Return masked details only when the borrower has consented.
// Production use must also enforce the lender-borrower relationship.
router.get("/borrowers/:id/details", async (req, res) => {
    try {
        const borrowerId = req.params.id;

        if (!mongoose.isValidObjectId(borrowerId)) {
            return res.status(400).json({
                message: "Invalid borrower ID."
            });
        }

        if (String(req.user.id) === String(borrowerId)) {
            return res.status(400).json({
                message: "Use your own KYC status endpoint."
            });
        }

        const borrower = await User.findById(borrowerId)
            .select(
                "fullName businessName identityVerification panVerification bankVerification kycSharingConsent"
            )
            .lean();

        if (!borrower) {
            return res.status(404).json({
                message: "Borrower not found."
            });
        }

        if (borrower.kycSharingConsent?.granted !== true) {
            return res.status(403).json({
                message:
                    "The borrower has not consented to share KYC details."
            });
        }

        return res.json({
            borrower: {
                fullName: borrower.fullName,
                businessName: borrower.businessName
            },
            kyc: {
                aadhaar: {
                    status: statusOf(borrower.identityVerification),
                    verifiedAt:
                        borrower.identityVerification?.verifiedAt || null
                },
                pan: {
                    status: statusOf(borrower.panVerification),
                    verifiedAt:
                        borrower.panVerification?.verifiedAt || null,
                    maskedNumber:
                        borrower.panVerification?.maskedNumber || ""
                },
                bank: {
                    status: statusOf(borrower.bankVerification),
                    verifiedAt:
                        borrower.bankVerification?.verifiedAt || null,
                    bankName:
                        borrower.bankVerification?.bankName || "",
                    maskedAccountNumber:
                        borrower.bankVerification?.maskedAccountNumber || ""
                }
            }
        });
    } catch (error) {
        console.error("Borrower KYC details error:", error.message);

        return res.status(500).json({
            message: "Unable to load borrower KYC details."
        });
    }
});

module.exports = router;