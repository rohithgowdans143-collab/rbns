
"use strict";

/**
 * MicroLoanX identity-provider adapter.
 *
 * Connect this adapter to an authorized identity-verification provider
 * after obtaining its official API documentation and credentials.
 *
 * Never mark an identity verified based only on a frontend response.
 */

function isConfigured() {
  return (
    process.env.IDENTITY_PROVIDER_ENABLED === "true" &&
    Boolean(process.env.IDENTITY_PROVIDER_NAME) &&
    Boolean(process.env.IDENTITY_PROVIDER_API_URL) &&
    Boolean(process.env.IDENTITY_PROVIDER_API_KEY)
  );
}

function requireConfiguredProvider() {
  if (!isConfigured()) {
    const error = new Error(
      "Identity verification provider is not configured."
    );
    error.statusCode = 503;
    throw error;
  }
}

async function startVerification({ userId, consent }) {
  requireConfiguredProvider();

  if (!consent) {
    const error = new Error("User consent is required.");
    error.statusCode = 400;
    throw error;
  }

  /*
   * IMPLEMENTATION REQUIRED:
   * Use the selected provider's official API to create a verification
   * session for this authenticated user.
   *
   * The API URL, authentication scheme, request body, signature,
   * and response format must come from that provider's documentation.
   *
   * Do not send Aadhaar data to an arbitrary URL.
   * Do not log Aadhaar numbers, OTPs, API keys, or provider responses
   * containing personal data.
   */

  const error = new Error(
    "Provider API integration is pending. No OTP was sent."
  );
  error.statusCode = 503;
  throw error;
}

async function confirmVerification({ userId, sessionId, code }) {
  requireConfiguredProvider();

  if (
    typeof sessionId !== "string" ||
    !sessionId.trim() ||
    typeof code !== "string" ||
    !/^\d{4,8}$/.test(code)
  ) {
    const error = new Error("Invalid verification confirmation.");
    error.statusCode = 400;
    throw error;
  }

  /*
   * IMPLEMENTATION REQUIRED:
   * Validate the session and OTP using the official provider API.
   * Confirm the session belongs to this user.
   * Validate the provider's signed response or authenticated result.
   *
   * Never trust a frontend field such as verified: true.
   */

  const error = new Error(
    "Provider confirmation integration is pending. Identity remains unverified."
  );
  error.statusCode = 503;
  throw error;
}

module.exports = {
  isConfigured,
  startVerification,
  confirmVerification
};

