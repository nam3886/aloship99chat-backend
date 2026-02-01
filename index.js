const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const db = require("./models");
const upload = require("./middleware/upload");
dotenv.config();
const cors = require("cors");
const fs = require("fs");
const no_auth_route = require("./routes/NoAuthRoutes");
const auth_routes = require("./routes/AuthRoutes");
const admin_routes = require("./routes/Admin.routes");
const http = require("http");
const path = require("path");
const socketIo = require("socket.io");
const app = express();
const server = http.createServer(app);
const { UserSocket, Language_status, User } = require("./models");
const { Op } = require("sequelize");
const jwt = require("jsonwebtoken");
const os = require("os");
const getmac = require("getmac").default;
const axios = require("axios");
const {
    checkWebsettingAndCreate,
} = require("./controller/Admin/webSettingController");

// Redis adapter for Socket.IO clustering (100 CCU support)
const { createAdapter } = require("@socket.io/redis-adapter");
const { Redis } = require("ioredis");

// const io = socketIo(server);
const io = socketIo(server, {
    cors: {
        origin: true,
        methods: ["GET", "POST"],
        credentials: true
    },
    path: "/socket",
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 60000,
    allowEIO3: true,
    maxHttpBufferSize: 1e9, // Set a higher limit for 1GB files
});

// Setup Redis adapter for Socket.IO (enables clustering)
const REDIS_HOST = process.env.REDIS_HOST || "redis";
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const pubClient = new Redis({ host: REDIS_HOST, port: REDIS_PORT });
const subClient = pubClient.duplicate();

Promise.all([pubClient.ping(), subClient.ping()])
    .then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log("✅ Redis adapter connected for Socket.IO clustering");
    })
    .catch((err) => {
        console.error("❌ Redis connection failed, running without clustering:", err.message);
    });

const port = process.env.PORT || 3001;

// For user -> for one device one time
const authMiddleware = require("./middleware/authMiddleware");
// For admin - more device login
const adminAuthMiddleware = require("./middleware/adminAuthMiddleware");
const socketService = require("./reusable/socketService");
const cron = require("node-cron");

const {
    removeStatusAfter24Hours,
} = require("./controller/Status/removeStatusAfter24Hours");

app.use(
    cors({
        origin: "*",
    })
);

// for parsing application/json with 1GB limit
app.use(bodyParser.json({ limit: '1gb' }));

// for parsing application/xwww- with 1GB limit
app.use(bodyParser.urlencoded({ extended: true, limit: '1gb' }));
//form-urlencoded

// for parsing multipart/form-data
// app.use(upload.array("files"));
const fileUploadMiddleware = upload.fields([
    { name: "files", maxCount: 10 },
    { name: "darkLogo", maxCount: 1 },
    { name: "profile_image", maxCount: 1 },
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 },
]);

app.use((req, res, next) => {
    fileUploadMiddleware(req, res, function (err) {
        if (err) {
            return next(err); // Handle Multer errors
        }

        // Handle darkLogo separately
        if (req?.files?.["darkLogo"]) {
            req.darkLogo = req.files["darkLogo"];
            req.darkLogo.forEach((file, index) => {
                console.log(`darkLogo[${index}]: ${file.originalname} - ${file.size} bytes`);
            });
        } else {
            req.darkLogo = [];
        }

        // Convert req.files to array format for backward compatibility
        // But only if "files" field exists, otherwise keep the original structure
        if (req?.files?.["files"]) {
            // Store the original files object
            req.filesObject = req.files;
            // For backward compatibility, make req.files an array of the "files" field
            req.files = req.files["files"];
            req.files.forEach((file, index) => {
                console.log(`files[${index}]: ${file.originalname} - ${file.size} bytes`);
            });
        } else if (req?.files) {
            // Keep the original structure for other endpoints
            req.filesObject = req.files;
            // For user-details and other endpoints, convert to array format
            const fileFields = Object.keys(req.files);
            if (fileFields.length === 1 && req.files[fileFields[0]]) {
                req.files = req.files[fileFields[0]];
            } else {
                req.files = [];
            }
        } else {
            req.files = [];
        }

        next(); // Continue to next middleware or route handler
    });
});
// to provide files to users
app.use("/uploads", express.static("uploads"));
app.use("/public", express.static("public"));

