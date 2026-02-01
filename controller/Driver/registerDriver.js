const { User } = require("../../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const jwtSecretKey = process.env.JWT_SECRET_KEY;

const registerDriver = async (req, res) => {
  try {
    const {
      phone_number,
      user_name,
      first_name,
      last_name,
      gender,
      password,
    } = req.body;

    // Validation
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: "phone_number is required"
      });
    }
    if (!user_name) {
      return res.status(400).json({
        success: false,
        message: "user_name is required"
      });
    }
    if (!first_name) {
      return res.status(400).json({
        success: false,
        message: "first_name is required"
      });
    }
    // if (!last_name) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "last_name is required"
    //   });
    // }
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "password is required"
      });
    }

    // Check if phone number already exists
    const existingUser = await User.findOne({
      where: { phone_number }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Phone number already registered"
      });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({
      where: { user_name }
    });

    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: "Username already taken"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with role 'driver' and is_profile_approved = false
    const newUser = await User.create({
      phone_number,
      user_name,
      first_name,
      last_name: last_name || '',
      gender: gender || '',
      // profile_image: profile_image || '',
      password: hashedPassword,
      role: 'driver',
      is_profile_approved: false, // Not approved until profile request is approved
      is_mobile: true,
      country: "VN",
      country_full_name: "Vietnam",
      country_code: "+84"
    });

    // Generate token
    const tokenData = {
      user_id: newUser.user_id,
      phone_number: newUser.phone_number,
      role: newUser.role,
      login_timestamp: Date.now()
    };
    const token = jwt.sign(tokenData, jwtSecretKey);

    // Update active session
    await User.update(
      {
        active_session_token: token,
        last_login_at: new Date(),
        last_login_device: 'Mobile'
      },
      {
        where: { user_id: newUser.user_id }
      }
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful. Please submit your profile for approval.",
      token,
      user: newUser
    });

  } catch (error) {
    console.error("Register Driver Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = { registerDriver };
