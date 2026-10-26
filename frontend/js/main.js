
"use strict";

document.addEventListener("DOMContentLoaded", () => {

    // Automatically update the copyright year
    const yearElement = document.getElementById("currentYear");

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }


    // Mobile navigation menu
    const menuToggle = document.getElementById("menuToggle");
    const navLinks = document.getElementById("navLinks");

    if (menuToggle && navLinks) {

        const menuIcon = menuToggle.querySelector("i");

        function closeMenu() {
            navLinks.classList.remove("open");
            menuToggle.setAttribute("aria-expanded", "false");

            if (menuIcon) {
                menuIcon.className = "fa-solid fa-bars";
            }
        }

        menuToggle.addEventListener("click", () => {

            const isOpen = navLinks.classList.toggle("open");

            menuToggle.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

            if (menuIcon) {
                menuIcon.className = isOpen
                    ? "fa-solid fa-xmark"
                    : "fa-solid fa-bars";
            }
        });

        navLinks.querySelectorAll("a").forEach(link => {
            link.addEventListener("click", closeMenu);
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeMenu();
            }
        });

        document.addEventListener("click", event => {
            if (
                navLinks.classList.contains("open") &&
                !navLinks.contains(event.target) &&
                !menuToggle.contains(event.target)
            ) {
                closeMenu();
            }
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 850) {
                closeMenu();
            }
        });
    }


    // Highlight the active navigation link
    const sections = document.querySelectorAll(
        "main section[id]"
    );

    const sectionLinks = document.querySelectorAll(
        '.nav-links a[href^="#"]'
    );

    if ("IntersectionObserver" in window) {

        const sectionObserver = new IntersectionObserver(
            entries => {

                entries.forEach(entry => {

                    if (!entry.isIntersecting) {
                        return;
                    }

                    sectionLinks.forEach(link => {

                        const isActive =
                            link.getAttribute("href") ===
                            "#" + entry.target.id;

                        link.classList.toggle("active", isActive);
                    });
                });

            },
            {
                rootMargin: "-20% 0px -65% 0px",
                threshold: 0
            }
        );

        sections.forEach(section => {
            sectionObserver.observe(section);
        });
    }


    // Reveal cards when they enter the viewport
    const revealElements = document.querySelectorAll(
        ".feature-card, .step-card, .about-card, .cta-card"
    );

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    if (
        !reducedMotion &&
        "IntersectionObserver" in window
    ) {

        revealElements.forEach(element => {
            element.classList.add("reveal");
        });

        const revealObserver = new IntersectionObserver(
            (entries, observer) => {

                entries.forEach(entry => {

                    if (entry.isIntersecting) {

                        entry.target.classList.add("revealed");

                        observer.unobserve(entry.target);
                    }
                });

            },
            {
                threshold: 0.12
            }
        );

        revealElements.forEach(element => {
            revealObserver.observe(element);
        });
    }

});
