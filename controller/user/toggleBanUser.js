const { User } = require("../../models");

const toggleBanUser = async (req, res) => {
  try {
    const { user_id, is_ban } = req.body;

    // Validate required fields
    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id is required"
      });
    }

    if (is_ban === undefined || is_ban === null) {
      return res.status(400).json({
        status: false,
        message: "is_ban is required (true or false)"
      });
    }

    // Check if user exists
    const user = await User.findOne({
      where: { user_id }
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found"
      });
    }

    // Update ban status (using existing Blocked_by_admin field)
    await User.update(
      { Blocked_by_admin: is_ban },
      { where: { user_id } }
    );

    return res.status(200).json({
      status: true,
      message: is_ban ? "User has been banned successfully" : "User has been unbanned successfully",
      data: {
        user_id,
        is_ban
      }
    });

  } catch (error) {
    console.error("Error toggling ban status:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while updating ban status",
      error: error.message
    });
  }
};

module.exports = { toggleBanUser };
