const { Order, Chat, UserSocket, User, Notification, NotificationRead } = require("../../models");
const socketService = require("../../reusable/socketService");
const { pushNotificationAlert } = require("../../reusable/pushNotificationAlert");

const updateOrder = async (req, res) => {
  try {
    const { order_id, status, completed_cost, completed_delivery_location, driver_note } = req.body;
    const user_id = req.authData.user_id;
    const userRole = req.authData.role;

    if (!order_id) {
      return res.status(400).json({
        status: false,
        message: "order_id is required"
      });
    }

    if (!status) {
      return res.status(400).json({
        status: false,
        message: "status is required"
      });
    }

    const order = await Order.findOne({
      where: { order_id },
      include: [
        {
          model: Chat,
          attributes: ['conversation_id']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        status: false,
        message: "Order not found"
      });
    }

    // Driver update their own order
    if (userRole === 'driver' && order.assigned_driver_id !== user_id) {
      return res.status(403).json({
        status: false,
        message: "You can only update your own orders"
      });
    }

    const updateData = { status };

    if (status === 'completed') {
      if (!completed_cost || !completed_delivery_location) {
        return res.status(400).json({
          status: false,
          message: "completed_cost and completed_delivery_location are required when completing an order"
        });
      }
      updateData.completed_cost = completed_cost;
      updateData.completed_delivery_location = completed_delivery_location;
      if (driver_note) {
        updateData.driver_note = driver_note;
      }
    } else if (status === 'cancelled') {
      if (!driver_note) {
        return res.status(400).json({
          status: false,
          message: "driver_note is required when cancelling an order"
        });
      }
      updateData.driver_note = driver_note;
    } else if (status === 'in_delivery') {
      // Driver can optionally add note when starting delivery
      if (driver_note) {
        updateData.driver_note = driver_note;
      }
    }

    await Order.update(updateData, {
      where: { order_id }
    });

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

    // Handle cancellation notifications based on who cancelled => Create OneSignal notification and NotificationRead records
    if (status === 'cancelled') {
      try {
        if (userRole === 'driver') {
          // Driver cancelled - notify only the vice_admin who created the order
          const driver = await User.findOne({
            where: { user_id },
            attributes: ['first_name', 'last_name']
          });

          const driverName = driver ? `${driver.first_name} ${driver.last_name}` : 'Driver';

          // Get the chat to find who created the order
          const chat = await Chat.findOne({
            where: { message_id: order.message_id },
            attributes: ['senderId'],
            include: [{
              model: User,
              attributes: ['user_id', 'role']
            }]
          });

          // Only notify if the creator is a vice_admin
          // COMMENTED OUT: No notifications to admin/vice_admin about order status
          // if (chat && chat.User && chat.User.role === 'vice_admin') {
          //   const orderCreatorId = chat.senderId;

          //   // Create notification
          //   const notification = await Notification.create({
          //     title: `Đơn hàng #${order_id} đã bị hủy`,
          //     content: `${driverName} đã hủy đơn hàng #${order_id} mà bạn đã tạo. Lý do: ${driver_note}`,
          //     created_by: user_id,
          //     is_active: true,
          //     target_driver_ids: orderCreatorId.toString()
          //   });

          //   // Create NotificationRead record for the creator
          //   await NotificationRead.create({
          //     notification_id: notification.notification_id,
          //     user_id: orderCreatorId,
          //     is_read: false
          //   });

          //   console.log(`Notification sent to order creator (vice_admin) #${orderCreatorId} - Driver cancelled order #${order_id}`);

          //   // Send OneSignal push notification to creator
          //   try {
          //     const creatorWithPlayerId = await User.findOne({
          //       where: { user_id: orderCreatorId },
          //       attributes: ['one_signal_player_id']
          //     });

          //     if (creatorWithPlayerId?.one_signal_player_id && creatorWithPlayerId.one_signal_player_id !== "") {
          //       await pushNotificationAlert({
          //         player_ids: [creatorWithPlayerId.one_signal_player_id],
          //         title: notification.title,
          //         content: notification.content,
          //         data: {
          //           notification_id: notification.notification_id,
          //           order_id: order_id,
          //           created_by: { user_id: user_id, name: driverName, role: 'driver' }
          //         }
          //       });
          //       console.log(`OneSignal push sent to order creator (vice_admin) #${orderCreatorId}`);
          //     }
          //   } catch (pushError) {
          //     console.error("Error sending OneSignal to order creator:", pushError);
          //   }
          // }

        } else if (userRole === 'admin' || userRole === 'vice_admin') {
          // Admin/Vice_admin cancelled order
          const canceller = await User.findOne({
            where: { user_id },
            attributes: ['first_name', 'last_name']
          });

          const cancellerName = canceller ? `${canceller.first_name} ${canceller.last_name}` : 'Admin/Vice admin';

          // Get the chat to find who created the order
          const chat = await Chat.findOne({
            where: { message_id: order.message_id },
            attributes: ['senderId']
          });

          const orderCreatorId = chat ? chat.senderId : null;

          // COMMENTED OUT: No notifications for order cancellation
          // Notify the driver if order was assigned
          // if (order.assigned_driver_id) {
          //   // Create notification for driver
          //   const driverNotification = await Notification.create({
          //     title: `Đơn hàng #${order_id} đã bị hủy`,
          //     content: `${cancellerName} đã hủy đơn hàng #${order_id} mà bạn đã nhận. Lý do: ${driver_note}`,
          //     created_by: user_id,
          //     is_active: true,
          //     target_driver_ids: order.assigned_driver_id.toString()
          //   });

          //   // Create NotificationRead record for the driver
          //   await NotificationRead.create({
          //     notification_id: driverNotification.notification_id,
          //     user_id: order.assigned_driver_id,
          //     is_read: false,
          //   });

          //   // Send socket notification to the driver
          //   const driverSocketIds = await UserSocket.findAll({
          //     where: { user_id: order.assigned_driver_id }
          //   });

          //   driverSocketIds.forEach((socketData) => {
          //     socketService
          //       .getIo()
          //       .to(socketData.dataValues.socketId)
          //       .emit("newNotification", {
          //         notification_id: driverNotification.notification_id,
          //         title: driverNotification.title,
          //         content: driverNotification.content,
          //         order_id,
          //         createdAt: driverNotification.createdAt
          //       });
          //   });

          //   console.log(`Notification sent to driver #${order.assigned_driver_id} - Admin cancelled order #${order_id}`);

          //   // Send OneSignal push notification to driver
          //   try {
          //     const driverWithPlayerId = await User.findOne({
          //       where: { user_id: order.assigned_driver_id },
          //       attributes: ['one_signal_player_id']
          //     });

          //     if (driverWithPlayerId?.one_signal_player_id && driverWithPlayerId.one_signal_player_id !== "") {
          //       await pushNotificationAlert({
          //         player_ids: [driverWithPlayerId.one_signal_player_id],
          //         title: driverNotification.title,
          //         content: driverNotification.content,
          //         data: {
          //           notification_id: driverNotification.notification_id,
          //           order_id: order_id,
          //           created_by: { user_id: user_id, name: cancellerName, role: userRole }
          //         }
          //       });
          //       console.log(`OneSignal push sent to driver #${order.assigned_driver_id}`);
          //     }
          //   } catch (pushError) {
          //     console.error("Error sending OneSignal to driver:", pushError);
          //   }
          // }

          // Notify the vice_admin who created the order (if different from canceller and is vice_admin)
          if (orderCreatorId && orderCreatorId !== user_id) {
            const orderCreator = await User.findOne({
              where: { user_id: orderCreatorId },
              attributes: ['role']
            });

            // COMMENTED OUT: No notifications to admin/vice_admin about order status
            // if (orderCreator && orderCreator.role === 'vice_admin') {
            //   // Create notification for order creator
            //   const creatorNotification = await Notification.create({
            //     title: `Đơn hàng #${order_id} đã bị hủy`,
            //     content: `${cancellerName} đã hủy đơn hàng #${order_id} mà bạn đã tạo. Lý do: ${driver_note}`,
            //     created_by: user_id,
            //     is_active: true,
            //     target_driver_ids: orderCreatorId.toString()
            //   });

            //   // Create NotificationRead record for the creator
            //   await NotificationRead.create({
            //     notification_id: creatorNotification.notification_id,
            //     user_id: orderCreatorId,
            //     is_read: false,
            //   });

            //   // Send socket notification to the creator
            //   const creatorSocketIds = await UserSocket.findAll({
            //     where: { user_id: orderCreatorId }
            //   });

            //   creatorSocketIds.forEach((socketData) => {
            //     socketService
            //       .getIo()
            //       .to(socketData.dataValues.socketId)
            //       .emit("newNotification", {
            //         notification_id: creatorNotification.notification_id,
            //         title: creatorNotification.title,
            //         content: creatorNotification.content,
            //         order_id,
            //         createdAt: creatorNotification.createdAt
            //       });
            //   });

            //   console.log(`Notification sent to order creator (vice_admin) #${orderCreatorId} - Admin cancelled order #${order_id}`);

            //   // Send OneSignal push notification to creator
            //   try {
            //     const creatorWithPlayerId = await User.findOne({
            //       where: { user_id: orderCreatorId },
            //       attributes: ['one_signal_player_id']
            //     });

            //     if (creatorWithPlayerId?.one_signal_player_id && creatorWithPlayerId.one_signal_player_id !== "") {
            //       await pushNotificationAlert({
            //         player_ids: [creatorWithPlayerId.one_signal_player_id],
            //         title: creatorNotification.title,
            //         content: creatorNotification.content,
            //         data: {
            //           notification_id: creatorNotification.notification_id,
            //           order_id: order_id,
            //           created_by: { user_id: user_id, name: cancellerName, role: userRole }
            //         }
            //       });
            //       console.log(`OneSignal push sent to order creator (vice_admin) #${orderCreatorId}`);
            //     }
            //   } catch (pushError) {
            //     console.error("Error sending OneSignal to order creator:", pushError);
            //   }
            // }
          }
        }
      } catch (notificationError) {
        console.error("Error creating cancellation notification:", notificationError);
        // Don't fail the order update if notification fails
      }
    }

    // Emit socket event to all users about order update
    const receiverSocketIds = await UserSocket.findAll();

    receiverSocketIds.forEach((socketData) => {
      socketService
        .getIo()
        .to(socketData.dataValues.socketId)
        .emit("orderUpdated", {
          order_id,
          status,
          order: updatedOrder
        });
    });

    return res.status(200).json({
      status: true,
      message: "Order updated successfully",
      order: updatedOrder
    });

  } catch (error) {
    console.error("Error updating order:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while updating the order"
    });
  }
};

module.exports = { updateOrder };