// Schedule the task to run every hour =========================================
cron.schedule("0 * * * *", () => {
    removeStatusAfter24Hours();
});

// for React website
// XÓA validatePurchaseCode và middleware kiểm tra purchase code

// Purchase code validation route (public route)
// Bỏ route /api/validate nếu không cần thiết
app.post("/api/validate", async (req, res) => {
    console.log("Received Headers:", req.headers);
    console.log("Received Body:", req.body); // Log the body for debugging

    const macAddress = getMacAddress();
    const deviceIp = req.ip; // Get the IP address of the client
    const { purchase_code, username } = req.body;
    if (!macAddress) {
        return res.status(500).json({ error: "Unable to retrieve MAC address." });
    }

    // Additional validation for purchase_code
    if (!purchase_code) {
        return res.status(400).json({ error: "Purchase code is required." });
    }
    if (!username) {
        return res.status(400).json({ error: "username is required." });
    }

    try {
        const response = await axios.post(
            "http://62.72.36.245:1142/validate",
            // "http://192.168.0.27:1142/validate",
            {
                purchase_code: purchase_code,
                username: username,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "User-Agent": "Your User Agent",
                    "X-MAC-Address": getMacAddress(),
                    "X-Device-IP": getServerIP(), // Pass the device IP address in the headers
                    // Optional: Add any other headers you want to forward
                },
            }
        );
        console.log(response);

        if (response.data.status == "used") {
            return res.status(400).json({ error: response.data.message });
        }
        if (response.data.status == "error") {
            return res.status(400).json({ error: response.data.message });
        }
        if (response.data.status == "invalid") {
            return res.status(400).json({ error: response.data.message });
        }
        const { token } = response.data;

        // Store the token securely
        fs.writeFileSync("./validatedToken.txt", token);

        res.json({ message: "Validation successful!", token });
    } catch (error) {
        console.error("Validation error:", error);
        res.status(400).json({ error: "Validation failed!" });
    }
});

// Middleware to protect routes with purchase code validation

// Function to verify token
async function verifyToken() {
    const tokenFilePath = path.join(__dirname, "validatedToken.txt");

    if (!fs.existsSync(tokenFilePath)) {
        console.log("Token file does not exist. No verification needed.");
        return false; // No token file found, no verification needed
    }

    try {
        const token = await fs.promises.readFile(tokenFilePath, "utf-8");

        const verificationResponse = await axios.post(
            "http://62.72.36.245:1142/verify_new",
            // "http://192.168.0.27:1142/verify_new",
            {
                server_ip: getServerIP(),
                mac_address: getMacAddress(),
                token: token,
            }
        );
        if (!verificationResponse.data.success) {
            // If verification fails, remove the current directory
            console.log("Token verification failed. Removing current directory...");
            return false; // Return false on failure
        }
        return verificationResponse.data.success; // Return verification success status
    } catch (error) {
        console.error("Error during token verification:", error);
        return false;
    }
}

// for React website
app.use(express.static(path.join(__dirname, "/admin")));

function getMacAddress() {
    try {
        const mac = getmac();
        return mac;
    } catch (err) {
        console.error("Error fetching MAC address:", err);
        return null;
    }
}

function getServerIP() {
    const networkInterfaces = os.networkInterfaces();

    for (const interfaceName in networkInterfaces) {
        for (const interface of networkInterfaces[interfaceName]) {
            // Check for IPv4 and non-internal addresses (to exclude localhost)
            if (interface.family === "IPv4" && !interface.internal) {
                return interface.address;
            }
        }
    }

    return "IP address not found";
}

