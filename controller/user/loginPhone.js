const { User, UserSocket } = require("../../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const loginPhone = async (req, res) => {
  try {
    const { phone_number, password, device_token, one_signal_player_id } = req.body;

    // Validate required fields
    if (!phone_number || phone_number === "") {
      return res.status(400).json({
        success: false,
        message: "phone_number field is required!"
      });
    }

    if (!password || password === "") {
      return res.status(400).json({
        success: false,
        message: "password field is required!"
      });
    }

    // Find user by phone number
    const user = await User.findOne({
      where: { phone_number }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone number or password"
      });
    }

    // Check if account is deleted
    if (user.is_account_deleted) {
      return res.status(403).json({
        success: false,
        message: "This account has been deleted"
      });
    }

    // Check if blocked by admin
    if (user.Blocked_by_admin) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact admin."
      });
    }

    // Verify password - handle both bcrypt and plain text
    let isPasswordValid = false;

    // If user has no password set, accept default password 123456
    if (!user.password || user.password === '') {
      isPasswordValid = (password === '123456');
    } else if (user.password === '123456' || user.password === password) {
      // Check plain text password (for default or temporary passwords)
      isPasswordValid = true;
    } else {
      // Try bcrypt comparison for hashed passwords
      try {
        if (user.password.startsWith('$2')) { // bcrypt hash starts with $2
          isPasswordValid = await bcrypt.compare(password, user.password);
        } else {
          isPasswordValid = false;
        }
      } catch (err) {
        isPasswordValid = false;
      }
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone number or password"
      });
    }

    // Generate JWT token with timestamp for uniqueness
    const tokenData = {
      user_id: user.user_id,
      phone_number: user.phone_number,
      role: user.role,
      login_timestamp: Date.now() // Makes each token unique
    };

    const token = jwt.sign(tokenData, process.env.JWT_SECRET_KEY);

    // Get device info (optional, for logging)
    const deviceInfo = device_token ? 'Mobile' : 'Web';

    // Update user with new active session token
    await User.update(
      {
        active_session_token: token, // Store the active token
        last_login_at: new Date(),
        last_login_device: deviceInfo,
        device_token: device_token || user.device_token,
        one_signal_player_id: one_signal_player_id || user.one_signal_player_id,
        is_mobile: device_token ? true : user.is_mobile
      },
      {
        where: { user_id: user.user_id }
      }
    );

    // Force disconnect any existing socket connections
    // This handles the case where old device is still connected
    try {
      const existingSockets = await UserSocket.findAll({
        where: { user_id: user.user_id }
      });

      if (existingSockets.length > 0) {
        // Try to get socket service and emit force-logout
        try {
          const socketService = require("../../reusable/socketService");
          const io = socketService.getIo();

          for (const userSocket of existingSockets) {
            io.to(userSocket.socketId).emit("force-logout", {
              message: "You have been logged out because you logged in from another device.",
              timestamp: new Date()
            });

            const socket = io.sockets.sockets.get(userSocket.socketId);
            if (socket) {
              socket.disconnect(true);
            }
          }
        } catch (socketErr) {
          console.log("Socket service not available or no active connections");
        }

        // Delete all existing socket entries
        await UserSocket.destroy({
          where: { user_id: user.user_id }
        });

        console.log(`✅ Forced logout user ${user.user_id} from ${existingSockets.length} device(s)`);
      }
    } catch (err) {
      console.log("Error cleaning up old sockets:", err.message);
      // Continue anyway - the middleware will handle session validation
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: token,
      resData: user
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred during login",
      error: error.message
    });
  }
};

module.exports = { loginPhone };