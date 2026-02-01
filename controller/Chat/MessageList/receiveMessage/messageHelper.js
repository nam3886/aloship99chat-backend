const { getStatusData, getBatchStatusData } = require("./statusService");
const {
  isMessageStarred,
  isMessageDeleted,
  markMessageAsRead,
  getPollData,
  getStarredMessageIds,
  getDeletedMessageIds,
  getBatchPollData,
  batchMarkMessagesAsSeen,
} = require("./chatService");
const { getUserById, getUsersByIds } = require("./userService");
const moment = require("moment-timezone");
const { User, AllContact } = require("../../../../models");
const { Op } = require("sequelize");

const processMessageContent = async ({
  messages,
  user_id,
  conversationUsers,
  user_timezone,
  conversation_id,
}) => {
  const modifiedDataWithDate = [];
  let lastDate = null;

  const user_id_list = conversationUsers.map((u) => u.user_id.toString());

  // ============== BATCH PRE-FETCH ALL DATA (Performance Optimization) ==============
  // Extract all message IDs, sender IDs, status IDs for batch queries
  const allMessageIds = messages.map(m => m.message_id);
  const allSenderIds = messages.map(m => m.senderId);
  const allStatusIds = messages.map(m => m.status_id).filter(id => id);
  const pollMessageIds = messages.filter(m => m.message_type === 'poll').map(m => m.message_id);

  // Collect user IDs needed for member_added/member_removed messages
  const memberMessageUserIds = [];
  for (const item of messages) {
    if (item.message_type === 'member_added' || item.message_type === 'member_removed') {
      memberMessageUserIds.push(item.message); // admin who added/removed
      memberMessageUserIds.push(item.senderId); // the member
    }
  }

  // Execute all batch queries in parallel
  const [
    deletedMessageIds,
    starredMessageIds,
    senderDataMap,
    statusDataMap,
    pollDataMap,
    memberUsersMap
  ] = await Promise.all([
    getDeletedMessageIds(user_id, allMessageIds),
    getStarredMessageIds(user_id, allMessageIds),
    getUsersByIds(allSenderIds),
    getBatchStatusData(allStatusIds),
    getBatchPollData(pollMessageIds),
    getUsersByIds(memberMessageUserIds)
  ]);

  // Batch fetch contact names for member messages
  let contactNamesMap = new Map();
  if (memberMessageUserIds.length > 0) {
    const memberUsers = await User.findAll({
      where: { user_id: { [Op.in]: memberMessageUserIds } },
      attributes: ['user_id', 'phone_number']
    });
    const phoneNumbers = memberUsers.map(u => u.phone_number);

    if (phoneNumbers.length > 0) {
      const contacts = await AllContact.findAll({
        where: {
          phone_number: { [Op.in]: phoneNumbers },
          user_id
        },
        attributes: ['phone_number', 'full_name']
      });

      for (const contact of contacts) {
        contactNamesMap.set(contact.phone_number, contact.full_name);
      }
    }
  }

  // Collect messages that need to be marked as seen (batch update later)
  const messagesToMarkAsSeen = [];

  // ============== PROCESS MESSAGES ==============
  for (const item of messages) {
    // Check who_seen the message - collect for batch update
    let who_seen_list = item.dataValues.who_seen_the_message
      ? item.dataValues.who_seen_the_message.split(",")
      : [];
    if (
      !item.dataValues.message_read &&
      !who_seen_list.includes(String(user_id))
    ) {
      messagesToMarkAsSeen.push(item.message_id);
    }

    // Construct full url ===================================================
    const message_url = `${process.env.baseUrl}${item.url}`;
    item.url = message_url != process.env.baseUrl ? message_url : "";

    // build thumbnail full url ==========================================
    if (item.message_type == "video") {
      item.thumbnail = item.thumbnail;
    }

    // Use pre-fetched data instead of individual queries
    const isDeleted = deletedMessageIds.has(item.message_id);
    if (isDeleted) continue;

    // Skip order messages that are accepted, completed, or cancelled
    if (item.message_type === 'order' && item.Order) {
      const orderStatus = item.Order.status;
      if (orderStatus === 'assigned' || orderStatus === 'completed' || orderStatus === 'cancelled' || orderStatus === 'in_delivery') {
        continue;
      }
    }

    // Use pre-fetched data
    const isStarred = starredMessageIds.has(item.message_id);
    const statusData = statusDataMap.get(item.status_id) || [];
    const senderData = senderDataMap.get(item.senderId) || null;
    const pollData = pollDataMap.get(item.message_id) || [];

    const messageDate = moment
      .tz(item.createdAt, user_timezone)
      .format("YYYY-MM-DD");

    if (lastDate !== messageDate) {
      modifiedDataWithDate.push({
        url: "",
        thumbnail: "",
        message_id: 0,
        message: item.dataValues.createdAt,
        message_type: "date",
        who_seen_the_message: "",
        message_read: 0,
        video_time: "",
        audio_time: "",
        latitude: "",
        longitude: "",
        shared_contact_name: "",
        shared_contact_profile_image: "",
        shared_contact_number: "",
        forward_id: 0,
        reply_id: 0,
        status_id: 0,
        createdAt: "",
        updatedAt: "",
        senderId: 0,
        conversation_id: 0,
        delete_for_me: "",
        delete_from_everyone: false,
        is_star_message: false,
        myMessage: false,
        statusData: [],
        senderData: {
          profile_image: "",
          user_id: 0,
          user_name: "",
          first_name: "",
          last_name: "",
          phone_number: "",
        },
        pollData: [],
      });
      lastDate = messageDate;
    }

    if (
      item.message_type == "member_added" ||
      item.message_type == "member_removed"
    ) {
      // Use pre-fetched user data
      const adminDetails = memberUsersMap.get(Number(item.message));
      const newUserDetails = memberUsersMap.get(item.senderId);

      if (adminDetails && newUserDetails) {
        // Use pre-fetched contact names
        const adminUserName = contactNamesMap.get(adminDetails.phone_number);
        const newUserName = contactNamesMap.get(newUserDetails.phone_number);

        item.dataValues.message = `${
          adminDetails.user_id == user_id
            ? "Bạn"
            : (adminUserName || `${adminDetails.first_name} ${adminDetails.last_name}`)
        } ${item.message_type == "member_added" ? "đã thêm" : "đã xóa"} ${
          newUserDetails.user_id == user_id
            ? "Bạn"
            : (newUserName || `${newUserDetails.first_name} ${newUserDetails.last_name}`)
        }`;
      }
    }

    // Add order details if message type is order
    let orderDetails = null;
    if (item.message_type === 'order' && item.Order) {
      orderDetails = {
        order_id: item.Order.order_id,
        status: item.Order.status,
        customer_name: item.Order.customer_name,
        delivery_location: item.Order.delivery_location,
        note: item.Order.note,
        cost: item.Order.cost,
        completed_cost: item.Order.completed_cost,
        completed_delivery_location: item.Order.completed_delivery_location,
        driver_note: item.Order.driver_note,
        assigned_driver: item.Order.Driver ? {
          user_id: item.Order.Driver.user_id,
          first_name: item.Order.Driver.first_name,
          last_name: item.Order.Driver.last_name,
          phone_number: item.Order.Driver.phone_number
        } : null
      };
    }

    modifiedDataWithDate.push({
      ...item.dataValues,
      is_star_message: isStarred,
      statusData,
      myMessage: item.senderId === user_id,
      senderData,
      pollData,
      orderDetails,
    });
  }

  // Batch mark messages as seen (after processing to not block the loop)
  if (messagesToMarkAsSeen.length > 0) {
    // Run this in the background - don't await to speed up response
    batchMarkMessagesAsSeen(conversation_id, messagesToMarkAsSeen, user_id, user_id_list)
      .catch(err => console.error("Error batch marking messages as seen:", err));
  }

  return modifiedDataWithDate;
};

module.exports = { processMessageContent };
