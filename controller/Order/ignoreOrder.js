const { Order, OrderAction } = require("../../models");
const { checkCooldown } = require("../../reusable/cooldownHelper");

const ignoreOrder = async (req, res) => {
  try {
    const { order_id } = req.body;
    const user_id = req.authData.user_id;
    const userRole = req.authData.role;

    if (!order_id) {
      return res.status(400).json({
        status: false,
        message: "order_id is required"
      });
    }

    if (userRole !== 'driver') {
      return res.status(403).json({
        status: false,
        message: "Only drivers can ignore orders"
      });
    }

    const order = await Order.findOne({
      where: { order_id }
    });

    if (!order) {
      return res.status(404).json({
        status: false,
        message: "Order not found"
      });
    }

    if (order.status !== 'open') {
      return res.status(400).json({
        status: false,
        message: "Order is no longer open"
      });
    }

    // Check cooldown based on group settings
    try {
      await checkCooldown(user_id, 1);
    } catch (error) {
      return res.status(429).json({
        status: false,
        message: error.message
      });
    }

    await OrderAction.create({
      order_id,
      user_id,
      action_type: 'ignore'
    });

    return res.status(200).json({
      status: true,
      message: "Order ignored successfully"
    });

  } catch (error) {
    console.error("Error ignoring order:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while ignoring the order"
    });
  }
};

module.exports = { ignoreOrder };