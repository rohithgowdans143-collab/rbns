
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

// The signed-in user can view their own KYC progress.
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

// Borrower controls whether permitted KYC details can be shared.
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

// Return only masked information, and only with borrower consent.
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
        message: "The borrower has not consented to share KYC details."
      });
    }

    const aadhaarStatus =
      statusOf(borrower.identityVerification);
    const panStatus = statusOf(borrower.panVerification);
    const bankStatus = statusOf(borrower.bankVerification);

    return res.json({
      borrower: {
        fullName: borrower.fullName,
        businessName: borrower.businessName
      },
      kyc: {
        aadhaar: {
          status: aadhaarStatus,
          verifiedAt:
            borrower.identityVerification?.verifiedAt || null
        },
        pan: {
          status: panStatus,
          verifiedAt:
            borrower.panVerification?.verifiedAt || null,
          maskedNumber:
            borrower.panVerification?.maskedNumber || ""
        },
        bank: {
          status: bankStatus,
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
