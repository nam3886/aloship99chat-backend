const { Notification, NotificationRead } = require("../../models");

const deleteNotification = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const userRole = req.authData.role;
    const { notification_id } = req.params;

    // Check permissions - only admin and vice_admin can delete
    if (userRole !== 'admin' && userRole !== 'vice_admin') {
      return res.status(403).json({
        status: false,
        message: "Only admin and vice admin can delete notifications"
      });
    }

    // Find the notification
    const notification = await Notification.findOne({
      where: { notification_id }
    });

    if (!notification) {
      return res.status(404).json({
        status: false,
        message: "Notification not found"
      });
    }

    // If vice_admin, check if they created this notification
    if (userRole === 'vice_admin' && notification.created_by !== user_id) {
      return res.status(403).json({
        status: false,
        message: "You can only delete notifications you created"
      });
    }

    // Delete all related NotificationRead records first
    await NotificationRead.destroy({
      where: { notification_id }
    });

    // Delete the notification
    await notification.destroy();

    return res.status(200).json({
      status: true,
      message: "Notification deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while deleting notification"
    });
  }
};

module.exports = { deleteNotification };