
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

    const modalIds = [
        "loanModal",
        "repaymentModal"
    ];

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

    // Only authenticated API responses can supply actual records.
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

        badge.textContent = normalized.charAt(0).toUpperCase() +
            normalized.slice(1);

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

    function render() {

        $("welcomeTitle").textContent =
            `Welcome back${vendor?.fullName
                ? ", " + vendor.fullName.split(/\s+/)[0]
                : "!"}`;

        $("profileAvatar").textContent =
            (vendor?.fullName || "V").trim().charAt(0).toUpperCase();

        const outstanding = loans.reduce(
            (sum, loan) => sum + Number(loan.outstandingBalance ?? 0),
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
        $("reportNet").textContent = money(totalSales - totalExpenses);

        renderTable(
            "loanTableBody",
            loans,
            [
                { value: x => x.lenderName },
                { value: x => money(x.principalAmount) },
                { value: x => money(x.outstandingBalance) },
                { value: x => x.dueDate?.slice(0, 10) },
                { value: x => x.status, status: true }
            ],
            "No loans recorded yet."
        );

        renderTable(
            "repaymentTableBody",
            repayments,
            [
                { value: x => x.paymentDate?.slice(0, 10) },
                { value: x => x.lenderName },
                { value: x => money(x.amount) },
                { value: x => x.note || "Repayment" },
                { value: () => "Paid", status: true }
            ],
            "No repayments recorded yet."
        );

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

        // Populate the repayment loan selector.
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
                `${loan.lenderName} — ${money(loan.outstandingBalance)}`;
            selector.appendChild(option);
        });

        if ([...selector.options].some(
            option => option.value === previousValue
        )) {
            selector.value = previousValue;
        }
    }

    async function loadDashboard() {
        try {
            const data = await api("/dashboard");

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

    // Open and close dialogs.
    document.querySelectorAll("[data-open-modal]").forEach(button => {
        button.addEventListener("click", () => {
            const dialog = $(button.dataset.openModal);
            if (dialog && !dialog.open) dialog.showModal();
        });
    });

    document.querySelectorAll(".modal-close").forEach(button => {
        button.addEventListener("click", () => {
            button.closest("dialog")?.close();
        });
    });

    modalIds.forEach(id => {
        const dialog = $(id);

        dialog.addEventListener("click", event => {
            if (event.target === dialog) dialog.close();
        });
    });

    // Add a loan.
    $("loanForm").addEventListener("submit", async event => {
        event.preventDefault();

        const form = event.currentTarget;
        const amount = Number($("loanAmount").value);
        const rate = Number($("interestRate").value);
        const dueDate = $("loanDueDate").value;

        if (busy || !form.reportValidity()) return;

        if (
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount > 1000000000 ||
            !Number.isFinite(rate) ||
            rate < 0 ||
            rate > 100 ||
            dueDate < today()
        ) {
            feedback("loanFeedback", "Check the loan amount, interest rate and due date.", true);
            return;
        }

        busy = true;
        setBusy(form, true);

        try {
            await api("/loans", {
                method: "POST",
                body: JSON.stringify({
                    lenderName: $("lenderName").value.trim(),
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
            feedback("repaymentFeedback", "Please select a valid loan.", true);
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

    // Record daily sales or business expenses.
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
            feedback("salesFeedback", "Enter a valid amount and description.", true);
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
            feedback("expenseFeedback", "Enter a valid amount and description.", true);
            return;
        }

        setBusy(form, true);

        try {
            await saveTransaction("expense", amount, description);

            form.reset();
            feedback("expenseFeedback", "Expense recorded successfully.");
            showToast("Business expense saved.");
            await loadDashboard();

        } catch (error) {
            feedback("expenseFeedback", error.message, true);
        } finally {
            setBusy(form, false);
        }
    });

    // Export records to a CSV file.
    $("exportButton").addEventListener("click", () => {

        if (!transactions.length) {
            showToast("There are no transactions to export.", "error");
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
            new Blob([csv], { type: "text/csv;charset=utf-8;" })
        );

        const link = document.createElement("a");
        link.href = url;
        link.download = "microloanx-transactions.csv";
        link.click();

        URL.revokeObjectURL(url);
    });

    // Refresh from the server.
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

    document.querySelectorAll(".sidebar-link[data-section]").forEach(link => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".sidebar-link").forEach(item => {
                item.classList.remove("active");
            });

            link.classList.add("active");
            $("sidebar").classList.remove("open");
            $("sidebarToggle").setAttribute("aria-expanded", "false");
        });
    });

    // Language preference selector.
    $("languageSelector").addEventListener("change", event => {
        $("settingsLanguage").value = event.target.value;

        showToast(
            "Language selection saved for this screen. Full translations will be connected in a later step."
        );
    });

    $("settingsLanguage").addEventListener("change", event => {
        $("languageSelector").value = event.target.value;
    });

    // Notification placeholder.
    $("notificationButton").addEventListener("click", () => {
        showToast(
            "Repayment notifications will appear here when the reminder feature is connected."
        );
    });

    // Logout invalidates the server session.
    $("logoutButton").addEventListener("click", async () => {
        try {
            await api("/auth/logout", { method: "POST" });
        } catch {
            // Navigate away even if the session has already expired.
        }

        window.location.replace("login.html");
    });

    // Load real records from the authenticated backend.
    loadDashboard();

});
