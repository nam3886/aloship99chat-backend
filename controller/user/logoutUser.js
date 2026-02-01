const jwt = require("jsonwebtoken");
const { User, UserSocket } = require("../../models");

const logoutUser = async (req, res) => {
  try {
    const user_id = req.authData.user_id;

    // Clear active session token and device tokens
    await User.update(
      {
        device_token: "",
        one_signal_player_id: "",
        active_session_token: null // Clear the active session
      },
      {
        where: {
          user_id,
        },
      }
    );

    // Clear all socket connections for this user
    await UserSocket.destroy({
      where: { user_id }
    });

    res.status(200).json({
      success: true,
      message: "User logged out successfully",
    });
  } catch (error) {
    // Handle the Sequelize error and send it as a response to the client
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = { logoutUser };
