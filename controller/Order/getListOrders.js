const { Order, Chat, User } = require("../../models");
const { Op } = require("sequelize");

const getListOrders = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const userRole = req.authData.role;
    const {
      status,
      page,
      limit,
      order_id,
      from_date,
      to_date,
      search
    } = req.query;

    // If page and limit are not provided, return all orders
    const shouldPaginate = page !== undefined && limit !== undefined;
    const offset = shouldPaginate ? (page - 1) * limit : 0;

    let whereClause = {};

    // Role-based filtering - only admin and vice_admin
    // if (userRole !== 'admin' && userRole !== 'vice_admin') {
    //   return res.status(403).json({
    //     status: false,
    //     message: "Only admin and vice admin can access this endpoint"
    //   });
    // }

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

    // Add specific order_id filter if provided
    if (order_id) {
      whereClause.order_id = order_id;
    }

    // Add date range filter
    if (from_date || to_date) {
      whereClause.createdAt = {};

      if (from_date) {
        // Set start of day for from_date
        const startDate = new Date(from_date);
        startDate.setHours(0, 0, 0, 0);
        whereClause.createdAt[Op.gte] = startDate;
      }

      if (to_date) {
        // Set end of day for to_date
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
        { completed_delivery_location: { [Op.like]: `%${search}%` } },
        { '$Chat.message$': { [Op.like]: `%${search}%` } }
      ];
    }

    const queryOptions = {
      where: whereClause,
      include: [
        {
          model: Chat,
          attributes: ['message_id', 'message', 'conversation_id', 'senderId', 'createdAt'],
          include: [
            {
              model: User,
              attributes: ['user_id', 'first_name', 'last_name', 'phone_number', 'role']
            }
          ]
        },
        {
          model: User,
          as: 'Driver',
          attributes: ['user_id', 'first_name', 'last_name', 'phone_number']
        }
      ],
      order: [['createdAt', 'DESC']],
      subQuery: false // Important for search to work with includes
    };

    // Only add pagination if page and limit are provided
    if (shouldPaginate) {
      queryOptions.limit = parseInt(limit);
      queryOptions.offset = parseInt(offset);
    }

    const { count, rows: orders } = await Order.findAndCountAll(queryOptions);

    // Format the response with all order details
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
      assigned_driver: order.Driver ? {
        user_id: order.Driver.user_id,
        first_name: order.Driver.first_name,
        last_name: order.Driver.last_name,
        phone_number: order.Driver.phone_number
      } : null,
      chat_info: order.Chat ? {
        message_id: order.Chat.message_id,
        message: order.Chat.message,
        conversation_id: order.Chat.conversation_id,
        created_by: order.Chat.User ? {
          user_id: order.Chat.User.user_id,
          name: `${order.Chat.User.first_name} ${order.Chat.User.last_name}`,
          role: order.Chat.User.role
        } : null,
        createdAt: order.Chat.createdAt,
        updatedAt: order.Chat.updatedAt
      } : null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    const responseData = {
      status: true,
      message: "Orders retrieved successfully",
      user_role: userRole,
      filters: {
        from_date,
        to_date,
        search,
        status
      },
      data: {
        orders: formattedOrders
      }
    };

    // Only include pagination if page and limit were provided
    if (shouldPaginate) {
      const totalPages = Math.ceil(count / limit);
      responseData.data.pagination = {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages
      };
    } else {
      responseData.data.total = count;
    }

    return res.status(200).json(responseData);

  } catch (error) {
    console.error("Error getting orders:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching orders"
    });
  }
};

module.exports = { getListOrders };