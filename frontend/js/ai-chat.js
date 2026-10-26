
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("aiChatToggle");
    const panel = document.getElementById("aiChatPanel");
    const close = document.getElementById("aiChatClose");
    const form = document.getElementById("aiChatForm");
    const input = document.getElementById("aiChatInput");
    const send = document.getElementById("aiChatSend");
    const messages = document.getElementById("aiChatMessages");
    const status = document.getElementById("aiChatStatus");

    // Check that the chat HTML exists on the page.
    if (
        !toggle || !panel || !close || !form ||
        !input || !send || !messages || !status
    ) {
        console.error(
            "MicroLoanX AI: Chat elements missing. Check dashboard.html."
        );
        return;
    }

    const API_URL = "http://localhost:5000/api/ai/chat";
    const REQUEST_TIMEOUT_MS = 35000;

    let requestInProgress = false;

    function openChat() {
        panel.hidden = false;
        panel.setAttribute("aria-hidden", "false");
        toggle.setAttribute("aria-expanded", "true");
        input.focus();
    }

    function closeChat() {
        panel.hidden = true;
        panel.setAttribute("aria-hidden", "true");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
    }

    function addMessage(text, sender) {
        const message = document.createElement("div");

        message.className =
            "ai-chat-message " +
            (sender === "user" ? "ai-chat-user" : "ai-chat-bot");

        // Display text safely instead of interpreting it as HTML.
        message.textContent = text;

        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;

        return message;
    }

    function setStatus(text, type = "") {
        status.textContent = text;
        status.className = "ai-chat-status";

        if (type) {
            status.classList.add("ai-chat-" + type);
        }
    }

    async function askAI(question) {
        if (requestInProgress) return;

        requestInProgress = true;

        addMessage(question, "user");

        const waitingMessage = addMessage("Thinking...", "bot");

        send.disabled = true;
        input.disabled = true;

        setStatus("Connecting to MicroLoanX AI...");

        const controller = new AbortController();

        const timeoutId = setTimeout(() => {
            controller.abort();
        }, REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: question
                }),
                signal: controller.signal
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "The AI request failed."
                );
            }

            if (
                typeof data.reply !== "string" ||
                !data.reply.trim()
            ) {
                throw new Error("The AI returned an empty response.");
            }

            waitingMessage.textContent = data.reply;
            setStatus("Response received.", "success");

        } catch (error) {
            console.error("MicroLoanX chat error:", error.message);

            if (error.name === "AbortError") {
                waitingMessage.textContent =
                    "The request took too long. Please try again later.";

                setStatus(
                    "The AI may be busy or its quota may be exhausted.",
                    "error"
                );
            } else {
                waitingMessage.textContent =
                    "Sorry, I couldn't get an AI response.";

                setStatus(error.message, "error");
            }
        } finally {
            clearTimeout(timeoutId);

            requestInProgress = false;
            send.disabled = false;
            input.disabled = false;

            messages.scrollTop = messages.scrollHeight;
            input.focus();
        }
    }

    // Open and close the chat window.
    toggle.addEventListener("click", () => {
        if (panel.hidden) {
            openChat();
        } else {
            closeChat();
        }
    });

    close.addEventListener("click", closeChat);

    // Send a message.
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const question = input.value.trim();

        if (!question || requestInProgress) return;

        input.value = "";
        await askAI(question);
    });

    // Handle suggested questions.
    document.querySelectorAll(".ai-suggestion").forEach((button) => {
        button.addEventListener("click", async () => {
            if (requestInProgress) return;

            const question = button.dataset.question;

            if (!question) return;

            openChat();
            await askAI(question);
        });
    });

    // Enter sends; Shift + Enter adds a new line.
    input.addEventListener("keydown", (event) => {
        if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.isComposing
        ) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    console.log("MicroLoanX AI chat interface initialized.");
});
