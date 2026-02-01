const { User, Notification, Order, ConversationsUser } = require("../../models");
const { Op } = require("sequelize");
const sequelize = require("../../models").sequelize;

const getViceAdminList = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const {
      page = 1,
      limit = 20,
      search,
      in_group
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = {
      role: 'vice_admin',
      is_account_deleted: false
    };

    // Add search filter
    if (search) {
      whereClause[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { phone_number: { [Op.like]: `%${search}%` } },
        { user_name: { [Op.like]: `%${search}%` } }
      ];
    }

    // Build include array
    let includeArray = [];

    // Filter by group membership if specified
    if (in_group !== undefined) {
      includeArray.push({
        model: ConversationsUser,
        where: { conversation_id: 1 },
        required: in_group === 'true'
      });
    }

    const viceAdmins = await User.findAndCountAll({
      where: whereClause,
      include: includeArray,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    // Get notification statistics for each vice admin
    const viceAdminIds = viceAdmins.rows.map(va => va.user_id);
    const notificationStats = await Notification.findAll({
      where: { created_by: viceAdminIds },
      attributes: [
        'created_by',
        [sequelize.fn('COUNT', sequelize.col('notification_id')), 'total_notifications']
      ],
      group: ['created_by'],
      raw: true
    });

    // Create a map for quick lookup
    const statsMap = {};
    notificationStats.forEach(stat => {
      statsMap[stat.created_by] = stat;
    });

    // Format the response
    const formattedViceAdmins = viceAdmins.rows.map(viceAdmin => {
      const viceAdminData = viceAdmin.get ? viceAdmin.get() : viceAdmin;

      return {
        user_id: viceAdminData.user_id,
        phone_number: viceAdminData.phone_number,
        user_name: viceAdminData.user_name,
        first_name: viceAdminData.first_name,
        last_name: viceAdminData.last_name,
        email_id: viceAdminData.email_id,
        gender: viceAdminData.gender,
        profile_image: viceAdminData.profile_image,
        avatar_id: viceAdminData.avatar_id,
        bio: viceAdminData.bio,
        role: viceAdminData.role,
        country: viceAdminData.country,
        country_code: viceAdminData.country_code,
        is_blocked: viceAdminData.Blocked_by_admin,
        createdAt: viceAdminData.createdAt,
        updatedAt: viceAdminData.updatedAt,
        notification_statistics: {
          total_notifications: parseInt(statsMap[viceAdminData.user_id]?.total_notifications || 0)
        },
        in_group: viceAdminData.ConversationsUsers ? viceAdminData.ConversationsUsers.length > 0 : false
      };
    });

    const totalPages = Math.ceil(viceAdmins.count / limit);

    return res.status(200).json({
      status: true,
      message: "Vice admins retrieved successfully",
      data: {
        vice_admins: formattedViceAdmins,
        pagination: {
          total: viceAdmins.count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages
        }
      }
    });

  } catch (error) {
    console.error("Error getting vice admin list:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching vice admins"
    });
  }
};

module.exports = { getViceAdminList };
