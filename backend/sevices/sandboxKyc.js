
"use strict";

const BASE_URL =
    process.env.SANDBOX_API_BASE_URL || "https://api.sandbox.co.in";

let cachedToken = null;
let tokenExpiry = 0;

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
            "accept": "application/json",
            "x-api-key": apiKey,
            "x-api-secret": apiSecret,
            "x-api-version": process.env.SANDBOX_API_VERSION || "1.0"
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
        throw new Error("Sandbox did not return an access token.");
    }

    cachedToken = token;
    tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);

    return cachedToken;
}

async function verifyPan({ pan, name, dob, consent }) {
    const token = await getAccessToken();

    const response = await fetch(`${BASE_URL}/kyc/pan/verify`, {
        method: "POST",
        headers: {
            "accept": "application/json",
            "content-type": "application/json",
            "authorization": token,
            "x-api-key": process.env.SANDBOX_API_KEY,
            "x-api-version": process.env.SANDBOX_API_VERSION || "1.0"
        },
        body: JSON.stringify({
            "@entity": "in.co.sandbox.kyc.pan_verification.request",
            pan,
            name_as_per_pan: name,
            date_of_birth: dob,
            consent,
            reason: "MicroLoanX borrower KYC verification"
        })
    });

    const result = await response.json();

    if (!response.ok) {
 a
"use strict";

const BASE_URL =
    process.env.SANDBOX_API_BASE_URL ||
    "https://test-api.sandbox.co.in";

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    const response = await fetch(`${BASE_URL}/authenticate`, {
        method: "POST",
        headers: {
            accept: "application/json",
            "x-api-key": process.env.SANDBOX_API_KEY,
            "x-api-secret": process.env.SANDBOX_API_SECRET,
            "x-api-version": process.env.SANDBOX_API_VERSION || "1.0"
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
        throw new Error("Sandbox access token missing.");
    }

    cachedToken = token;
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;

    return token;
}

async function sandboxRequest(path, options = {}) {
    const token = await getToken();

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            accept: "application/json",
            "content-type": "application/json",
            authorization: token,
            "x-api-key": process.env.SANDBOX_API_KEY,
            "x-api-version": process.env.SANDBOX_API_VERSION || "1.0",
            ...options.headers
        }
    });

    const result = await response.json();

    if (!response.ok) {
        const error = new Error("Sandbox verification request failed.");
        error.status = response.status;
        throw error;
    }

    return result;
}

async function verifyPan({ pan, name, dob }) {
    return sandboxRequest("/kyc/pan/verify", {
        method: "POST",
        body: JSON.stringify({
            "@entity": "in.co.sandbox.kyc.pan_verification.request",
            pan,
            name_as_per_pan: name,
            date_of_birth: dob,
            consent: "Y",
            reason: "For borrower onboarding"
        })
    });
}

async function verifyBank({ accountNumber, ifsc }) {
    const path =
        `/bank/${encodeURIComponent(ifsc)}` +
        `/accounts/${encodeURIComponent(accountNumber)}/penniless-verify`;

    return sandboxRequest(path, {
        method: "GET"
    });
}

module.exports = {
    verifyPan,
    verifyBank
};
