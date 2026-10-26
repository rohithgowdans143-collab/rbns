
"use strict";

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const router = express.Router();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const SYSTEM_INSTRUCTIONS = `
You are MicroLoanX AI, a helpful assistant for small business
owners and vendors in India.

Help users with:
- Business budgeting and expense management
- Loan concepts and repayment planning
- Sales and cash-flow management
- Small-business growth ideas

Respond in English, Kannada, or Hindi, matching the user's language.
Be friendly, practical, and concise.

Never invent a user's account balances, loans, or transactions.
Do not guarantee loan approval.
Never ask for passwords, API keys, or OTPs.
`;

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

router.post("/chat", async (req, res) => {
    try {
        const question = req.body?.message;

        if (typeof question !== "string" || !question.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter a question."
            });
        }

        if (question.length > 2000) {
            return res.status(400).json({
                success: false,
                message: "Please keep your question under 2000 characters."
            });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({
                success: false,
                message: "Gemini API key is not configured."
            });
        }

        let interaction = null;
        const delays = [2000, 5000, 10000];

        for (let attempt = 0; attempt <= delays.length; attempt++) {
            try {
                interaction = await ai.interactions.create({
                    model: "gemini-3.8-flash",
                    input: question.trim(),
                    system_instruction: SYSTEM_INSTRUCTIONS
                });

                break;
            } catch (error) {
                const status = Number(error.status || error.code);
                const retryable = status === 503 || status === 429;

                if (!retryable || attempt === delays.length) {
                    throw error;
                }

                console.log(
                    `Gemini temporarily unavailable. Retry ${attempt + 1}/${delays.length} in ${delays[attempt] / 1000}s.`
                );

                await wait(delays[attempt]);
            }
        }

        const reply = interaction?.output_text;

        if (typeof reply !== "string" || !reply.trim()) {
            throw new Error("Gemini returned an empty response.");
        }

        return res.json({
            success: true,
            reply: reply.trim()
        });

    } catch (error) {
        console.error("MicroLoanX Gemini error:", {
            message: error.message,
            status: error.status,
            code: error.code
        });

        const status = Number(error.status || error.code);

        let message = "The AI assistant is temporarily unavailable. Please try again.";

        if (status === 429) {
            message = "Gemini's request limit or available quota has been reached. Please check your API usage and try again later.";
        } else if (status === 503) {
            message = "Gemini is experiencing high demand. Please try again later.";
        } else if (status === 401 || status === 403) {
            message = "Gemini rejected the API credentials or access. Please check your API key and project permissions.";
        } else if (status === 404) {
            message = "The configured Gemini model or API endpoint is unavailable. Please check the supported models.";
        }

        return res.status(502).json({
            success: false,
            message
        });
    }
});

module.exports = router;
