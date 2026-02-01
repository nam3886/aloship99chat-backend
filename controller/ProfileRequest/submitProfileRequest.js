const { ProfileRequest, User } = require("../../models");

const submitProfileRequest = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const {
      address,
      license_plate,
      identification_front_image,
      identification_back_image,
      driving_license_image,
      profile_image
    } = req.body;

    // Validation
    if (!address) {
      return res.status(400).json({
        success: false,
        message: "address is required"
      });
    }
    if (!license_plate) {
      return res.status(400).json({
        success: false,
        message: "license_plate is required"
      });
    }
    if (!identification_front_image) {
      return res.status(400).json({
        success: false,
        message: "identification_front_image is required"
      });
    }
    if (!identification_back_image) {
      return res.status(400).json({
        success: false,
        message: "identification_back_image is required"
      });
    }
    if (!driving_license_image) {
      return res.status(400).json({
        success: false,
        message: "driving_license_image is required"
      });
    }
    if (!profile_image) {
      return res.status(400).json({
        success: false,
        message: "profile_image is required"
      });
    }

    // Get user
    const user = await User.findByPk(user_id);

    // Check if profile already approved
    if (user.is_profile_approved) {
      return res.status(400).json({
        success: false,
        message: "Profile already approved. Cannot submit new request."
      });
    }

    // Check if has pending request
    const pendingRequest = await ProfileRequest.findOne({
      where: {
        user_id,
        status: 'pending'
      }
    });

    if (pendingRequest) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending request"
      });
    }

    // Create new request
    const newRequest = await ProfileRequest.create({
      user_id,
      address,
      license_plate,
      identification_front_image,
      identification_back_image,
      driving_license_image,
      profile_image,
      status: 'pending'
    });

    // Update user's current_request_id
    await User.update(
      { current_request_id: newRequest.request_id },
      { where: { user_id } }
    );

    return res.status(201).json({
      success: true,
      message: "Profile request submitted successfully",
      request_id: newRequest.request_id,
      status: newRequest.status
    });

  } catch (error) {
    console.error("Submit Profile Request Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = { submitProfileRequest };
