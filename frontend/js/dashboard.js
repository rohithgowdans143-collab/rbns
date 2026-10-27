"use strict";

const API_BASE_URL = "https://rbns.onrender.com/api";

document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);

    const money = amount =>
        new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(Number(amount) || 0);

    const today = () => {
        const date = new Date();
        const offset = date.getTimezoneOffset();
        return new Date(date.getTime() - offset * 60000)
            .toISOString()
            .slice(0, 10);
    };

    $("dashboardYear").textContent = new Date().getFullYear();

    $("saleAmount").max = "1000000000";
    $("expenseAmount").max = "1000000000";

    $("saleDescription").required = true;
    $("expenseDescription").required = true;

    $("loanDueDate").min = today();
    $("repaymentDate").max = today();
    $("loanDueDate").value = today();
    $("repaymentDate").value = today();

    let loans = [];
    let repayments = [];
    let transactions = [];
    let sales = [];
    let expenses = [];
    let vendor = null;
    let busy = false;

    const modalIds = ["loanModal", "repaymentModal"];

    function showToast(message, type = "success") {
        const container = $("toastContainer");
        const toast = document.createElement("div");

        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        window.setTimeout(() => toast.remove(), 4000);
    }

    function feedback(id, message, error = false) {
        const element = $(id);
        element.textContent = message;
        element.style.color = error ? "#ff9cae" : "#43e6a4";
    }

    function setBusy(form, value) {
        form.querySelectorAll('button[type="submit"]').forEach(button => {
            button.disabled = value;
        });
    }

    async function api(path, options = {}) {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            credentials: "include",
            headers: {
                ...(options.body ? {
                    "Content-Type": "application/json"
                } : {}),
                ...options.headers
            }
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            window.location.replace("login.html");
            throw new Error("Your session has expired.");
        }

        if (!response.ok) {
            throw new Error(
                data.message || "The request could not be completed."
            );
        }

        return data;
    }

    function addCell(row, value) {
        const cell = document.createElement("td");
        cell.textContent = value ?? "—";
        row.appendChild(cell);
        return cell;
    }

    function statusBadge(status) {
        const badge = document.createElement("span");
        const normalized = String(status || "pending").toLowerCase();

        badge.className = "status-pill " +
            (normalized === "paid" || normalized === "completed"
                ? "status-paid"
                : normalized === "overdue"
                    ? "status-overdue"
                    : "status-pending");

        badge.textContent =
            normalized.charAt(0).toUpperCase() + normalized.slice(1);

        return badge;
    }

    function renderTable(bodyId, rows, columns, emptyMessage) {
        const body = $(bodyId);
        body.replaceChildren();

        if (!rows.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = columns.length;
            cell.className = "empty-cell";
            cell.textContent = emptyMessage;

            row.appendChild(cell);
            body.appendChild(row);
            return;
        }

        rows.forEach(item => {
            const row = document.createElement("tr");

            columns.forEach(column => {
                const cell = document.createElement("td");
                const value = column.value(item);

                if (column.status) {
                    cell.appendChild(statusBadge(value));
                } else {
                    cell.textContent = value ?? "—";
                }

                row.appendChild(cell);
            });

            body.appendChild(row);
        });
    }

    // Display loans, repayments, sales and expenses.
    function render() {
        $("welcomeTitle").textContent =
            `Welcome back${vendor?.fullName
                ? ", " + vendor.fullName.split(/\s+/)[0]
                : "!"}`;

        $("profileAvatar").textContent =
            (vendor?.fullName || "V").trim().charAt(0).toUpperCase();

        const outstanding = loans.reduce(
            (sum, loan) =>
                sum + Number(loan.outstandingBalance ?? 0),
            0
        );

        const totalRepaid = repayments.reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
        );

        const totalSales = sales.reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
        );

        const totalExpenses = expenses.reduce(
            (sum, item) => sum + Number(item.amount || 0),
            0
        );

        $("outstandingTotal").textContent = money(outstanding);
        $("repaidTotal").textContent = money(totalRepaid);
        $("salesTotal").textContent = money(totalSales);
        $("expensesTotal").textContent = money(totalExpenses);

        $("reportSales").textContent = money(totalSales);
        $("reportExpenses").textContent = money(totalExpenses);
        $("reportNet").textContent =
            money(totalSales - totalExpenses);

        // Loans table: eight columns.
        const loanBody = $("loanTableBody");
        loanBody.replaceChildren();

        if (!loans.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 8;
            cell.className = "empty-cell";
            cell.textContent = "No loans recorded yet.";

            row.appendChild(cell);
            loanBody.appendChild(row);
            
row.style.cursor = "pointer";
row.title = "Click to view borrower details";

row.addEventListener("click", event => {
    // Do not open the identity panel when an agreement button is clicked.
    if (event.target.closest("button")) return;

    const borrower =
        loan.borrower && typeof loan.borrower === "object"
            ? loan.borrower
            : {};

    const nameElement = $("identityName");
    const phoneElement = $("identityPhone");
    const businessElement = $("identityBusiness");
    const statusElement = $("identityStatus");

    if (nameElement) {
        nameElement.textContent =
            loan.borrowerName || borrower.fullName || "Not available";
    }

    if (phoneElement) {
        phoneElement.textContent =
            loan.borrowerPhone || borrower.phone || "Not available";
    }

    if (businessElement) {
        businessElement.textContent =
            borrower.businessName || "Not available";
    }

    if (statusElement) {
        const status = borrower.identityVerification?.status || "not_started";

        const labels = {
            verified: "Verified",
            pending: "Verification pending",
            rejected: "Verification rejected",
            not_started: "Not verified"
        };

        statusElement.textContent = labels[status] || "Not verified";
    }

    $("borrowerIdentity")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
});

        } else {
            loans.forEach(loan => {
                const row = document.createElement("tr");

                addCell(row, loan.lenderName);
                addCell(row, loan.borrowerName || "—");
                addCell(row, money(loan.principalAmount));
                addCell(row, money(loan.outstandingBalance));
                addCell(row, loan.dueDate?.slice(0, 10));

                const statusCell = document.createElement("td");
                statusCell.appendChild(statusBadge(loan.status));
                row.appendChild(statusCell);

                const agreementStatus =
                    loan.agreement?.status || "pending";

                const agreementCell = document.createElement("td");
                agreementCell.appendChild(statusBadge(agreementStatus));
                row.appendChild(agreementCell);

                const actionsCell = document.createElement("td");

                const isLender =
                    String(loan.lender) === String(vendor?._id);

                const isBorrower =
                    String(loan.borrower) === String(vendor?._id);

                if (
                    (isLender || isBorrower) &&
                    agreementStatus !== "accepted" &&
                    agreementStatus !== "rejected"
                ) {
                    const acceptButton =
                        document.createElement("button");

                    acceptButton.type = "button";
                    acceptButton.textContent = "Accept";

                    acceptButton.addEventListener("click", () => {
                        respondToAgreement(loan._id, "accept");
                    });

                    actionsCell.appendChild(acceptButton);

                    const rejectButton =
                        document.createElement("button");

                    rejectButton.type = "button";
                    rejectButton.textContent = "Reject";
                    rejectButton.style.marginLeft = "6px";

                    rejectButton.addEventListener("click", () => {
                        respondToAgreement(loan._id, "reject");
                    });

                    actionsCell.appendChild(rejectButton);
                } else {
                    actionsCell.textContent =
                        agreementStatus === "accepted"
                            ? "Agreed"
                            : agreementStatus === "rejected"
                                ? "Rejected"
                                : "Awaiting response";
                }

                row.appendChild(actionsCell);
                loanBody.appendChild(row);
            });
        }

        // Repayment history.
        renderTable(
            "repaymentTableBody",
            repayments,
            [
                { value: x => x.paymentDate?.slice(0, 10) },
                {
                    value: x =>
                        x.lenderName && x.borrowerName
                            ? `${x.lenderName} / ${x.borrowerName}`
                            : x.lenderName || x.borrowerName || "—"
                },
                { value: x => money(x.amount) },
                { value: x => x.note || "Repayment" },
                { value: () => "Paid", status: true }
            ],
            "No repayments recorded yet."
        );

        // Sales and expense transactions.
        renderTable(
            "transactionTableBody",
            transactions,
            [
                { value: x => x.date?.slice(0, 10) },
                { value: x => x.type },
                { value: x => x.description },
                { value: x => money(x.amount) }
            ],
            "No transactions recorded yet."
        );

        // Populate repayment selector.
        const selector = $("repaymentLoan");
        const previousValue = selector.value;

        selector.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Choose a loan";
        selector.appendChild(placeholder);

        loans.filter(loan =>
            Number(loan.outstandingBalance) > 0
        ).forEach(loan => {
            const option = document.createElement("option");
            option.value = loan._id;

            option.textContent =
                `${loan.lenderName || loan.borrowerName || "Loan"} — ` +
                money(loan.outstandingBalance);

            selector.appendChild(option);
        });

        if ([...selector.options].some(
            option => option.value === previousValue
        )) {
            selector.value = previousValue;
        }
    }

    // Load dashboard records from the backend.
    async function loadDashboard() {
        try {
            const data = await api("/loans/dashboard");

            vendor = data.vendor;
            loans = data.loans || [];
            repayments = data.repayments || [];
            transactions = data.transactions || [];
            sales = data.sales || [];
            expenses = data.expenses || [];

            render();
        } catch (error) {
            if (error.message !== "Your session has expired.") {
                showToast(error.message, "error");
            }
        }
    }

    // Load registered users for the borrower dropdown.
    async function loadBorrowers() {
        const selector = $("borrowerSelect");

        if (!selector) return;

        try {
            const data = await api("/loans/borrowers");

            selector.replaceChildren();

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "Select a borrower";
            selector.appendChild(placeholder);

            (data.borrowers || []).forEach(borrower => {
                const option = document.createElement("option");
                option.value = borrower.id;

                const name = borrower.fullName || "Unnamed user";
                const business = borrower.businessName
                    ? ` (${borrower.businessName})`
                    : "";

                option.textContent = name + business;
                selector.appendChild(option);
            });

            if (!data.borrowers || data.borrowers.length === 0) {
                placeholder.textContent =
                    "No other registered users found";
            }
        } catch (error) {
            selector.replaceChildren();

            const option = document.createElement("option");
            option.value = "";
            option.textContent = "Could not load borrowers";
            selector.appendChild(option);

            showToast(error.message, "error");
        }
    }

    // Accept or reject a loan agreement.
    async function respondToAgreement(loanId, decision) {
        const confirmed = window.confirm(
            `Are you sure you want to ${decision} this loan agreement?`
        );

        if (!confirmed) return;

        try {
            await api(
                `/agreements/${encodeURIComponent(loanId)}/respond`,
                {
                    method: "POST",
                    body: JSON.stringify({ decision })
                }
            );

            showToast(`Agreement response recorded: ${decision}.`);
            await loadDashboard();
        } catch (error) {
            showToast(error.message, "error");
        }
    }

    // Open dialogs.
    document.querySelectorAll("[data-open-modal]").forEach(button => {
        button.addEventListener("click", () => {
            const dialog = $(button.dataset.openModal);

            if (dialog && !dialog.open) {
                dialog.showModal();
            }
        });
    });

    // Close dialogs.
    document.querySelectorAll(".modal-close").forEach(button => {
        button.addEventListener("click", () => {
            button.closest("dialog")?.close();
        });
    });

    modalIds.forEach(id => {
        const dialog = $(id);

        if (dialog) {
            dialog.addEventListener("click", event => {
                if (event.target === dialog) dialog.close();
            });
        }
    });

    // Create a loan.
    $("loanForm").addEventListener("submit", async event => {
        event.preventDefault();

        const form = event.currentTarget;
        const amount = Number($("loanAmount").value);
        const rate = Number($("interestRate").value);
        const dueDate = $("loanDueDate").value;
        const borrowerId = $("borrowerSelect").value;

        if (busy || !form.reportValidity()) return;

        if (
            !borrowerId ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount > 1000000000 ||
            !Number.isFinite(rate) ||
            rate < 0 ||
            rate > 100 ||
            dueDate < today()
        ) {
            feedback(
                "loanFeedback",
                "Check the borrower, amount, interest rate and due date.",
                true
            );
            return;
        }

        busy = true;
        setBusy(form, true);

        try {
            await api("/loans", {
                method: "POST",
                body: JSON.stringify({
                    borrowerId,
                    principalAmount: amount,
                    interestRate: rate,
                    dueDate,
                    note: $("loanNote").value.trim()
                })
            });

            form.reset();
            $("loanDueDate").value = today();
            $("interestRate").value = "0";
            $("loanModal").close();

            showToast("Loan recorded successfully.");
            await loadDashboard();
            await loadBorrowers();
        } catch (error) {
            feedback("loanFeedback", error.message, true);
        } finally {
            busy = false;
            setBusy(form, false);
        }
    });

    // Record a repayment.
    $("repaymentForm").addEventListener("submit", async event => {
        event.preventDefault();

        const form = event.currentTarget;
        const amount = Number($("repaymentAmount").value);
        const loanId = $("repaymentLoan").value;
        const paymentDate = $("repaymentDate").value;

        if (busy || !form.reportValidity()) return;

        const loan = loans.find(item => item._id === loanId);

        if (!loan) {
            feedback(
                "repaymentFeedback",
                "Please select a valid loan.",
                true
            );
            return;
        }

        if (
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount > Number(loan.outstandingBalance) ||
            paymentDate > today()
        ) {
            feedback(
                "repaymentFeedback",
                "Check the payment amount and date. The amount cannot exceed the current balance.",
                true
            );
            return;
        }

        busy = true;
        setBusy(form, true);

        try {
            await api("/repayments", {
                method: "POST",
                body: JSON.stringify({
                    loanId,
                    amount,
                    paymentDate,
                    note: $("repaymentNote").value.trim()
                })
            });

            form.reset();
            $("repaymentDate").value = today();
            $("repaymentModal").close();

            showToast("Repayment recorded successfully.");
            await loadDashboard();
        } catch (error) {
            feedback("repaymentFeedback", error.message, true);
        } finally {
            busy = false;
            setBusy(form, false);
        }
    });

    // Save a sale or expense.
    async function saveTransaction(type, amount, description) {
        return api("/transactions", {
            method: "POST",
            body: JSON.stringify({
                type,
                amount,
                description,
                date: today()
            })
        });
    }

    // Record daily sales.
    $("salesForm").addEventListener("submit", async event => {
        event.preventDefault();

        const form = event.currentTarget;
        const amount = Number($("saleAmount").value);
        const description = $("saleDescription").value.trim();

        if (!form.reportValidity()) return;

        if (
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount > 1000000000 ||
            !description
        ) {
            feedback(
                "salesFeedback",
                "Enter a valid amount and description.",
                true
            );
            return;
        }

        setBusy(form, true);

        try {
            await saveTransaction("sale", amount, description);

            form.reset();
            feedback("salesFeedback", "Sale recorded successfully.");
            showToast("Daily sale saved.");
            await loadDashboard();
        } catch (error) {
            feedback("salesFeedback", error.message, true);
        } finally {
            setBusy(form, false);
        }
    });

    // Record business expenses.
    $("expenseForm").addEventListener("submit", async event => {
        event.preventDefault();

        const form = event.currentTarget;
        const amount = Number($("expenseAmount").value);
        const description = $("expenseDescription").value.trim();

        if (!form.reportValidity()) return;

        if (
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount > 1000000000 ||
            !description
        ) {
            feedback(
                "expenseFeedback",
                "Enter a valid amount and description.",
                true
            );
            return;
        }

        setBusy(form, true);

        try {
            await saveTransaction("expense", amount, description);

            form.reset();
            feedback(
                "expenseFeedback",
                "Expense recorded successfully."
            );
            showToast("Business expense saved.");
            await loadDashboard();
        } catch (error) {
            feedback("expenseFeedback", error.message, true);
        } finally {
            setBusy(form, false);
        }
    });

    // Export transactions as CSV.
    $("exportButton").addEventListener("click", () => {
        if (!transactions.length) {
            showToast(
                "There are no transactions to export.",
                "error"
            );
            return;
        }

        const escapeCSV = value =>
            '"' + String(value ?? "").replace(/"/g, '""') + '"';

        const rows = [
            ["Date", "Type", "Description", "Amount"],
            ...transactions.map(item => [
                item.date?.slice(0, 10),
                item.type,
                item.description,
                item.amount
            ])
        ];

        const csv = "\uFEFF" + rows
            .map(row => row.map(escapeCSV).join(","))
            .join("\r\n");

        const url = URL.createObjectURL(
            new Blob([csv], {
                type: "text/csv;charset=utf-8;"
            })
        );

        const link = document.createElement("a");
        link.href = url;
        link.download = "microloanx-transactions.csv";
        link.click();

        URL.revokeObjectURL(url);
    });

    // Refresh dashboard.
    $("refreshButton").addEventListener("click", loadDashboard);

    // Mobile sidebar.
    $("sidebarToggle").addEventListener("click", () => {
        const sidebar = $("sidebar");
        const open = sidebar.classList.toggle("open");

        $("sidebarToggle").setAttribute(
            "aria-expanded",
            String(open)
        );
    });

    // Sidebar navigation.
    document.querySelectorAll(
        ".sidebar-link[data-section]"
    ).forEach(link => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".sidebar-link").forEach(item => {
                item.classList.remove("active");
            });

            link.classList.add("active");
            $("sidebar").classList.remove("open");
            $("sidebarToggle").setAttribute(
                "aria-expanded",
                "false"
            );
        });
    });

    // Language selector.
    $("languageSelector").addEventListener("change", event => {
        $("settingsLanguage").value = event.target.value;

        showToast(
            "Language selection saved for this screen. Full translations will be connected in a later step."
        );
    });

    $("settingsLanguage").addEventListener("change", event => {
        $("languageSelector").value = event.target.value;
    });

    // Notifications placeholder.
    $("notificationButton").addEventListener("click", () => {
        showToast(
            "Repayment notifications will appear here when the reminder feature is connected."
        );
    });

    // Logout.
    $("logoutButton").addEventListener("click", async () => {
        try {
            await api("/auth/logout", { method: "POST" });
        } catch {
            // Navigate away even if the session has expired.
        }

        window.location.replace("login.html");
    });

    // Load data when the page opens.
    loadDashboard();
    loadBorrowers();
});