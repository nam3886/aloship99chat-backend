const { User, ConversationsUser, Order } = require("../../models");
const { Op } = require("sequelize");
const sequelize = require("../../models").sequelize;

const getDriverList = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const userRole = req.authData.role;
    const {
      page = 1,
      limit = 20,
      search,
      in_group
    } = req.query;

    // Check permissions
    if (userRole !== 'admin' && userRole !== 'vice_admin') {
      return res.status(403).json({
        status: false,
        message: "Only admin and vice admin can access driver list"
      });
    }

    const offset = (page - 1) * limit;
    let whereClause = {
      role: 'driver',
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

    // Build include array - profile and rating are auto-included via defaultScope
    let includeArray = [];

    // Filter by group membership if specified
    if (in_group !== undefined) {
      includeArray.push({
        model: ConversationsUser,
        where: { conversation_id: 1 },
        required: in_group === 'true'
      });
    }

    const drivers = await User.findAndCountAll({
      where: whereClause,
      include: includeArray,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    // Get order statistics for each driver
    const driverIds = drivers.rows.map(d => d.user_id);
    const orderStats = await Order.findAll({
      where: { assigned_driver_id: driverIds },
      attributes: [
        'assigned_driver_id',
        [sequelize.fn('COUNT', sequelize.col('order_id')), 'total_orders'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")), 'completed_orders'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END")), 'cancelled_orders']
      ],
      group: ['assigned_driver_id'],
      raw: true
    });

    // Create maps for quick lookup
    const statsMap = {};
    orderStats.forEach(stat => {
      statsMap[stat.assigned_driver_id] = stat;
    });

    // Format the response
    const formattedDrivers = drivers.rows.map(driver => {
      const driverData = driver.get ? driver.get() : driver;
      const profileData = driver.profile ? (driver.profile.get ? driver.profile.get() : driver.profile) : null;

      return {
        ...driverData,
        profile: profileData,
        rating: driver.rating,
        in_group: driverData.ConversationsUsers ? driverData.ConversationsUsers.length > 0 : false
      };
    });

    const totalPages = Math.ceil(drivers.count / limit);

    return res.status(200).json({
      status: true,
      message: "Drivers retrieved successfully",
      data: {
        drivers: formattedDrivers,
        pagination: {
          total: drivers.count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages
        }
      }
    });

  } catch (error) {
    console.error("Error getting driver list:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching drivers"
    });
  }
};

module.exports = { getDriverList };