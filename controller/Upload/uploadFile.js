const baseUrl = process.env.baseUrl;

const uploadFile = async (req, res) => {
  try {
    const userRole = req.authData.role;

    // Check if file was uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: false,
        message: "No file uploaded"
      });
    }

    const file = req.files[0];
    const fileUrl = `${baseUrl}${file.path}`;

    return res.status(200).json({
      status: true,
      message: "File uploaded successfully",
      data: {
        url: fileUrl,
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      }
    });

  } catch (error) {
    console.error("Error uploading file:", error);
    return res.status(500).json({
      status: false,
      message: "An error occurred while uploading the file",
      error: error.message
    });
  }
};

module.exports = { uploadFile };
