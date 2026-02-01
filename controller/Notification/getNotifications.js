const { Notification, NotificationRead, User } = require("../../models");
const { Op } = require("sequelize");

const getNotifications = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const userRole = req.authData.role;
    const { page = 1, limit = 20, filter = 'all' } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = { is_active: true };

    if (userRole === 'driver') {
      // For drivers, get notifications targeted to them or all drivers
      // Filter: target_driver_ids = "" (all) OR target_driver_ids contains their ID
      whereClause[Op.or] = [
        { target_driver_ids: "" },
        { target_driver_ids: null },
        { target_driver_ids: { [Op.like]: `%${user_id}%` } }
      ];

      // For drivers, get their notifications with read status
      const notifications = await NotificationRead.findAndCountAll({
        where: { user_id },
        include: [{
          model: Notification,
          where: whereClause,
          include: [{
            model: User,
            as: 'Creator',
            attributes: ['user_id', 'first_name', 'last_name', 'role']
          }]
        }],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Apply filter for read/unread if specified
      let filteredNotifications = notifications.rows;
      if (filter === 'read') {
        filteredNotifications = filteredNotifications.filter(n => n.is_read === true);
      } else if (filter === 'unread') {
        filteredNotifications = filteredNotifications.filter(n => n.is_read === false);
      }

      const formattedNotifications = filteredNotifications.map(notifRead => ({
        notification_id: notifRead.Notification.notification_id,
        title: notifRead.Notification.title,
        content: notifRead.Notification.content,
        type: notifRead.Notification.type,
        is_read: notifRead.is_read,
        read_at: notifRead.read_at,
        created_by: {
          user_id: notifRead.Notification.Creator.user_id,
          name: `${notifRead.Notification.Creator.first_name} ${notifRead.Notification.Creator.last_name}`,
          role: notifRead.Notification.Creator.role
        },
        createdAt: notifRead.Notification.createdAt
      }));

      const totalPages = Math.ceil(notifications.count / limit);

      return res.status(200).json({
        status: true,
        message: "Notifications retrieved successfully",
        data: {
          notifications: formattedNotifications,
          pagination: {
            total: notifications.count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages
          }
        }
      });

    } else if (userRole === 'vice_admin') {
      // Vice_admin gets notifications in TWO ways:
      // 1. As a recipient when admin creates notifications (with read status)
      // 2. As creator when they create notifications (management view)

      const { view = 'recipient' } = req.query; // 'recipient' or 'management'

      if (view === 'management') {
        // Management view: See notifications they created (for managing)
        whereClause.created_by = user_id;

        const notifications = await Notification.findAndCountAll({
          where: whereClause,
          include: [
            {
              model: User,
              as: 'Creator',
              attributes: ['user_id', 'first_name', 'last_name', 'role']
            },
            {
              model: NotificationRead,
              attributes: ['user_id', 'is_read', 'read_at']
            }
          ],
          order: [['createdAt', 'DESC']],
          limit: parseInt(limit),
          offset: parseInt(offset)
        });

        const formattedNotifications = notifications.rows.map(notification => ({
          notification_id: notification.notification_id,
          title: notification.title,
          content: notification.content,
          type: notification.type,
          is_active: notification.is_active,
          created_by: {
            user_id: notification.Creator.user_id,
            name: `${notification.Creator.first_name} ${notification.Creator.last_name}`,
            role: notification.Creator.role
          },
          total_reads: notification.NotificationReads.filter(r => r.is_read).length,
          total_recipients: notification.NotificationReads.length,
          createdAt: notification.createdAt
        }));

        const totalPages = Math.ceil(notifications.count / limit);

        return res.status(200).json({
          status: true,
          message: "Notifications retrieved successfully",
          data: {
            notifications: formattedNotifications,
            pagination: {
              total: notifications.count,
              page: parseInt(page),
              limit: parseInt(limit),
              totalPages
            }
          }
        });
      } else {
        // Recipient view: See notifications they received (like drivers do)
        const notifications = await NotificationRead.findAndCountAll({
          where: { user_id },
          include: [{
            model: Notification,
            where: whereClause,
            include: [{
              model: User,
              as: 'Creator',
              attributes: ['user_id', 'first_name', 'last_name', 'role']
            }]
          }],
          order: [['createdAt', 'DESC']],
          limit: parseInt(limit),
          offset: parseInt(offset)
        });

        // Apply filter for read/unread if specified
        let filteredNotifications = notifications.rows;
        if (filter === 'read') {
          filteredNotifications = filteredNotifications.filter(n => n.is_read === true);
        } else if (filter === 'unread') {
          filteredNotifications = filteredNotifications.filter(n => n.is_read === false);
        }

        const formattedNotifications = filteredNotifications.map(notifRead => ({
          notification_id: notifRead.Notification.notification_id,
          title: notifRead.Notification.title,
          content: notifRead.Notification.content,
          type: notifRead.Notification.type,
          is_read: notifRead.is_read,
          read_at: notifRead.read_at,
          created_by: {
            user_id: notifRead.Notification.Creator.user_id,
            name: `${notifRead.Notification.Creator.first_name} ${notifRead.Notification.Creator.last_name}`,
            role: notifRead.Notification.Creator.role
          },
          createdAt: notifRead.Notification.createdAt
        }));

        const totalPages = Math.ceil(notifications.count / limit);

        return res.status(200).json({
          status: true,
          message: "Notifications retrieved successfully",
          data: {
            notifications: formattedNotifications,
            pagination: {
              total: notifications.count,
              page: parseInt(page),
              limit: parseInt(limit),
              totalPages
            }
          }
        });
      }
    } else if (userRole === 'admin') {
      // Admin sees ALL notifications in management view
      const notifications = await Notification.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'Creator',
            attributes: ['user_id', 'first_name', 'last_name', 'role']
          },
          {
            model: NotificationRead,
            attributes: ['user_id', 'is_read', 'read_at']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      const formattedNotifications = notifications.rows.map(notification => ({
        notification_id: notification.notification_id,
        title: notification.title,
        content: notification.content,
        type: notification.type,
        is_active: notification.is_active,
        created_by: {
          user_id: notification.Creator.user_id,
          name: `${notification.Creator.first_name} ${notification.Creator.last_name}`,
          role: notification.Creator.role
        },
        total_reads: notification.NotificationReads.filter(r => r.is_read).length,
        total_recipients: notification.NotificationReads.length,
        createdAt: notification.createdAt
      }));

      const totalPages = Math.ceil(notifications.count / limit);

      return res.status(200).json({
        status: true,
        message: "Notifications retrieved successfully",
        data: {
          notifications: formattedNotifications,
          pagination: {
            total: notifications.count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages
          }
        }
      });
    } else {
      return res.status(403).json({
        status: false,
        message: "You don't have permission to view notifications"
      });
    }

  } catch (error) {
    console.error("Error getting notifications:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while fetching notifications"
    });
  }
};

module.exports = { getNotifications };