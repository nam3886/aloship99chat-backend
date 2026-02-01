const { Notification, NotificationRead, User, ConversationsUser, UserSocket } = require("../../models");
const socketService = require("../../reusable/socketService");
const { Op } = require("sequelize");
const { pushNotificationAlert } = require("../../reusable/pushNotificationAlert");

const createNotification = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const userRole = req.authData.role;
    const { title, content, driver_ids, type = 'normal' } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        status: false,
        message: "Title and content are required"
      });
    }

    // Validate type field
    if (type && !['normal', 'important'].includes(type)) {
      return res.status(400).json({
        status: false,
        message: "Type must be either 'normal' or 'important'"
      });
    }

    let targetDriverIdsString = "";
    let targetDrivers = [];

    // If driver_ids provided, validate they are actual drivers
    if (driver_ids && Array.isArray(driver_ids) && driver_ids.length > 0) {
      targetDrivers = await User.findAll({
        where: {
          user_id: driver_ids,
          role: 'driver'
        },
        attributes: ['user_id']
      });

      if (targetDrivers.length === 0) {
        return res.status(400).json({
          status: false,
          message: "No valid driver IDs provided"
        });
      }

      // Store as comma-separated string
      targetDriverIdsString = targetDrivers.map(d => d.user_id).join(",");
    }

    // Create the notification
    const notification = await Notification.create({
      title,
      content,
      created_by: user_id,
      is_active: true,
      target_driver_ids: targetDriverIdsString,
      type
    });

    // Get users to notify based on creator role
    let usersToNotify = [];

    if (targetDriverIdsString === "") {
      // No specific drivers - send to all drivers in group
      const driversInGroup = await ConversationsUser.findAll({
        where: { conversation_id: 1 },
        include: [{
          model: User,
          where: { role: 'driver' },
          attributes: ['user_id']
        }]
      });
      usersToNotify = driversInGroup.map(d => d.User.user_id);

      // If creator is ADMIN, also add ALL vice_admins
      // COMMENTED OUT: No notifications to admin/vice_admin
      // if (userRole === 'admin') {
      //   const viceAdminsInGroup = await ConversationsUser.findAll({
      //     where: { conversation_id: 1 },
      //     include: [{
      //       model: User,
      //       where: { role: 'vice_admin' },
      //       attributes: ['user_id']
      //     }]
      //   });
      //   const viceAdminIds = viceAdminsInGroup.map(v => v.User.user_id);
      //   usersToNotify = [...usersToNotify, ...viceAdminIds];
      // }
    } else {
      // Specific drivers provided
      usersToNotify = targetDrivers.map(d => d.user_id);

      // If creator is ADMIN, also add ALL vice_admins
      // COMMENTED OUT: No notifications to admin/vice_admin
      // if (userRole === 'admin') {
      //   const viceAdminsInGroup = await ConversationsUser.findAll({
      //     where: { conversation_id: 1 },
      //     include: [{
      //       model: User,
      //       where: { role: 'vice_admin' },
      //       attributes: ['user_id']
      //     }]
      //   });
      //   const viceAdminIds = viceAdminsInGroup.map(v => v.User.user_id);
      //   usersToNotify = [...usersToNotify, ...viceAdminIds];
      // }
    }

    // FIX: Add the creator to the notification list so they can see their own notification
    // This allows vice_admins to see notifications they created in their inbox
    if (!usersToNotify.includes(user_id)) {
      usersToNotify.push(user_id);
    }

    // Create NotificationRead records
    const notificationReads = usersToNotify.map(user_id => ({
      notification_id: notification.notification_id,
      user_id: user_id,
      is_read: false
    }));

    if (notificationReads.length > 0) {
      await NotificationRead.bulkCreate(notificationReads);
    }

    // Get the full notification with creator info
    const fullNotification = await Notification.findOne({
      where: { notification_id: notification.notification_id },
      include: [{
        model: User,
        as: 'Creator',
        attributes: ['user_id', 'first_name', 'last_name', 'role']
      }]
    });

    // Send socket notification to drivers and vice_admins
    if (usersToNotify.length > 0) {
      const userSocketIds = await UserSocket.findAll({
        where: {
          user_id: { [Op.in]: usersToNotify }
        }
      });

      userSocketIds.forEach((socketData) => {
        socketService
          .getIo()
          .to(socketData.dataValues.socketId)
          .emit("newNotification", {
            notification_id: notification.notification_id,
            title: notification.title,
            content: notification.content,
            type: notification.type,
            created_by: {
              user_id: fullNotification.Creator.user_id,
              name: `${fullNotification.Creator.first_name} ${fullNotification.Creator.last_name}`,
              role: fullNotification.Creator.role
            },
            createdAt: notification.createdAt
          });
      });

      console.log(`Socket notification sent to ${userSocketIds.length} users (drivers and vice_admins)`);

      // Send OneSignal push notification to all recipients
      try {
        // Fetch user details including OneSignal player IDs
        const usersWithPlayerIds = await User.findAll({
          where: {
            user_id: { [Op.in]: usersToNotify }
          },
          attributes: ['user_id', 'one_signal_player_id', 'first_name', 'last_name']
        });

        // Extract valid player IDs
        const playerIds = usersWithPlayerIds
          .map(u => u.one_signal_player_id)
          .filter(id => id && id !== "");

        if (playerIds.length > 0) {
          await pushNotificationAlert({
            player_ids: playerIds,
            title: notification.title,
            content: notification.content,
            data: {
              notification_id: notification.notification_id,
              type: notification.type,
              created_by: {
                user_id: fullNotification.Creator.user_id,
                name: `${fullNotification.Creator.first_name} ${fullNotification.Creator.last_name}`,
                role: fullNotification.Creator.role
              },
              creator_profile_image: fullNotification.Creator.profile_image,
              createdAt: notification.createdAt
            }
          });

          console.log(`OneSignal push sent to ${playerIds.length} devices`);
        } else {
          console.log(`No OneSignal player IDs found for recipients`);
        }
      } catch (pushError) {
        console.error("Error sending OneSignal push notification:", pushError);
        // Don't fail the API call if push notification fails
      }
    }

    return res.status(201).json({
      status: true,
      message: "Notification created successfully",
      data: {
        notification_id: fullNotification.notification_id,
        title: fullNotification.title,
        content: fullNotification.content,
        type: fullNotification.type,
        is_active: fullNotification.is_active,
        created_by: {
          user_id: fullNotification.Creator.user_id,
          name: `${fullNotification.Creator.first_name} ${fullNotification.Creator.last_name}`,
          role: fullNotification.Creator.role
        },
        createdAt: fullNotification.createdAt,
        total_users_notified: notificationReads.length
      }
    });

  } catch (error) {
    console.error("Error creating notification:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while creating notification"
    });
  }
};

module.exports = { createNotification };