// Schedule the task to run every hour ============const {Language_status} = require('./models');
app.get("/", async (req, res) => {
    try {
        // res.json({ message: "Server is Running ✅", success: true });
        return res.sendFile(path.join(__dirname, "/admin", "index.html"));
    } catch (error) {
        // Handle the Sequelize error and send it as a response to the client
        res.status(500).json({ error: error.message });
    }
});

// Define your unauthenticated routes
app.use("/api", no_auth_route);

// Custom middleware for handling user/socket association
const handleUserSocketAssociation = async (socket, next) => {
    // Access the user_id sent by the client during connection
    let authToken = socket.handshake.query.token;
    let authData;
    // console.log(authToken);

    // Validate that userId is present
    if (!authToken) {
        return next(new Error("Missing token during connection."));
    }

    try {
        let jwtSecretKey = process.env.JWT_SECRET_KEY;
        // check if the token is valid or not
        authData = jwt.verify(
            authToken, // auth tokenÁ
            jwtSecretKey
        );

        // Check if this token is the active session
        const user = await User.findOne({
            where: { user_id: authData.user_id },
            attributes: ['user_id', 'active_session_token', 'Blocked_by_admin', 'is_account_deleted']
        });

        if (!user) {
            return next(new Error("User not found"));
        }

        if (user.is_account_deleted) {
            return next(new Error("Account has been deleted"));
        }

        if (user.Blocked_by_admin) {
            return next(new Error("Account has been blocked"));
        }

        // Verify this is the active session token
        if (user.active_session_token !== authToken) {
            return next(new Error("Session expired - logged in from another device"));
        }

        socket.handshake.query.user_id = authData.user_id;
    } catch (error) {
        console.error(error);
        return next(new Error("Invalid token"));
    }

    try {
        const userId = socket.handshake.query.user_id;

        // Create a new entry for each connection
        await UserSocket.create({
            user_id: userId,
            socketId: socket.id,
        });

        // Continue with the Socket.IO connection handling
        next();
    } catch (error) {
        console.error("Error storing user/socket association:", error);
        // Handle the error appropriately, such as disconnecting the user
        next(new Error("Error storing user/socket association."));
    }
};

// Socket.IO connection handling with the custom middleware
io.use(handleUserSocketAssociation);

// Initialize socket
socketService.initSocket(io);

// Define your authenticated routes ==================================================================================

// Admin routes - allow multiple device login (no single-device restriction)
app.use("/api", adminAuthMiddleware, admin_routes);

// User routes - enforce single device login
app.use("/api", authMiddleware, auth_routes);

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "admin", "index.html"));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Something went wrong!", success: false });
});

const {
    addLanguageColumn,
    addDefaultEntries,
} = require("./reusable/add_new_language");
const {
    checkAppFlowAndCreate,
} = require("./controller/Admin/AppFlow.Controller");
const { checkAdminAndCreate } = require("./controller/Admin/admin.login");
const {
    checkAppsettingAndCreate,
} = require("./controller/Admin/appsettingController");
const {
    checkOneSignalsettingAndCreate,
    checkGroupsettingAndCreate,
} = require("./controller/Admin/oneSignalsettingController");
async function fetchLanguages() {
    try {
        const all_Languages = await Language_status.findAll();
        const languagelist = all_Languages.map((lang) => {
            return lang.dataValues.language;
        });
        return languagelist;
        // console.log(languagelist);
    } catch (error) {
        console.error("Error fetching languages:", error);
    }
}

