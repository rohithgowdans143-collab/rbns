
"use strict";

const API_BASE_URL = "https://rbns.onrender.com/api";

document.addEventListener("DOMContentLoaded", () => {

    // Password visibility controls
    document.querySelectorAll("[data-password-target]").forEach(button => {

        button.addEventListener("click", () => {

            const input = document.getElementById(
                button.dataset.passwordTarget
            );

            if (!input) return;

            const showPassword = input.type === "password";

            input.type = showPassword ? "text" : "password";

            button.setAttribute(
                "aria-pressed",
                String(showPassword)
            );

            button.setAttribute(
                "aria-label",
                showPassword ? "Hide password" : "Show password"
            );

            const icon = button.querySelector("i");

            if (icon) {
                icon.className = showPassword
                    ? "fa-regular fa-eye-slash"
                    : "fa-regular fa-eye";
            }
        });

    });


    // Support the login page's password toggle
    const loginToggle = document.getElementById("togglePassword");

    if (loginToggle) {

        loginToggle.addEventListener("click", () => {

            const input = document.getElementById("password");

            if (!input) return;

            const showPassword = input.type === "password";

            input.type = showPassword ? "text" : "password";

            loginToggle.setAttribute(
                "aria-pressed",
                String(showPassword)
            );

            loginToggle.setAttribute(
                "aria-label",
                showPassword ? "Hide password" : "Show password"
            );

            const icon = loginToggle.querySelector("i");

            if (icon) {
                icon.className = showPassword
                    ? "fa-regular fa-eye-slash"
                    : "fa-regular fa-eye";
            }
        });
    }


    // Restore an email only when the user opted in previously
    const emailInput = document.getElementById("email");
    const rememberCheckbox = document.getElementById("rememberMe");

    if (emailInput && rememberCheckbox) {

        try {

            const savedEmail = localStorage.getItem(
                "microloanx_remembered_email"
            );

            if (savedEmail) {
                emailInput.value = savedEmail;
                rememberCheckbox.checked = true;
            }

        } catch {
            // The application can still work if browser storage is disabled.
        }
    }


    // Reusable message display
    function showMessage(element, message, success = false) {

        if (!element) return;

        element.textContent = message;
        element.hidden = false;
        element.classList.toggle("success", success);
    }


    function setLoading(button, loading, label) {

        if (!button) return;

        button.disabled = loading;

        const span = button.querySelector("span");

        if (span) {
            span.textContent = loading ? "Please wait..." : label;
        }
    }


    // Safe API helper
    async function sendRequest(endpoint, payload) {

        
async function sendRequest(endpoint, payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(
            `${API_BASE_URL}${endpoint}`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message || "The request could not be completed."
            );
        }

        return data;
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error(
                "Login timed out. Please try again."
            );
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}


    // Login form
    const loginForm = document.getElementById("loginForm");

    if (loginForm) {

        loginForm.addEventListener("submit", async event => {

            event.preventDefault();

            const messageElement =
                document.getElementById("loginMessage");

            const button =
                document.getElementById("loginButton");

            const email = emailInput.value.trim().toLowerCase();

            const password =
                document.getElementById("password").value;

            messageElement.hidden = true;

            if (!email || !password) {

                showMessage(
                    messageElement,
                    "Please enter your email and password."
                );

                return;
            }

            if (!emailInput.validity.valid) {

                showMessage(
                    messageElement,
                    "Please enter a valid email address."
                );

                return;
            }

            setLoading(button, true, "Sign In");

            try {

                const result = await sendRequest(
                    "/auth/login",
                    { email, password }
                );

                if (rememberCheckbox) {

                    try {

                        if (rememberCheckbox.checked) {

                            localStorage.setItem(
                                "microloanx_remembered_email",
                                email
                            );

                        } else {

                            localStorage.removeItem(
                                "microloanx_remembered_email"
                            );

                        }

                    } catch {
                        // Remember-email is optional.
                    }
                }

                showMessage(
                    messageElement,
                    result.message || "Login successful. Opening your dashboard...",
                    true
                );

                window.location.assign("dashboard.html");

            } catch (error) {

                showMessage(
                    messageElement,
                    error.message || "Unable to sign in. Please try again."
                );

                setLoading(button, false, "Sign In");
            }

        });
    }


    // Registration form
    const registerForm = document.getElementById("registerForm");

    if (registerForm) {

        const passwordInput =
            document.getElementById("registerPassword");

        const confirmInput =
            document.getElementById("confirmPassword");

        registerForm.addEventListener("submit", async event => {

            event.preventDefault();

            const messageElement =
                document.getElementById("registerMessage");

            const button =
                document.getElementById("registerButton");

            const fullName =
                document.getElementById("fullName").value.trim();

            const businessName =
                document.getElementById("businessName").value.trim();

            const email =
                document.getElementById("registerEmail").value.trim().toLowerCase();

            const phone =
                document.getElementById("phone").value.trim();

            const language =
                document.getElementById("language").value;

            const password = passwordInput.value;

            const confirmPassword = confirmInput.value;

            const termsAccepted =
                document.getElementById("acceptTerms").checked;

            messageElement.hidden = true;

            if (
                fullName.length < 2 ||
                businessName.length < 1 ||
                !email ||
                !phone ||
                !password ||
                !confirmPassword
            ) {

                showMessage(
                    messageElement,
                    "Please complete all required fields."
                );

                return;
            }

            if (!registerForm.checkValidity()) {

                showMessage(
                    messageElement,
                    "Please check your name, email, mobile number and other fields."
                );

                return;
            }

            if (!/^[6-9]\d{9}$/.test(phone)) {

                showMessage(
                    messageElement,
                    "Enter a valid 10-digit Indian mobile number."
                );

                return;
            }

            if (
                password.length < 8 ||
                !/[A-Za-z]/.test(password) ||
                !/\d/.test(password)
            ) {

                showMessage(
                    messageElement,
                    "Use at least 8 characters, including a letter and a number."
                );

                return;
            }

            if (password !== confirmPassword) {

                showMessage(
                    messageElement,
                    "Your passwords do not match."
                );

                return;
            }

            if (!termsAccepted) {

                showMessage(
                    messageElement,
                    "Please accept the Terms of Use and Privacy Policy."
                );

                return;
            }

            setLoading(button, true, "Create Account");

            try {

                const result = await sendRequest(
                    "/auth/register",
                    {
                        fullName,
                        businessName,
                        email,
                        phone,
                        language,
                        password
                    }
                );

                showMessage(
                    messageElement,
                    result.message || "Account created successfully. Redirecting to login...",
                    true
                );

                window.setTimeout(() => {
                    window.location.assign("login.html");
                }, 900);

            } catch (error) {

                showMessage(
                    messageElement,
                    error.message || "Unable to create your account."
                );

                setLoading(button, false, "Create Account");
            }

        });
    }

});
