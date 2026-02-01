const { Order, User } = require("../../models");
const { Op } = require("sequelize");
const sequelize = require("../../models").sequelize;

const getStatistics = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const userRole = req.authData.role;
    const { driver_id, date_from, date_to } = req.query;

    // Determine which driver's statistics to fetch
    let targetDriverId;
    let isAllDrivers = false;

    if (userRole === 'driver') {
      // Drivers can only see their own statistics
      targetDriverId = user_id;
    } else if (userRole === 'admin' || userRole === 'vice_admin') {
      // Admin/Vice_admin can see specific driver or all drivers
      if (driver_id) {
        targetDriverId = driver_id;
      } else {
        // No driver_id specified = aggregate all drivers
        isAllDrivers = true;
      }
    } else {
      return res.status(403).json({
        status: false,
        message: "Access denied"
      });
    }

    // Build date filter
    let dateFilter = {};
    if (date_from && date_to) {
      // Always set from date to start of day (00:00:00.000)
      const fromDate = new Date(date_from);
      fromDate.setHours(0, 0, 0, 0);

      // Always set to date to end of day (23:59:59.999)
      const toDate = new Date(date_to);
      toDate.setHours(23, 59, 59, 999);

      dateFilter = {
        createdAt: {
          [Op.between]: [fromDate, toDate]
        }
      };
    } else if (date_from) {
      // From start of the from_date to now
      const fromDate = new Date(date_from);
      fromDate.setHours(0, 0, 0, 0);
      dateFilter = {
        createdAt: {
          [Op.gte]: fromDate
        }
      };
    } else if (date_to) {
      // From beginning to end of the to_date
      const toDate = new Date(date_to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter = {
        createdAt: {
          [Op.lte]: toDate
        }
      };
    }

    // Build where clause for statistics query
    let statsWhere = { ...dateFilter };

    if (!isAllDrivers) {
      // Get specific driver info
      const driver = await User.findOne({
        where: {
          user_id: targetDriverId,
          role: 'driver'
        },
        attributes: ['user_id', 'first_name', 'last_name', 'phone_number', 'profile_image'],
      });

      if (!driver) {
        return res.status(404).json({
          status: false,
          message: "Driver not found"
        });
      }

      statsWhere.assigned_driver_id = targetDriverId;
    }

    // Get total statistics (for specific driver or all drivers)
    const stats = await Order.findOne({
      where: statsWhere,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('order_id')), 'total_orders'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")), 'completed_orders'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END")), 'cancelled_orders'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'in_delivery' THEN 1 ELSE 0 END")), 'in_delivery_orders'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'assigned' THEN 1 ELSE 0 END")), 'assigned_orders'],
        [sequelize.fn('SUM', sequelize.col('completed_cost')), 'total_revenue']
      ],
      raw: true
    });

    // Get daily statistics breakdown
    const dailyStats = await Order.findAll({
      where: statsWhere,
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('order_id')), 'total_orders'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")), 'completed_orders'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END")), 'cancelled_orders'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'in_delivery' THEN 1 ELSE 0 END")), 'in_delivery_orders'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN status = 'assigned' THEN 1 ELSE 0 END")), 'assigned_orders'],
        [sequelize.fn('SUM', sequelize.col('completed_cost')), 'total_revenue']
      ],
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']],
      raw: true
    });

    // Format daily statistics
    const formattedDailyStats = dailyStats.map(dayStat => ({
      date: dayStat.date,
      total_orders: parseInt(dayStat.total_orders || 0),
      completed_orders: parseInt(dayStat.completed_orders || 0),
      cancelled_orders: parseInt(dayStat.cancelled_orders || 0),
      in_delivery_orders: parseInt(dayStat.in_delivery_orders || 0),
      assigned_orders: parseInt(dayStat.assigned_orders || 0),
      total_revenue: parseFloat(dayStat.total_revenue || 0)
    }));

    // Build response
    const response = {
      date_range: {
        from: date_from || null,
        to: date_to || null
      },
      statistics: {
        total_orders: parseInt(stats?.total_orders || 0),
        completed_orders: parseInt(stats?.completed_orders || 0),
        cancelled_orders: parseInt(stats?.cancelled_orders || 0),
        in_delivery_orders: parseInt(stats?.in_delivery_orders || 0),
        assigned_orders: parseInt(stats?.assigned_orders || 0),
        total_revenue: parseFloat(stats?.total_revenue || 0),
      },
      daily_statistics: formattedDailyStats,
    };

    // Add driver info only for specific driver queries
    if (!isAllDrivers) {
      const driver = await User.findOne({
        where: {
          user_id: targetDriverId,
          role: 'driver'
        },
        attributes: ['user_id', 'first_name', 'last_name', 'phone_number', 'profile_image'],
      });

      response.driver = {
        user_id: driver.user_id,
        first_name: driver.first_name,
        last_name: driver.last_name,
        phone_number: driver.phone_number
      };
    }

    return res.status(200).json({
      status: true,
      message: "Statistics retrieved successfully",
      data: response
    });

  } catch (error) {
    console.error("Error getting statistics:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching statistics",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = { getStatistics };
