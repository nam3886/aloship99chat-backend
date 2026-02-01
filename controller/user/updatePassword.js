const { User } = require("../../models");
const bcrypt = require("bcryptjs");

const updatePassword = async (req, res) => {
  try {
    const user_id = req.authData.user_id;
    const { old_password, new_password } = req.body;

    // Validate required fields
    if (!old_password || old_password === "") {
      return res.status(400).json({
        status: false,
        message: "old_password is required"
      });
    }

    if (!new_password || new_password === "") {
      return res.status(400).json({
        status: false,
        message: "new_password is required"
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        status: false,
        message: "new_password must be at least 6 characters"
      });
    }

    // Get user
    const user = await User.findOne({
      where: { user_id }
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found"
      });
    }

    // Verify old password
    let isOldPasswordValid = false;

    if (!user.password || user.password === '') {
      // If no password set, check if old_password is default
      isOldPasswordValid = (old_password === '123456');
    } else if (user.password === '123456' || user.password === old_password) {
      // Plain text password match
      isOldPasswordValid = true;
    } else {
      // Try bcrypt comparison
      try {
        if (user.password.startsWith('$2')) { // bcrypt hash
          isOldPasswordValid = await bcrypt.compare(old_password, user.password);
        } else {
          isOldPasswordValid = false;
        }
      } catch (err) {
        isOldPasswordValid = false;
      }
    }

    if (!isOldPasswordValid) {
      return res.status(401).json({
        status: false,
        message: "Old password is incorrect"
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    // Update password
    await User.update(
      { password: hashedPassword },
      { where: { user_id } }
    );

    return res.status(200).json({
      status: true,
      message: "Password updated successfully"
    });

  } catch (error) {
    console.error("Error updating password:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while updating password",
      error: error.message
    });
  }
};

module.exports = { updatePassword };
