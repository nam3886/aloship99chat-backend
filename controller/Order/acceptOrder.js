const { Order, OrderAction, User, Chat, GroupSettings, sequelize } = require("../../models");
// COMMENTED OUT: Unused imports when notifications are disabled
// const { Notification, NotificationRead } = require("../../models");
// const { pushNotificationAlert } = require("../../reusable/pushNotificationAlert");
const { Op } = require("sequelize");
const socketService = require("../../reusable/socketService");
const { checkCooldown } = require("../../reusable/cooldownHelper");

const acceptOrder = async (req, res) => {
  // Start transaction to prevent race conditions
  const transaction = await sequelize.transaction();

  try {
    const { order_id } = req.body;
    const user_id = req.authData.user_id;
    const userRole = req.authData.role;

    if (!order_id) {
      await transaction.rollback();
      return res.status(400).json({
        status: false,
        message: "order_id is required"
      });
    }

    if (userRole !== 'driver') {
      await transaction.rollback();
      return res.status(403).json({
        status: false,
        message: "Only drivers can accept orders"
      });
    }

    // Use SELECT ... FOR UPDATE to lock the row and prevent race conditions
    const order = await Order.findOne({
      where: { order_id },
      include: [
        {
          model: Chat,
          attributes: ['conversation_id', 'message']
        }
      ],
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        status: false,
        message: "Order not found"
      });
    }

    if (order.status !== 'open') {
      await transaction.rollback();
      return res.status(400).json({
        status: false,
        message: "Order is no longer available"
      });
    }

    // Check cooldown based on group settings
    try {
      await checkCooldown(user_id, 1);
    } catch (error) {
      await transaction.rollback();
      return res.status(429).json({
        status: false,
        message: error.message
      });
    }

    // Check max orders per driver limit
    const groupSettings = await GroupSettings.findOne({
      where: { conversation_id: 1 },
      transaction
    });

    const maxOrdersPerDriver = groupSettings?.max_orders_per_driver || 3;

    // Count current active orders for this driver (assigned or in_delivery)
    const activeOrdersCount = await Order.count({
      where: {
        assigned_driver_id: user_id,
        status: {
          [Op.in]: ['assigned', 'in_delivery']
        }
      },
      transaction
    });

    if (activeOrdersCount >= maxOrdersPerDriver) {
      await transaction.rollback();
      return res.status(400).json({
        status: false,
        message: `Bạn đã đạt giới hạn ${maxOrdersPerDriver} đơn hàng đang xử lý. Vui lòng hoàn thành hoặc hủy các đơn hàng hiện tại trước khi nhận đơn mới.`
      });
    }

    await OrderAction.create({
      order_id,
      user_id,
      action_type: 'accept'
    }, { transaction });

    await Order.update(
      {
        status: 'assigned',
        assigned_driver_id: user_id
      },
      {
        where: { order_id },
        transaction
      }
    );

    // Commit the transaction before fetching updated order
    await transaction.commit();

    const updatedOrder = await Order.findOne({
      where: { order_id },
      include: [
        {
          model: User,
          as: 'Driver',
          attributes: ['user_id', 'first_name', 'last_name', 'phone_number']
        }
      ]
    });

    // COMMENTED OUT: driverName variable no longer needed when notifications are disabled
    // const driver = updatedOrder.Driver;
    // const driverName = `${driver.first_name} ${driver.last_name}`;

    // COMMENTED OUT: No notifications when driver accepts order
    // Create notification and notify the person who created the order
    // try {
    //   // Get the order creator from the Chat message
    //   const orderChat = await Chat.findOne({
    //     where: { message_id: order.message_id },
    //     attributes: ['senderId']
    //   });

    //   if (!orderChat) {
    //     throw new Error("Order chat message not found");
    //   }

    //   const creatorId = orderChat.senderId;

    //   // Get the creator user details
    //   const creator = await User.findOne({
    //     where: { user_id: creatorId },
    //     attributes: ['user_id', 'role', 'first_name', 'last_name', 'one_signal_player_id']
    //   });

    //   if (!creator) {
    //     console.log(`Order #${order_id} creator not found`);
    //     throw new Error("Order creator not found");
    //   }

    //   // Create notification
    //   const notification = await Notification.create({
    //     title: `Đơn hàng #${order_id} đã được nhận`,
    //     content: `${driverName} đã nhận đơn hàng #${order_id}`,
    //     created_by: user_id,
    //     is_active: true,
    //     target_driver_ids: creator.user_id.toString()
    //   });

    //   // Create NotificationRead record for the order creator
    //   await NotificationRead.create({
    //     notification_id: notification.notification_id,
    //     user_id: creator.user_id,
    //     is_read: false
    //   });

    //   console.log(`Notification sent to order creator (user ${creator.user_id}) - Driver accepted order #${order_id}`);

    //   // Send OneSignal push notification to the order creator
    //   try {
    //     if (creator.one_signal_player_id && creator.one_signal_player_id !== "") {
    //       await pushNotificationAlert({
    //         player_ids: [creator.one_signal_player_id],
    //         title: notification.title,
    //         content: notification.content,
    //         data: {
    //           notification_id: notification.notification_id,
    //           order_id: order_id,
    //           created_by: { user_id: user_id, name: driverName, role: 'driver' }
    //         }
    //       });
    //       console.log(`OneSignal push sent to order creator (user ${creator.user_id})`);
    //     } else {
    //       console.log(`Order creator (user ${creator.user_id}) has no OneSignal player ID`);
    //     }
    //   } catch (pushError) {
    //     console.error("Error sending OneSignal to order creator:", pushError);
    //   }

    // } catch (notificationError) {
    //   console.error("Error creating acceptance notification:", notificationError);
    //   // Don't fail the order acceptance if notification fails
    // }

    // Emit orderAccepted socket event to all connected users
    try {
      const io = socketService.getIo();

      io.emit("orderAccepted", {
        order_id,
        driver: updatedOrder.Driver,
        order: updatedOrder
      });
    } catch (socketError) {
      console.error("Error broadcasting orderAccepted:", socketError);
    }

    return res.status(200).json({
      status: true,
      message: "Order accepted successfully",
      order: updatedOrder
    });

  } catch (error) {
    // Rollback transaction on error
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      // Transaction might already be rolled back or committed
    }
    console.error("Error accepting order:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while accepting the order"
    });
  }
};

module.exports = { acceptOrder };