"use strict";

const BASE_URL =
    process.env.SANDBOX_API_BASE_URL ||
    "https://test-api.sandbox.co.in";

const API_VERSION =
    process.env.SANDBOX_API_VERSION || "1.0";

let cachedToken = null;
let tokenExpiry = 0;

// Get Sandbox access token
async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    const apiKey = process.env.SANDBOX_API_KEY;
    const apiSecret = process.env.SANDBOX_API_SECRET;

    if (!apiKey || !apiSecret) {
        throw new Error("Sandbox API credentials are missing.");
    }

    const response = await fetch(`${BASE_URL}/authenticate`, {
        method: "POST",
        headers: {
            accept: "application/json",
            "x-api-key": apiKey,
            "x-api-secret": apiSecret,
            "x-api-version": API_VERSION
        }
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error("Sandbox authentication failed.");
    }

    const token =
        result?.data?.access_token ||
        result?.access_token ||
        result?.data?.token;

    if (!token) {
        throw new Error("Sandbox access token was not returned.");
    }

    cachedToken = token;

    // Sandbox documents a 24-hour token validity.
    // Refresh slightly before expiry.
    tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);

    return cachedToken;
}

// Common Sandbox API request
async function sandboxRequest(path, options = {}) {
    const apiKey = process.env.SANDBOX_API_KEY;

    if (!apiKey) {
        throw new Error("Sandbox API key is missing.");
    }

    const token = await getAccessToken();

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            accept: "application/json",
            "content-type": "application/json",
            authorization: token,
            "x-api-key": apiKey,
            "x-api-version": API_VERSION,
            ...options.headers
        }
    });

    const responseText = await response.text();

    let result;

    try {
        result = responseText ? JSON.parse(responseText) : {};
    } catch {
        throw new Error("Sandbox returned an invalid response.");
    }

    if (!response.ok) {
        const error = new Error(
            result?.message || "Sandbox verification request failed."
        );

        error.status = response.status;
        throw error;
    }

    return result;
}

// PAN Verification
async function verifyPan({ pan, name, dob, consent }) {
    if (consent !== true && consent !== "Y" && consent !== "y") {
        throw new Error("User consent is required for PAN verification.");
    }

    return sandboxRequest("/kyc/pan/verify", {
        method: "POST",
        body: JSON.stringify({
            "@entity": "in.co.sandbox.kyc.pan_verification.request",
            pan: String(pan).trim().toUpperCase(),
            name_as_per_pan: String(name).trim(),
            date_of_birth: dob,
            consent: "Y",
            reason: "For MicroLoanX borrower onboarding"
        })
    });
}

// Bank Account Penny-less Verification
async function verifyBank({ accountNumber, ifsc }) {
    const cleanAccount = String(accountNumber).trim();
    const cleanIfsc = String(ifsc).trim().toUpperCase();

    const path =
        `/bank/${encodeURIComponent(cleanIfsc)}` +
        `/accounts/${encodeURIComponent(cleanAccount)}` +
        `/penniless-verify`;

    return sandboxRequest(path, {
        method: "GET"
    });
}

module.exports = {
    verifyPan,
    verifyBank
};