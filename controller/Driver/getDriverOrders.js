const { Order, Chat, User } = require("../../models");
const { Op } = require("sequelize");

const getDriverOrders = async (req, res) => {
  try {
    const { driver_id } = req.params;
    const {
      status,
      page = 1,
      limit = 20,
      from_date,
      to_date,
      search
    } = req.query;

    // Check if driver exists
    const driver = await User.findOne({
      where: {
        user_id: driver_id,
        role: 'driver',
        is_account_deleted: false
      }
    });

    if (!driver) {
      return res.status(404).json({
        status: false,
        message: "Driver not found"
      });
    }

    const offset = (page - 1) * limit;
    let whereClause = { assigned_driver_id: driver_id };

    // Add status filter if provided
    // Support single status or multiple statuses separated by comma
    if (status) {
      const statusArray = status.split(',').map(s => s.trim());
      if (statusArray.length === 1) {
        whereClause.status = status;
      } else {
        whereClause.status = { [Op.in]: statusArray };
      }
    }

    // Add date range filter
    if (from_date || to_date) {
      whereClause.createdAt = {};

      if (from_date) {
        const startDate = new Date(from_date);
        startDate.setHours(0, 0, 0, 0);
        whereClause.createdAt[Op.gte] = startDate;
      }

      if (to_date) {
        const endDate = new Date(to_date);
        endDate.setHours(23, 59, 59, 999);
        whereClause.createdAt[Op.lte] = endDate;
      }
    }

    // Add search filter
    if (search) {
      whereClause[Op.or] = [
        { customer_name: { [Op.like]: `%${search}%` } },
        { delivery_location: { [Op.like]: `%${search}%` } },
        { note: { [Op.like]: `%${search}%` } },
        { driver_note: { [Op.like]: `%${search}%` } },
        { completed_delivery_location: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Chat,
          attributes: ['message_id', 'message', 'conversation_id', 'createdAt']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Format the response
    const formattedOrders = orders.map(order => ({
      order_id: order.order_id,
      status: order.status,
      customer_name: order.customer_name,
      delivery_location: order.delivery_location,
      note: order.note,
      cost: order.cost,
      completed_cost: order.completed_cost,
      completed_delivery_location: order.completed_delivery_location,
      driver_note: order.driver_note,
      chat_info: order.Chat ? {
        message_id: order.Chat.message_id,
        message: order.Chat.message,
        conversation_id: order.Chat.conversation_id,
        createdAt: order.Chat.createdAt,
        updatedAt: order.Chat.updatedAt
      } : null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      status: true,
      message: "Driver orders retrieved successfully",
      driver_info: {
        user_id: driver.user_id,
        name: `${driver.first_name} ${driver.last_name}`,
        phone_number: driver.phone_number
      },
      filters: {
        from_date,
        to_date,
        search,
        status
      },
      data: {
        orders: formattedOrders,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages
        }
      }
    });

  } catch (error) {
    console.error("Error getting driver orders:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching driver orders"
    });
  }
};

module.exports = { getDriverOrders };