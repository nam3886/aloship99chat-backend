const { ProfileRequest, User } = require("../../models");

// Get all profile requests (with filters)
// Driver: returns only their own requests
// Admin/Vice Admin: returns all requests with filters
const getAllProfileRequests = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const user_role = req.authData.role;
    const { status, page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {};

    // If driver, only show their own requests
    if (user_role === 'driver') {
      whereClause.user_id = user_id;
    }

    // Filter by status
    if (status) {
      whereClause.status = status;
    }

    const { count, rows: requests } = await ProfileRequest.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['user_id', 'user_name', 'phone_number', 'first_name', 'last_name'],
          required: true
        },
        {
          model: User,
          as: 'ProcessedBy',
          attributes: ['user_id', 'user_name', 'first_name', 'last_name'],
          required: false
        }
      ],
      order: [
        ['created_at', 'DESC']
      ],
      limit: parseInt(limit),
      offset: offset
    });

    const formattedRequests = requests.map(req => ({
      request_id: req.request_id,
      status: req.status,

      // Driver info
      user_id: req.User.user_id,
      user_name: req.User.user_name,
      phone_number: req.User.phone_number,
      first_name: req.User.first_name,
      last_name: req.User.last_name,
      profile_image: req.profile_image,

      // Request data
      address: req.address,
      license_plate: req.license_plate,

      // Processing info
      created_at: req.created_at,
      processed_at: req.processed_at,
      processed_by: req.processed_by,
      processed_by_name: req.ProcessedBy ? req.ProcessedBy.user_name : null
    }));

    return res.status(200).json({
      success: true,
      requests: formattedRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error("Get All Profile Requests Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = { getAllProfileRequests };
