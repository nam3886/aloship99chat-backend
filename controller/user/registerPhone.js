const { default: axios } = require("axios");
const { User, Website_Setting } = require("../../models");
const fs = require("fs"); // Require the Node.js 'fs' module for file system operations
const baseUrl = process.env.baseUrl;
// Twilio is disabled - using default OTP
// const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;
// const client = require("twilio")(accountSid, authToken);
const jwt = require("jsonwebtoken");
let jwtSecretKey = process.env.JWT_SECRET_KEY;

const registerPhone = async (req, res) => {
  // console.log(accountSid, "accountSid");
  // console.log(authToken, "authToken");
  let { country_code, phone_number, country, country_full_name } = req.body;
  // console.log(`${country_code}${phone_number}`);
  if (phone_number == "" || !phone_number) {
    return res
      .status(400)
      .json({ message: "phone_number field is required!", success: false });
  }

  try {
    // const resData = await User.create({ phone_number });
    const checkUser = await User.findOne({
      where: { phone_number },
    });
    // console.log(checkUser);
    let generatedOtp = 123456; // Default OTP for testing
    // console.log(generatedOtp, "generatedOtp");

    if (!checkUser) {
      // SHIP99: Prevent self-registration
      // Only admin-created users can exist in the system
      return res.status(403).json({
        message: "User not found. Please contact admin to create an account.",
        success: false
      });
    } else {
      // Skip Twilio SMS and directly update user with default OTP
      try {
        await User.update(
          { otp: generatedOtp },
          {
            where: { phone_number }
          }
        );
        console.log(`Default OTP ${generatedOtp} updated for ${phone_number}`);
        return res.status(200).json({ message: "Otp Sent!", success: true });
      } catch (error) {
        console.error(error);
        return res
          .status(200)
          .json({ message: "Otp not sent", success: false });
      }

      // return res
      //   .status(400)
      //   .json({ message: "User allready registered!", success: false });
    }
  } catch (error) {
    console.error(error);
    // Handle the Sequelize error and send it as a response to the client
    res.status(500).json({ error: error });
  }
};

const verifyPhoneOtp = async (req, res) => {
  let { country_code, phone_number, otp, device_token, one_signal_player_id } =
    req.body;

  if (phone_number == "" || !phone_number) {
    return res
      .status(400)
      .json({ message: "phone_number field is required!", success: false });
  }

  if (country_code == "" || !country_code) {
    return res
      .status(400)
      .json({ message: "country_code field is required!", success: false });
  }

  if (otp == "" || !otp) {
    return res
      .status(400)
      .json({ message: "otp field is required!", success: false });
  }

  try {
    const resData = await User.findOne({
      where: { country_code, phone_number, otp },
    });
    // console.log("newResData", newResData);
    // console.log(resData);
    if (resData) {
      // console.log(newResData);
      const tokenData = {
        ...resData.dataValues,
        login_timestamp: Date.now() // Makes each token unique
      };
      const token = jwt.sign(tokenData, jwtSecretKey);

      // Update Device Token and Active Session ==================================================================
      User.update(
        {
          device_token,
          one_signal_player_id,
          active_session_token: token, // Set active session on registration
          last_login_at: new Date(),
          last_login_device: device_token ? 'Mobile' : 'Web'
        },
        {
          where: { country_code, phone_number },
        }
      );

      // let is_require_filled = false;
      // if (
      //   // resData.dataValues.phone_number != "" &&
      //   // resData.dataValues.email_id != "" &&
      //   resData.dataValues.first_name != "" &&
      //   resData.dataValues.last_name != ""
      // ) {
      //   is_require_filled = true;
      // }
      res.status(200).json({
        message: "Otp Verified",
        success: true,
        token: token,
        resData: resData,
        // is_require_filled,
      });
    } else {
      res.status(200).json({ message: "Invalid otp!", success: false });
    }
  } catch (error) {
    // Handle the Sequelize error and send it as a response to the client
    res.status(500).json({ error: error.message });
  }
};

module.exports = { registerPhone, verifyPhoneOtp };
