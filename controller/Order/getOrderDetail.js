const { Order, Chat, User, OrderAction } = require("../../models");
const { Op } = require("sequelize");

const getOrderDetail = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const userRole = req.authData.role;
    const { order_id } = req.params;

    if (!order_id) {
      return res.status(400).json({
        status: false,
        message: "order_id is required"
      });
    }

    // Find the order with all related information
    const order = await Order.findOne({
      where: { order_id },
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
        },
        {
          model: OrderAction,
          attributes: ['action_id', 'action_type', 'action_timestamp'],
          include: [
            {
              model: User,
              attributes: ['user_id', 'first_name', 'last_name', 'phone_number', 'role']
            }
          ],
          order: [['action_timestamp', 'DESC']]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        status: false,
        message: "Order not found"
      });
    }

    // Check permissions - only admin and vice_admin can access
    // if (userRole !== 'admin' && userRole !== 'vice_admin') {
    //   return res.status(403).json({
    //     status: false,
    //     message: "Only admin and vice admin can access this endpoint"
    //   });
    // }
    // Both admin and vice_admin can see all order details

    // Format the response
    const formattedOrder = {
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
      action_history: order.OrderActions ? order.OrderActions.map(action => ({
        action_id: action.action_id,
        action_type: action.action_type,
        action_timestamp: action.action_timestamp,
        performed_by: action.User ? {
          user_id: action.User.user_id,
          name: `${action.User.first_name} ${action.User.last_name}`,
          role: action.User.role
        } : null
      })) : [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };

    return res.status(200).json({
      status: true,
      message: "Order detail retrieved successfully",
      data: formattedOrder
    });

  } catch (error) {
    console.error("Error getting order detail:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching order detail"
    });
  }
};

module.exports = { getOrderDetail };