const {
  Chat,
  User,
  Block,
  ConversationsUser,
  Conversation,
  AllContact,
  UserSocket,
  DeletedChatList,
  Order,
} = require("../../models");
const { Op } = require("sequelize");
const isLink = require("../../reusable/IsLink");
const { updateFieldIfDefined } = require("../../reusable/updatedFields");
const { sendChatListOnMessage } = require("./ChatList/sendChatListOnMessage");
const socketService = require("../../reusable/socketService");
const checkUserAreInTheConversation = require("./checkUserAreInTheConversation");
const pushMessageNotification = require("../../reusable/pushMessageNotification");
let mime = require("mime-types");

const sendMessage = async (req, res) => {
  try {
    let {
      email_id,
      conversation_id,
      message,
      message_type, // image, video, text, location, document, audio, contact, status, gif, video_call, audio_call, order
      latitude,
      longitude,
      forward_id,
      reply_id,
      shared_contact_name,
      shared_contact_number,
      shared_contact_profile_image,
      status_id,
      video_time,
      audio_time,
      url,
      thumbnail,
      other_user_id,
      order_details, // For order messages
      client_timestamp, // Timestamp when client sends the message (for correct ordering)

      // filename,
      // thumbnailName,
      // video_time,
    } = req.body;

    let files = req.files;
    console.log(req.body, "req.body");

    const senderId = req.authData.user_id;

    // Check user role for messaging permissions
    const senderUser = await User.findOne({
      where: { user_id: senderId },
      attributes: ['role']
    });

    const driverProfile = senderUser.profile

    // Check if it's an order message
    if (message_type === 'order') {
      // Admin and vice_admin can always create orders
      if (senderUser.role === 'admin' || senderUser.role === 'vice_admin') {
        // Allow
      } else if (senderUser.role === 'driver') {
        if (!driverProfile || !driverProfile.can_create_order) {
          return res.status(403).json({
            status: false,
            message: "You don't have permission to create order messages. Contact admin to enable this feature."
          });
        }
      } else {
        return res.status(403).json({
          status: false,
          message: "Only admins, vice admins, and authorized drivers can create order messages"
        });
      }
    }

    // Validate required fields - only conversation_id or other_user_id needed
    if (
      (!conversation_id || conversation_id === "") &&
      (!other_user_id || other_user_id === "")
    ) {
      return res.status(400).json({
        status: false,
        message: "Either conversation_id or other_user_id is required",
      });
    }

    console.log("\x1b[32m", "hello", "\x1b[0m");

    if (!message_type || message_type === "") {
      // Emit an error message to the sender
      return res.status(400).json({
        status: false,
        message: "message_type field is required",
      });
    }

    let updateFields = {};

    // Insert into updateFields
    updateFields.senderId = senderId;
    // updateFields.receiverId = receiverId;
    isLinkTrue = isLink(message);
    if (isLinkTrue && message_type == "text") {
      message_type = "link";
    }

    if (files && files?.length != 0) {
      files.map((file) => {
        if (message_type == "video") {
          // for video only

          let filemimeType = mime.lookup(file.originalname);

          if (filemimeType.includes("image")) {
            updateFields.thumbnail = file.path;
          } else {
            updateFields.url = file.path;
          }
        } else {
          // for other files
          updateFields.url = file.path;
        }
      });
    }

    // if url is provided
    if (forward_id != undefined && forward_id != "") {
      updateFields.url = url.replaceAll(process.env.baseUrl, "");

      if (message_type == "video") {
        updateFields.thumbnail = thumbnail.replaceAll(process.env.baseUrl, "");
      }
    }

    updateFieldIfDefined(updateFields, "message_type", message_type);
    updateFieldIfDefined(updateFields, "forward_id", forward_id);
    updateFieldIfDefined(updateFields, "reply_id", reply_id);
    updateFieldIfDefined(updateFields, "message", message);
    updateFieldIfDefined(updateFields, "latitude", latitude);
    updateFieldIfDefined(updateFields, "longitude", longitude);
    updateFieldIfDefined(updateFields, "status_id", status_id);
    updateFieldIfDefined(updateFields, "audio_time", audio_time);
    updateFieldIfDefined(updateFields, "video_time", video_time);

    updateFieldIfDefined(
      updateFields,
      "shared_contact_name",
      shared_contact_name
    );
    updateFieldIfDefined(
      updateFields,
      "shared_contact_number",
      shared_contact_number
    );
    updateFieldIfDefined(
      updateFields,
      "shared_contact_profile_image",
      shared_contact_profile_image
    );

    // Add client_timestamp for correct message ordering
    if (client_timestamp) {
      updateFields.client_timestamp = parseInt(client_timestamp, 10);
    }

    // if (req.files && url.length != 0) {
    //   updateFields.url = url[0].path;
    // }

    // -------------------------------------------- Create or update the conversation ---------------------------------------------------- //
    console.log(conversation_id, "conversation_id");

    let conversationData;
    if (!conversation_id || conversation_id === "") {
      // Use other_user_id as receiverId for new conversations
      let receiverId = other_user_id;

      conversation_id = await checkUserAreInTheConversation(
        senderId,
        receiverId
      );
      console.log(conversation_id, "conversation_id");

      if (conversation_id) {
        updateFields.conversation_id = conversation_id;
      } else {
        //this means user wants to create new conversation ===============================================================================================
        conversationData = await Conversation.create({
          last_message: message,
          last_message_type: message_type,
        });

        conversation_id = conversationData.toJSON().conversation_id;
        console.log(conversation_id, "conversation_id below");

        // Now Add Sender user to conversation through conversationuser tabel ======================================================
        let senderAdded = await ConversationsUser.create({
          conversation_id,
          user_id: senderId,
        });

        // Now Add Recevier user to conversation through conversationuser tabel ======================================================
        let receiverAdded = await ConversationsUser.create({
          conversation_id,
          user_id: receiverId,
        });

        // Set New Conversation Id to add it to chats table
        updateFields.conversation_id = conversation_id;
      }
    } else {
      // let conversationData = await Conversation.update(
      //   {
      //     last_message: message,
      //     last_message_type: message_type,
      //   },
      //   {
      //     where: {
      //       conversation_id,
      //     },
      //   }
      // );
      // Set Conversation Id to add it to chats table
      updateFields.conversation_id = conversation_id;
    }

    // return res.send("Hello Send");
    // -------------------------------------------- Create the Chat ---------------------------------------------------- //
    let newMessage;
    try {
      newMessage = await Chat.create(updateFields);
    } catch (createError) {
      console.error('Failed to create message:', createError.message);
      throw createError;
    }

    // If it's an order message, create the Order record
    // order_details is optional - initial values can be empty, driver fills actual data later
    if (message_type === 'order') {
      // Parse order_details if provided
      let parsedOrderDetails = {};
      if (order_details) {
        if (typeof order_details === 'string') {
          try {
            parsedOrderDetails = JSON.parse(order_details);
          } catch (e) {
            console.error('Failed to parse order_details:', e);
            parsedOrderDetails = {};
          }
        } else {
          parsedOrderDetails = order_details;
        }
      }

      // Create order - all initial fields are optional
      // Real data (completed_cost, completed_delivery_location, driver_note) filled by driver later
      const orderData = {
        message_id: newMessage.message_id,
        customer_name: parsedOrderDetails.customer_name || null,
        delivery_location: parsedOrderDetails.delivery_location || null,
        note: parsedOrderDetails.note || null,
        cost: parsedOrderDetails.cost || null,
        status: 'open'
      };

      try {
        const createdOrder = await Order.create(orderData);
        console.log('Order created:', createdOrder.order_id);
      } catch (error) {
        console.error('Error creating order:', error);
      }
    }

    let conversationUpdateData = await Conversation.update(
      {
        last_message: message,
        last_message_type: message_type,
        last_message_id: newMessage.dataValues.message_id,
      },
      {
        where: {
          conversation_id,
        },
      }
    );

    // -------------------------------------------- Update who_seen_the_message for sender ---------------------------------------------------- //

    await Chat.update(
      {
        who_seen_the_message: senderId,
      },
      {
        where: {
          message_id: newMessage.dataValues.message_id,
        },
      }
    );

    // Emit the message to the sender
    // socket.emit("messageSent", newMessage);

    // To find receiver User Id  ==================================================================================
    let receiverIdList = []; // ReciverId is array because i have used the same logic for single to single chat and group chat that's why
    let ConversationsUserList = await ConversationsUser.findAll({
      where: {
        conversation_id,
      },
    });

    ConversationsUserList.map((user) => {
      user = user.toJSON();
      // Exclue sender user ==================================================================================
      if (user.user_id !== senderId) {
        receiverIdList.push(user.user_id);
      }
    });
    // return res.send(receiverIdList);

    let responseSent = false;
    let newConversationData = await Conversation.findOne({
      where: { conversation_id },
    });

    let singleChat = await Chat.findOne({
      where: {
        message_id: newMessage.message_id,  // ✅ FIX: Query by specific message_id instead of latest
      },
      include: [
        {
          model: Order,
          required: false,
          attributes: [
            'order_id',
            'message_id',
            'customer_name',
            'delivery_location',
            'note',
            'cost',
            'status',
            'assigned_driver_id',
            'completed_cost',
            'completed_delivery_location',
            'driver_note',
            'createdAt',
            'updatedAt'
          ],
          include: [
            {
              model: User,
              as: 'Driver',
              attributes: ['user_id', 'first_name', 'last_name', 'phone_number'],
              required: false
            }
          ]
        }
      ]
    });

    // ⚡ SEND RESPONSE IMMEDIATELY - Don't wait for socket emissions or notifications
    // Set myMessage = true for sender's response
    singleChat.dataValues.myMessage = true;
    res.status(200).json(singleChat);
    responseSent = true;

    // 🔄 PROCESS IN BACKGROUND - Batch all queries first, then loop
    setImmediate(async () => {
      try {
        // ⚡ BATCH ALL DATABASE QUERIES (650 queries → 5 queries!)
        const [allReceiverSockets, allBlocks, allDeleted, senderUser, allContacts] = await Promise.all([
          UserSocket.findAll({
            where: { user_id: { [Op.in]: receiverIdList } }
          }),
          Block.findAll({
            where: {
              user_id: { [Op.in]: receiverIdList },
              conversation_id
            }
          }),
          DeletedChatList.findAll({
            where: {
              user_id: { [Op.in]: receiverIdList },
              conversation_id
            }
          }),
          User.findOne({
            where: { user_id: senderId },
            attributes: [
              "user_id", "user_name", "profile_image", "first_name",
              "last_name", "phone_number", "email_id", "role"
            ]
          }),
          AllContact.findAll({
            where: { user_id: { [Op.in]: receiverIdList } },
            attributes: ["user_id", "phone_number", "full_name"]
          })
        ]);

        // Create lookup maps for O(1) access
        const socketsByUser = {};
        allReceiverSockets.forEach(socket => {
          if (!socketsByUser[socket.user_id]) {
            socketsByUser[socket.user_id] = [];
          }
          socketsByUser[socket.user_id].push(socket);
        });

        const blockedUsers = new Set(allBlocks.map(b => b.user_id));

        const contactsByUser = {};
        allContacts.forEach(contact => {
          if (!contactsByUser[contact.user_id]) {
            contactsByUser[contact.user_id] = [];
          }
          contactsByUser[contact.user_id].push(contact);
        });

        // Delete all cleared chats in batch
        if (allDeleted.length > 0) {
          await DeletedChatList.destroy({
            where: {
              user_id: { [Op.in]: allDeleted.map(d => d.user_id) },
              conversation_id
            }
          });
        }

        const userData = senderUser ? senderUser.get() : null;

        // Prepare singleChat for receivers (myMessage = false for them)
        singleChat.dataValues.myMessage = false;
        singleChat.dataValues.senderData = userData;
        singleChat.dataValues.is_star_message = false;
        singleChat.dataValues.statusData = [];
        singleChat.dataValues.pollData = [];

        // Now process each receiver with pre-fetched data
        for (const receiverId of receiverIdList) {
          // Skip sender - they already received HTTP response with myMessage = true
          // Sending socket emission would overwrite with myMessage = false
          if (receiverId === senderId) {
            continue;
          }

          const receiverSocketIds = socketsByUser[receiverId] || [];
          const isBlocked = blockedUsers.has(receiverId);

          // -------------------------------------Send Message to receiver socket if user is connected--------------------------------------- //
          if (receiverSocketIds.length != 0) {

            // Add order details if message type is order
            let orderDetails = null;
            if (singleChat.message_type === 'order' && singleChat.Order) {
              orderDetails = {
                order_id: singleChat.Order.order_id,
                status: singleChat.Order.status,
                customer_name: singleChat.Order.customer_name,
                delivery_location: singleChat.Order.delivery_location,
                note: singleChat.Order.note,
                cost: singleChat.Order.cost,
                completed_cost: singleChat.Order.completed_cost,
                completed_delivery_location: singleChat.Order.completed_delivery_location,
                driver_note: singleChat.Order.driver_note,
                assigned_driver: singleChat.Order.Driver ? {
                  user_id: singleChat.Order.Driver.user_id,
                  first_name: singleChat.Order.Driver.first_name,
                  last_name: singleChat.Order.Driver.last_name,
                  phone_number: singleChat.Order.Driver.phone_number
                } : null
              };
            }
            singleChat.dataValues.orderDetails = orderDetails;

            if (!isBlocked) {
              // Emit the message to all receiver's sockets (with myMessage = false)
              receiverSocketIds.forEach((receiverSocketId) => {
                socketService
                  .getIo()
                  .to(receiverSocketId.dataValues.socketId)
                  .emit("messageReceived", singleChat);
              });
            }
          }

          // Defer chat list update ONCE per receiver (not per socket)
          if (!isBlocked && receiverSocketIds.length > 0) {
            setImmediate(() => {
              // Send to first socket - it will broadcast to all sockets of this user
              sendChatListOnMessage(
                socketService.getIo(),
                receiverSocketIds[0].dataValues.socketId,
                receiverId
              ).catch(err => {
                console.error(`Chat list update failed for user ${receiverId}:`, err.message);
              });
            });
          }

          // 📱 Send push notifications in background (fire and forget)
          if (!isBlocked) {
            (async () => {
              try {
                let senderName;
                if (newConversationData.dataValues.is_group) {
                  senderName = newConversationData.dataValues.group_name;
                } else {
                  // Use pre-fetched contact data instead of querying
                  const userContacts = contactsByUser[receiverId] || [];
                  const userDetails = userContacts.find(c => c.phone_number === userData.phone_number);
                  senderName = userDetails?.full_name || `${userData.first_name} ${userData?.last_name}`;
                }

                await pushMessageNotification({
                  senderId,
                  receiverId,
                  senderName,
                  message: message_type === "text" ? message : message_type,
                  message_type,
                  conversation_id,
                  is_group: newConversationData.dataValues.is_group,
                  profile_image: newConversationData.dataValues.is_group
                    ? newConversationData.dataValues.group_profile_image
                    : userData.profile_image,
                  big_picture:
                    message_type == "video"
                      ? newMessage.dataValues.thumbnail
                      : newMessage.dataValues.url,
                });
              } catch (err) {
                console.error(`Notification failed for user ${receiverId}:`, err.message);
              }
            })();
          }
        }
      } catch (backgroundError) {
        console.error('Background processing error:', backgroundError);
      }
    });
  } catch (error) {
    console.error('Error in sendMessage:', error.message);
    // Return error response to client if not already sent
    if (!res.headersSent) {
      return res.status(500).json({
        status: false,
        message: "An error occurred while sending the message",
        error: error.message
      });
    }
  }
};

module.exports = { sendMessage };
