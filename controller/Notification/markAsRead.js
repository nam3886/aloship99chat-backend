const { NotificationRead } = require("../../models");

const markAsRead = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const userRole = req.authData.role;
    const { notification_id } = req.params;

    // Only drivers and vice_admins can mark notifications as read
    if (userRole !== 'driver' && userRole !== 'vice_admin') {
      return res.status(403).json({
        status: false,
        message: "Only drivers and vice admins can mark notifications as read"
      });
    }

    // Find the notification read record for this user
    const notificationRead = await NotificationRead.findOne({
      where: {
        notification_id,
        user_id
      }
    });

    if (!notificationRead) {
      return res.status(404).json({
        status: false,
        message: "Notification not found for this user"
      });
    }

    // Update the read status
    await notificationRead.update({
      is_read: true,
      read_at: new Date()
    });

    return res.status(200).json({
      status: true,
      message: "Notification marked as read",
      data: {
        notification_id: notificationRead.notification_id,
        is_read: true,
        read_at: notificationRead.read_at
      }
    });

  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while marking notification as read"
    });
  }
};

module.exports = { markAsRead };