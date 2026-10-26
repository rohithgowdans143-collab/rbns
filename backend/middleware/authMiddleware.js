
"use strict";

const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
    const token = req.cookies?.microloanx_session;

    if (!token) {
        return res.status(401).json({
            message: "Please sign in to continue."
        });
    }

    try {
        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                algorithms: ["HS256"],
                issuer: "microloanx",
                audience: "microloanx-users"
            }
        );

        req.user = { id: payload.sub };
        next();

    } catch {
        return res.status(401).json({
            message: "Your session is invalid or expired."
        });
    }
}

module.exports = authMiddleware;
