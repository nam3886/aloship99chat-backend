const jwt = require("jsonwebtoken");
const { User } = require("../models");

async function authMiddleware(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
        session_expired: true
      });
    }

    const authToken = authHeader.split(" ")[1];

    if (!authToken) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
        session_expired: true
      });
    }

    // Verify JWT token
    let jwtSecretKey = process.env.JWT_SECRET_KEY;
    const authData = jwt.verify(authToken, jwtSecretKey);

    // CRITICAL: Check if this token is the active session
    const user = await User.findOne({
      where: { user_id: authData.user_id },
      attributes: ['user_id', 'active_session_token', 'Blocked_by_admin', 'is_account_deleted']
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
        session_expired: true
      });
    }

    // Check if account is deleted
    if (user.is_account_deleted) {
      return res.status(403).json({
        success: false,
        message: "This account has been deleted",
        account_deleted: true
      });
    }

    // Check if blocked by admin
    if (user.Blocked_by_admin) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked",
        account_blocked: true
      });
    }

    // CRITICAL CHECK: Verify this token matches the active session
    if (user.active_session_token !== authToken) {
      return res.status(401).json({
        success: false,
        message: "You have been logged out because you logged in from another device",
        session_expired: true,
        logged_out_from_another_device: true
      });
    }

    // Token is valid and active, proceed
    req.authData = authData;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
        session_expired: true
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Token expired",
        session_expired: true
      });
    }

    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
      error: error.message
    });
  }
}

module.exports = authMiddleware;
