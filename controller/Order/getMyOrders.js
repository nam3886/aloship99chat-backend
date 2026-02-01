const { Order, Chat, User } = require("../../models");
const { Op } = require("sequelize");

const getMyOrders = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const userRole = req.authData.role;
    const { status, page = 1, limit = 20 } = req.query;

    if (userRole !== 'driver') {
      return res.status(403).json({
        status: false,
        message: "Only drivers can view their orders"
      });
    }

    const offset = (page - 1) * limit;
    
    let whereClause = {
      assigned_driver_id: user_id
    };

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

    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Chat,
          attributes: ['message_id', 'message', 'conversation_id', 'senderId', 'createdAt'],
          include: [
            {
              model: User,
              attributes: ['user_id', 'first_name', 'last_name', 'phone_number', 'profile_image']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      status: true,
      message: "Orders retrieved successfully",
      data: {
        orders,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages
        }
      }
    });

  } catch (error) {
    console.error("Error getting orders:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching orders"
    });
  }
};

module.exports = { getMyOrders };