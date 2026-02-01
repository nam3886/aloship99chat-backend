const { DeleteMessage, Chat, Conversation, ConversationsUser, Order, User, UserSocket, Notification, NotificationRead } = require("../../../models");
let { Op } = require("sequelize");
let path = require("node:path");
let fs = require("node:fs");
const EmitDataInGroup = require("../Group/EmitDataInGroup");
const socketService = require("../../../reusable/socketService");
const { pushNotificationAlert } = require("../../../reusable/pushNotificationAlert");

const deleteMessages = async (req, res) => {
  let { message_id_list, delete_from_every_one, conversation_id } = req.body;
  if (!message_id_list || message_id_list == "") {
    return res
      .status(400)
      .json({ success: false, message: "message_id_list field is required" });
  }
  if (!conversation_id || conversation_id == "") {
    return res
      .status(400)
      .json({ success: false, message: "conversation_id field is required" });
  }

  try {
    const user_id = req.authData.user_id;
    const userRole = req.authData.role;

    // Delete from EveryOne ==================================================================================

    if (delete_from_every_one == "true") {
      // Check permissions for delete from everyone
      // Admin and vice_admin can always delete
      // Drivers can only delete their own messages
      if (userRole !== 'admin' && userRole !== 'vice_admin' && userRole !== 'driver') {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to delete messages"
        });
      }

      let messageIdArray = message_id_list.split(",");

      // Build where clause for message query
      const messageWhereClause = {
        message_id: {
          [Op.in]: messageIdArray,
        }
      };

      // If driver, only allow deleting their own messages
      if (userRole === 'driver') {
        messageWhereClause.senderId = user_id;
      }

      const beforeChatData = await Chat.findAll({
        where: messageWhereClause,
        include: [{
          model: Order,
          required: false
        }]
      });

      // Check if driver tried to delete someone else's message
      if (userRole === 'driver' && beforeChatData.length === 0) {
        return res.status(403).json({
          success: false,
          message: "You can only delete your own messages"
        });
      }

      // Handle order cancellation for order messages
      for (const chatMessage of beforeChatData) {
        // If this is an order message and has an associated order, cancel it
        if (chatMessage.message_type === 'order' && chatMessage.Order) {
          const order = chatMessage.Order;

          // Only cancel if order is not already completed or cancelled
          if (order.status !== 'completed' && order.status !== 'cancelled') {
            try {
              // Get user info for notification
              const currentUser = await User.findOne({
                where: { user_id: user_id },
              });

              const userName = currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'User';
              const driverNote = `Đơn hàng bị hủy do ${userName} xóa tin nhắn`;

              // Cancel the order
              await Order.update(
                {
                  status: 'cancelled',
                  driver_note: driverNote
                },
                { where: { order_id: order.order_id } }
              );

              console.log(`Order #${order.order_id} cancelled due to message deletion by ${userName}`);

              // Notify relevant parties
              // If driver deleted their own order message, notify admins
              // If admin/vice_admin deleted, notify the assigned driver (if any)

              // COMMENTED OUT: No notifications to admin/vice_admin about order status
              // if (userRole === 'driver' && order.assigned_driver_id === user_id) {
              //   // Driver deleted their own order - notify ONLY vice_admins (not admins)
              //   const viceAdminsInGroup = await ConversationsUser.findAll({
              //     where: { conversation_id: 1 },
              //     include: [{
              //       model: User,
              //       where: {
              //         role: 'vice_admin'
              //       },
              //     }]
              //   });

              //   const viceAdminUserIds = viceAdminsInGroup.map(item => item.User.user_id);

              //   if (viceAdminUserIds.length > 0) {
              //     const targetViceAdminIdsString = viceAdminUserIds.join(",");

              //     const notification = await Notification.create({
              //       title: `Đơn hàng #${order.order_id} đã bị hủy`,
              //       content: `${userName} đã xóa tin nhắn đơn hàng #${order.order_id}. Đơn hàng đã bị hủy.`,
              //       created_by: user_id,
              //       is_active: true,
              //       target_driver_ids: targetViceAdminIdsString
              //     });

              //     const notificationReads = viceAdminUserIds.map(vice_admin_id => ({
              //       notification_id: notification.notification_id,
              //       user_id: vice_admin_id,
              //       is_read: false
              //     }));

              //     await NotificationRead.bulkCreate(notificationReads);

              //     const viceAdminSocketIds = await UserSocket.findAll({
              //       where: { user_id: { [Op.in]: viceAdminUserIds } }
              //     });

              //     viceAdminSocketIds.forEach((socketData) => {
              //       socketService
              //         .getIo()
              //         .to(socketData.dataValues.socketId)
              //         .emit("newNotification", {
              //           notification_id: notification.notification_id,
              //           title: notification.title,
              //           content: notification.content,
              //           order_id: order.order_id,
              //           createdAt: notification.createdAt
              //         });
              //     });

              //     console.log(`Notification sent to vice_admins - Driver deleted order message`);

              //     // Send OneSignal push notification to vice_admins only
              //     try {
              //       const usersWithPlayerIds = await User.findAll({
              //         where: { user_id: { [Op.in]: viceAdminUserIds } },
              //         attributes: ['user_id', 'one_signal_player_id']
              //       });

              //       const playerIds = usersWithPlayerIds
              //         .map(u => u.one_signal_player_id)
              //         .filter(id => id && id !== "");

              //       if (playerIds.length > 0) {
              //         await pushNotificationAlert({
              //           player_ids: playerIds,
              //           title: notification.title,
              //           content: notification.content,
              //           data: {
              //             notification_id: notification.notification_id,
              //             order_id: order.order_id,
              //             created_by: { user_id: user_id, name: userName, role: 'driver' }
              //           }
              //         });
              //         console.log(`OneSignal push sent to ${playerIds.length} vice_admins`);
              //       }
              //     } catch (pushError) {
              //       console.error("Error sending OneSignal to vice_admins:", pushError);
              //     }
              //   }
              // }

              if ((userRole === 'admin' || userRole === 'vice_admin') && order.assigned_driver_id) {
                // Admin/Vice_admin deleted - notify assigned driver
                const notification = await Notification.create({
                  title: `Đơn hàng #${order.order_id} đã bị hủy`,
                  content: `${userName} đã xóa tin nhắn đơn hàng #${order.order_id}. Đơn hàng đã bị hủy.`,
                  created_by: user_id,
                  is_active: true,
                  target_driver_ids: order.assigned_driver_id.toString()
                });

                // Create NotificationRead record
                await NotificationRead.create({
                  notification_id: notification.notification_id,
                  user_id: order.assigned_driver_id,
                  is_read: false
                });

                // Send socket notification to driver
                const driverSocketIds = await UserSocket.findAll({
                  where: { user_id: order.assigned_driver_id }
                });

                driverSocketIds.forEach((socketData) => {
                  socketService
                    .getIo()
                    .to(socketData.dataValues.socketId)
                    .emit("newNotification", {
                      notification_id: notification.notification_id,
                      title: notification.title,
                      content: notification.content,
                      order_id: order.order_id,
                      createdAt: notification.createdAt
                    });
                });

                // Send OneSignal push notification to driver
                try {
                  const driverWithPlayerId = await User.findOne({
                    where: { user_id: order.assigned_driver_id },
                    attributes: ['one_signal_player_id']
                  });

                  if (driverWithPlayerId?.one_signal_player_id && driverWithPlayerId.one_signal_player_id !== "") {
                    await pushNotificationAlert({
                      player_ids: [driverWithPlayerId.one_signal_player_id],
                      title: notification.title,
                      content: notification.content,
                      data: {
                        notification_id: notification.notification_id,
                        order_id: order.order_id,
                        created_by: { user_id: user_id, name: userName, role: userRole }
                      }
                    });
                    console.log(`OneSignal push sent to driver #${order.assigned_driver_id}`);
                  }
                } catch (pushError) {
                  console.error("Error sending OneSignal to driver:", pushError);
                }

                // Emit orderUpdated socket event
                const allUserSockets = await UserSocket.findAll({
                    where: {
                    user_id: {
                      [Op.ne]: user_id
                    }
                  }
                });

                allUserSockets.forEach((socketData) => {
                  socketService
                    .getIo()
                    .to(socketData.dataValues.socketId)
                    .emit("orderUpdated", {
                      order_id: order.order_id,
                      status: 'cancelled',
                      message: 'Đơn hàng đã bị hủy do tin nhắn bị xóa'
                    });
                });

                console.log(`Notification sent to driver #${order.assigned_driver_id} about order cancellation`);
              }
            } catch (orderError) {
              console.error(`Error cancelling order #${order.order_id}:`, orderError);
              // Don't fail message deletion if order cancellation fails
            }
          }
        }
      }

      beforeChatData.map(async (e) => {
        // console.log(e.dataValues);

        // Below commented code is to hard delete the message ======================
        // if (e.dataValues.url !== "") {
        //   // Replace `${process.env.baseUrl}` with an empty string to remove it
        //   // const relativePath = url[0].replace(process.env.baseUrl, "");
        //   // console.log("relativePath", relativePath);

        //   // Construct the absolute path by joining __dirname with the relative path
        //   const absolutePath = path.join(
        //     __dirname,
        //     "..",
        //     "..",
        //     "..",
        //     e.dataValues.url
        //   );
        //   // console.log(absolutePath, "absolutePath=======================");

        //   // console.log("filePath", absolutePath);

        //   if (fs.existsSync(absolutePath)) {
        //     fs.unlinkSync(absolutePath); // Delete the file
        //   }
        // }

        // delete thumbnail of video
        // if (e.dataValues.thumbnail != "") {
        //   // Construct the absolute path by joining __dirname with the relative path
        //   const absolutePath = path.join(
        //     __dirname,
        //     "..",
        //     "..",
        //     "..",
        //     e.dataValues.thumbnail
        //   );

        //   // console.log("filePath", absolutePath);

        //   if (fs.existsSync(absolutePath)) {
        //     fs.unlinkSync(absolutePath); // Delete the file
        //   }
        // }

        let udpateMessage = await Chat.update(
          {
            delete_from_everyone: true,
          },
          {
            where: {
              conversation_id,
              message_id: e.dataValues.message_id,
            },
          }
        );
      });

      // Update last_message for that conversation ===================+
      const findLastMessageId = await Chat.findOne({
        where: {
          conversation_id: conversation_id,
        },
        attributes: ["message_id"],
        order: [["message_id", "DESC"]],
        limit: 1,
      });

      if (messageIdArray.includes(findLastMessageId.message_id.toString())) {
        // Only update chatlist if it is last message ==================================================================================
        let conversationData = await Conversation.update(
          {
            last_message: "🚫 This message was deleted!",
            last_message_type: "delete_from_everyone",
          },
          {
            where: {
              conversation_id,
            },
          }
        );
      }
      messageIdArray = messageIdArray.map((e) => {
        return Number(e);
      });
      // Emit one event to notify the member is removed from group
      await EmitDataInGroup(conversation_id, "update_data", {
        conversation_id: conversation_id,
        delete_from_everyone_ids: messageIdArray,
      });
      // Below code is to hard delete the message permanatly
      // const resData = await Chat.destroy({
      //   where: {
      //     message_id: {
      //       [Op.in]: messageIdArray,
      //     },
      //   },
      // });

      res.status(200).json({
        success: true,
        message: "Message Deleted Successfully",
      });
    } else {
      // Delete Message only from me ==================================================================================
      let messageIdArray = message_id_list.split(",");

      try {
        await Promise.all(
          messageIdArray.map(async (message_id) => {
            const message = await Chat.findOne({
              where: {
                conversation_id,
                message_id,
              },
              attributes: ["delete_for_me", "delete_from_everyone"],
            });

            if (message) {
              // Get the current value of delete_for_me and split it into an array
              let currentDeleteForMe = message.delete_for_me || "";
              let user_id_list = currentDeleteForMe
                ? currentDeleteForMe.split(",")
                : [];

              // Check if the user_id already exists in the list
              if (
                user_id_list.includes(String(user_id)) ||
                message.delete_from_everyone
              ) {
                // This will remove the deleted message entry from message_list ===========================================
                const isDeletedMessagese = await DeleteMessage.findOne({
                  where: {
                    user_id,
                    message_id,
                  },
                });

                // this is for if message is allready deleted then remove the entry for that
                if (!isDeletedMessagese) {
                  // DeleteMessage the user
                  await DeleteMessage.create({
                    user_id,
                    message_id,
                  });
                }
              } else {
                user_id_list.push(String(user_id));
              }

              // Join the updated user_id_list back into a string
              const updatedDeleteForMe = user_id_list.join(",");

              // Update the delete_for_me field in the database
              let udpateMessage = await Chat.update(
                {
                  delete_for_me: updatedDeleteForMe,
                },
                {
                  where: {
                    conversation_id,
                    message_id,
                  },
                }
              );
            } else {
              console.log("Message not found");
            }

            // let udpateMessage = await Chat.update(
            //   {
            //     delete_for_me: user_id,
            //   },
            //   {
            //     where: {
            //       conversation_id,
            //       message_id: message_id,
            //     },
            //   }
            // );
          })
        );
      } catch (error) {
        console.error(error.message);
      }

      return res.status(200).json({
        success: true,
        message: "Message Deleted Successfully",
      });
    }
  } catch (error) {
    // Handle the Sequelize error and send it as a response to the client
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { deleteMessages };
