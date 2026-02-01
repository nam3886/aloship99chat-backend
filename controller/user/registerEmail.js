const { User, Website_Setting } = require("../../models");
const fs = require("fs"); // Require the Node.js 'fs' module for file system operations
const path = require("path"); // Require the Node.js 'fs' module for file system operations
const baseUrl = process.env.baseUrl;
const jwt = require("jsonwebtoken");
let jwtSecretKey = process.env.JWT_SECRET_KEY;
const nodemailer = require("nodemailer");
const { getCountryFromIP } = require("../../reusable/getCountryFromIP");

// const client = require("twilio")(accountSid, authToken);

const registerEmail = async (req, res) => {
  let { email_id } = req.body;
  if (email_id == "" || !email_id) {
    return res
      .status(400)
      .json({ message: "email_id field is required!", success: false });
  }

  if (!process.env.mail_password || !process.env.mail_user) {
    return res.status(400).json({
      message: "failed to send otp!",
      success: false,
    });
  }

  try {
    let settings = await Website_Setting.findAll();

    // const resData = await User.create({ email_id });
    const checkUser = await User.findOne({ where: { email_id } });
    let generatedOtp = Math.floor(100000 + Math.random() * 900000); // Generate random 6-digit OTP

    const LoginLinkTemplate = fs.readFileSync(
      path.resolve(__dirname, "../../public/emailTemplate.html"),
      "utf-8"
    );
    let emailContent = LoginLinkTemplate.replaceAll(
      "{{app_name}}",
      `${settings[0].website_name}`
    );
    emailContent = emailContent.replaceAll(
      "{{banner_image}}",
      `${settings[0].banner_image}`
    );
    emailContent = emailContent.replaceAll(
      "{{website_link}}",
      `${settings[0].website_link}`
    );
    emailContent = emailContent.replaceAll(
      "{{apk_link}}",
      `${settings[0].android_link}`
    );
    emailContent = emailContent.replaceAll(
      "{{ios_link}}",
      `${settings[0].ios_link}`
    );
    emailContent = emailContent.replaceAll(
      "{{generatedOtp}}",
      `${generatedOtp}`
    );
    emailContent = emailContent.replaceAll(
      "{{baseUrl}}",
      `${process.env.baseUrl}`
    );
    emailContent = emailContent.replaceAll(
      "{{copy_right}}",
      `${settings[0].copy_right}`
    );

    // Configure nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: process.env.email_service,
      host: process.env.smtp_host,
      port: 587,
      secure: false,
      auth: {
        user: process.env.mail_user,
        pass: process.env.mail_password,
      },
    });

    // Email options
    const mailOptions = {
      from: process.env.mail_user,
      to: email_id,
      subject: `Your OTP for ${settings[0].website_name}`,
      html: emailContent,
    };

    // Fetch user country ==================================================================================
    let { countryCode, country } = await getCountryFromIP(req);

    if (!checkUser) {
      // Send email and create user
      try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP ${generatedOtp} sent to ${email_id}`);

        await User.create({
          email_id,
          otp: generatedOtp,
          country: countryCode,
          country_full_name: country,
        });
        return res
          .status(200)
          .json({ message: "Otp Sent on your email!", success: true });
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        return res.status(500).json({
          message: "Failed to send OTP email!",
          success: false,
        });
      }
    } else {
      // Send email for existing user
      try {
        await transporter.sendMail(mailOptions);
        console.log(`OTP ${generatedOtp} sent to ${email_id}`);

        await User.update(
          {
            otp: generatedOtp,
            country: countryCode,
            country_full_name: country,
          },
          {
            where: {
              email_id: email_id,
            },
          }
        );
        return res.status(200).json({
          message: "Otp Sent on your email!",
          success: true,
        });
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        return res.status(500).json({
          message: "Failed to send OTP email!",
          success: false,
        });
      }
    }
  } catch (error) {
    console.log(error);

    // Handle the Sequelize error and send it as a response to the client
    return res.status(500).json({ error: error });
  }
};

const verifyEmailOtp = async (req, res) => {
  let { email_id, otp, device_token } = req.body;
  if (email_id == "" || !email_id) {
    return res
      .status(400)
      .json({ message: "email_id field is required!", success: false });
  }

  if (otp == "" || !otp) {
    return res
      .status(400)
      .json({ message: "otp field is required!", success: false });
  }

  try {
    const resData = await User.findOne({ where: { email_id, otp } });
    // console.log("newResData", newResData);
    // console.log(resData);
    if (resData) {
      const tokenData = {
        ...resData.dataValues,
        login_timestamp: Date.now() // Makes each token unique
      };
      const token = jwt.sign(tokenData, jwtSecretKey);

      // Update device token and active session
      let updateFields = {
        active_session_token: token,
        last_login_at: new Date(),
        last_login_device: device_token ? 'Mobile' : 'Web'
      };

      if (device_token != "" && device_token != undefined) {
        updateFields.device_token = device_token;
      }

      await User.update(
        updateFields,
        {
          where: {
            email_id: email_id,
          },
        }
      );

      res.status(200).json({
        message: "Otp Verified",
        success: true,
        token: token,
        resData: resData,
      });
    } else {
      res.status(400).json({ message: "Invalid otp!", success: false });
    }
  } catch (error) {
    // Handle the Sequelize error and send it as a response to the client
    res.status(500).json({ error: error.message });
  }
};

module.exports = { registerEmail, verifyEmailOtp };
