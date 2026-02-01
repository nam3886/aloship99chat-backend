const { ProfileRequest, User } = require("../../models");
const { pushNotificationAlert } = require("../../reusable/pushNotificationAlert");

const rejectProfileRequest = async (req, res) => {
  try {
    const admin_id = req.authData.user_id;
    const { request_id } = req.params;
    const { notes } = req.body;

    // Validation
    if (!notes || notes.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "notes (rejection reason) is required"
      });
    }

    // Get request
    const request = await ProfileRequest.findOne({
      where: { request_id }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    // Check if pending
    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Can only reject pending requests"
      });
    }

    // Update request status
    await ProfileRequest.update(
      {
        status: 'rejected',
        notes,
        processed_by: admin_id,
        processed_at: new Date()
      },
      {
        where: { request_id }
      }
    );

    // Update user's current_request_id if this was the current request
    const user = await User.findByPk(request.user_id);
    if (user.current_request_id === request_id) {
      await User.update(
        { current_request_id: null },
        { where: { user_id: request.user_id } }
      );
    }

    // Send push notification
    try {
      await pushNotificationAlert(
        request.user_id,
        {
          title: "Profile Request Rejected",
          body: "Please check the reason and submit again",
          data: {
            type: 'profile_rejected',
            request_id: request_id,
            reason: notes
          }
        }
      );
    } catch (notifError) {
      console.error("Push notification error:", notifError);
      // Don't fail the request if notification fails
    }

    return res.status(200).json({
      success: true,
      message: "Request rejected"
    });

  } catch (error) {
    console.error("Reject Profile Request Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = { rejectProfileRequest };
