const { User, Notification, NotificationRead } = require("../../models");
const sequelize = require("../../models").sequelize;

const getViceAdminDetail = async (req, res) => {
  try {
    const userRole = req.authData.role;
    const { vice_admin_id } = req.params;

    // Check permissions
    if (userRole !== 'admin') {
      return res.status(403).json({
        status: false,
        message: "Only admin can access vice admin details"
      });
    }

    // Get vice admin
    const viceAdmin = await User.findOne({
      where: {
        user_id: vice_admin_id,
        role: 'vice_admin',
        is_account_deleted: false
      }
    });

    if (!viceAdmin) {
      return res.status(404).json({
        status: false,
        message: "Vice admin not found"
      });
    }

    // Get notification statistics
    const notificationStats = await Notification.findOne({
      where: { created_by: vice_admin_id },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('notification_id')), 'total_notifications']
      ],
      raw: true
    });

    // Format response
    const response = {
      user_id: viceAdmin.user_id,
      phone_number: viceAdmin.phone_number,
      email_id: viceAdmin.email_id,
      first_name: viceAdmin.first_name,
      last_name: viceAdmin.last_name,
      user_name: viceAdmin.user_name,
      profile_image: viceAdmin.profile_image,
      bio: viceAdmin.bio,
      gender: viceAdmin.gender,
      dob: viceAdmin.dob,
      country: viceAdmin.country,
      country_code: viceAdmin.country_code,
      is_blocked: viceAdmin.Blocked_by_admin,
      createdAt: viceAdmin.createdAt,
    };

    return res.status(200).json({
      status: true,
      message: "Vice admin details retrieved successfully",
      data: response
    });

  } catch (error) {
    console.error("Error getting vice admin details:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching vice admin details"
    });
  }
};

module.exports = { getViceAdminDetail };
