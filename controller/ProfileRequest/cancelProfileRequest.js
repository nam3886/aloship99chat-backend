const { ProfileRequest, User } = require("../../models");

const cancelProfileRequest = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const { request_id } = req.params;

    const request = await ProfileRequest.findOne({
      where: { request_id }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    // Check ownership
    if (request.user_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to cancel this request"
      });
    }

    // Check if pending
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Can only cancel pending requests"
      });
    }

    // Update request status
    await ProfileRequest.update(
      {
        status: 'cancelled',
        processed_at: new Date(),
        processed_by: user_id // Driver cancelled themselves
      },
      {
        where: { request_id }
      }
    );

    // Update user's current_request_id if this was the current request
    const user = await User.findByPk(user_id);
    if (user.current_request_id === request_id) {
      await User.update(
        { current_request_id: null },
        { where: { user_id } }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Request cancelled successfully"
    });

  } catch (error) {
    console.error("Cancel Profile Request Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = { cancelProfileRequest };
