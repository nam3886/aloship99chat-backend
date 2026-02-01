const { ProfileRequest, User } = require("../../models");

// Get profile request detail
// Driver: can only view their own requests (404 if not owned)
// Admin/Vice Admin: can view any request
const getProfileRequestDetail = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const user_role = req.authData.role;
    const { request_id } = req.params;

    const request = await ProfileRequest.findOne({
      where: { request_id },
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['user_id', 'user_name', 'phone_number', 'first_name', 'last_name', 'gender', 'country_code'],
          required: true
        },
        {
          model: User,
          as: 'ProcessedBy',
          attributes: ['user_id', 'user_name', 'first_name', 'last_name'],
          required: false
        }
      ]
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    // If driver, check ownership - return 404 if not theirs
    if (user_role === 'driver' && request.user_id !== user_id) {
      return res.status(404).json({
        success: false,
        message: "Request not found"
      });
    }

    const formattedRequest = {
      request_id: request.request_id,
      status: request.status,

      // Driver info
      user_id: request.User.user_id,
      user_name: request.User.user_name,
      phone_number: request.User.phone_number,
      first_name: request.User.first_name,
      last_name: request.User.last_name,
      profile_image: request.profile_image,
      gender: request.User.gender,
      country_code: request.User.country_code,

      // Request data
      address: request.address,
      license_plate: request.license_plate,
      identification_front_image: request.identification_front_image,
      identification_back_image: request.identification_back_image,
      driving_license_image: request.driving_license_image,

      // Processing info
      notes: request.notes,
      created_at: request.created_at,
      processed_at: request.processed_at,
      processed_by: request.processed_by,
      processed_by_name: request.ProcessedBy ? request.ProcessedBy.user_name : null
    };

    return res.status(200).json({
      success: true,
      request: formattedRequest
    });

  } catch (error) {
    console.error("Get Profile Request Detail Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = { getProfileRequestDetail };