db.sequelize.sync({ alter: false }).then(async () => {
    // Make this function async to use await
    // StaticEntries
    await checkAppFlowAndCreate();
    await checkAdminAndCreate();
    await checkAppsettingAndCreate();
    await checkWebsettingAndCreate();
    await checkOneSignalsettingAndCreate();
    await addDefaultEntries();
    await checkGroupsettingAndCreate();

    console.log("Database Connected ✅!");
    // UserSocket.destroy({ truncate: false, cascade: false });
    const tokenFilePath = path.join(__dirname, "validatedToken.txt");
    if (fs.existsSync(tokenFilePath)) {
        const isValid = await verifyToken();

        if (isValid) {
            // UserSocket.destroy({ truncate: false, cascade: false });
            const languagelist = await fetchLanguages(); // Await here to get the result

            // Loop over the languagelist if it's not empty
            if (languagelist && languagelist.length > 0) {
                for (let index = 0; index < languagelist.length; index++) {
                    const element = languagelist[index];
                    await addLanguageColumn(element);
                }
            } else {
                console.log("No languages found.");
            }
        } else {
            console.log("Token is invalid. Serving validation page.");
            const languagelist = await fetchLanguages(); // Await here to get the result

            // Loop over the languagelist if it's not empty
            if (languagelist && languagelist.length > 0) {
                for (let index = 0; index < languagelist.length; index++) {
                    const element = languagelist[index];
                    await addLanguageColumn(element);
                }
            } else {
                console.log("No languages found.");
            }
        }
    } else {
        console.log("Token file does not exist. No verification needed.");
        // UserSocket.destroy({ truncate: false, cascade: false });
        const languagelist = await fetchLanguages(); // Await here to get the result

        // Loop over the languagelist if it's not empty
        if (languagelist && languagelist.length > 0) {
            for (let index = 0; index < languagelist.length; index++) {
                const element = languagelist[index];
                await addLanguageColumn(element);
            }
        } else {
            console.log("No languages found.");
        }
    }
    server.listen(port, () => {
        console.log(`Server listening on port ${port}!`);

        // Start periodic stale socket cleanup (every 5 minutes)
        setInterval(async () => {
            try {
                console.log("\n========== [CLEANUP] START ==========");
                console.log(`[CLEANUP] Timestamp: ${new Date().toISOString()}`);

                // Get all socket IDs from database
                const allDbSockets = await UserSocket.findAll({
                    attributes: ["socketId", "user_id"]
                });

                console.log(`[CLEANUP] Sockets in DB: ${allDbSockets.length}`);
                console.log(`[CLEANUP] Sockets in memory: ${io.sockets.sockets.size}`);

                let cleanedCount = 0;
                const cleanedUsers = [];

                for (const dbSocket of allDbSockets) {
                    // Check if socket still exists in socket.io
                    const socketExists = io.sockets.sockets.get(dbSocket.socketId);

                    if (!socketExists) {
                        // Socket doesn't exist, remove from database
                        await UserSocket.destroy({
                            where: { socketId: dbSocket.socketId }
                        });
                        cleanedUsers.push({ user_id: dbSocket.user_id, socketId: dbSocket.socketId });
                        cleanedCount++;
                    }
                }

                if (cleanedCount > 0) {
                    console.log(`[CLEANUP] ⚠️ Cleaned ${cleanedCount} stale socket(s):`);
                    cleanedUsers.forEach(u => {
                        console.log(`  - User ${u.user_id}: ${u.socketId}`);
                    });
                } else {
                    console.log(`[CLEANUP] ✅ No stale sockets found`);
                }

                // Log current socket statistics
                const totalSockets = await UserSocket.count();
                const uniqueUsers = await UserSocket.count({
                    distinct: true,
                    col: 'user_id'
                });
                console.log(`[CLEANUP] 📊 After cleanup: ${totalSockets} sockets for ${uniqueUsers} users`);
                console.log("========== [CLEANUP] END ==========\n");

            } catch (error) {
                console.error("Error in periodic socket cleanup:", error);
            }
        }, 5 * 60 * 1000); // Run every 5 minutes

        console.log("✅ Periodic socket cleanup scheduled (every 5 minutes)");

        // Signal PM2 that the app is ready (for cluster mode)
        if (process.send) {
            process.send('ready');
            console.log("✅ PM2 ready signal sent");
        }
    });
});

