const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // React frontend
    methods: ["GET", "POST"],
  },
});

mongoose.connect("mongodb://localhost:27017/chat-app");

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
});
const User = mongoose.model("User", userSchema);

const messageSchema = new mongoose.Schema({
  content: String,
  sender: String,
  recipient: String,
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", messageSchema);

app.use(cors());
app.use(express.json());

const JWT_SECRET = "oak89kak";

// Register user
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(400).json({ error: "Username already exists" });
  }
});

// User login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (user && (await bcrypt.compare(password, user.password))) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// Middleware to authenticate JWT tokens
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.sendStatus(403);

  jwt.verify(token.split(" ")[1], JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// REST API to fetch all users
app.get("/users", authenticateToken, async (req, res) => {
  const users = await User.find({ username: { $ne: req.user.username } });
  res.json(users);
});

// REST API to fetch conversation history with a specific user
app.get("/messages/:recipient", authenticateToken, async (req, res) => {
  const { recipient } = req.params;
  const sender = req.user.username;
  const messages = await Message.find({
    $or: [
      { sender, recipient },
      { sender: recipient, recipient: sender },
    ],
  }).sort({ timestamp: 1 });
  res.json(messages);
});

// Socket.IO setup
let users = {}; // Track connected users

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // When a user logs in (frontend sends username), associate the username with socket ID
  socket.on("login", (username) => {
    users[username] = socket.id;
    console.log(`${username} logged in with socket id ${socket.id}`);
  });

  // Listen for private messages
  socket.on("sendMessage", async ({ content, sender, recipient }) => {
    try {
      // Save the message to the database
      const message = new Message({ content, sender, recipient });
      await message.save();

      // Emit the message to the recipient's socket (private chat)
      const recipientSocket = users[recipient];
      if (recipientSocket) {
        io.to(recipientSocket).emit("receiveMessage", message);
        console.log(`Message sent to ${recipient}`);
      } else {
        console.log(`Recipient ${recipient} is offline`);
      }
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("disconnect", () => {
    // Remove user from users map on disconnect
    for (const [username, socketId] of Object.entries(users)) {
      if (socketId === socket.id) {
        delete users[username];
        console.log(`${username} disconnected`);
        break;
      }
    }
  });
});

// Start the server
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
