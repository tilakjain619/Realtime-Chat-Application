import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";
import { format } from "date-fns";
import './home.css'

const socket = io("http://localhost:5000");

const Home = () => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState(localStorage.getItem("username") || ""); // Persist username
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (token) {
      socket.emit("login", username); // Associate socket with username
      fetchUsers(); // Fetch users list on login
    }

    socket.on("receiveMessage", (message) => {
      if (
        message.sender === selectedUser ||
        message.recipient === selectedUser
      ) {
        setMessages((prevMessages) => [...prevMessages, message]);
      }
    });

    return () => {
      socket.off("receiveMessage");
    };
  }, [token, username, selectedUser]);

  const login = async () => {
    try {
      const response = await axios.post("http://localhost:5000/login", {
        username,
        password,
      });
      setToken(response.data.token);
      localStorage.setItem("token", response.data.token); // Save token in localStorage
      localStorage.setItem("username", username); // Save username in localStorage
    } catch (error) {
      alert("Invalid credentials");
    }
  };

  const register = async () => {
    try {
      const response = await axios.post("http://localhost:5000/register", {
        username,
        password,
      });
      alert(response.data.message);
      setIsRegistering(false); // Close register form after successful registration
    } catch (error) {
      alert(error.response.data.error);
    }
  };

  const logout = () => {
    setToken("");
    localStorage.removeItem("token"); // Remove token from localStorage
    localStorage.removeItem("username"); // Remove username from localStorage
    setUsername("");
    setPassword("");
    setUsers([]);
    setMessages([]);
    setSelectedUser("");
  };

  const fetchUsers = async () => {
    if (token) {
      try {
        const response = await axios.get("http://localhost:5000/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(response.data);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    }
  };

  const fetchMessages = async (recipient) => {
    if (token) {
      try {
        const response = await axios.get(
          `http://localhost:5000/messages/${recipient}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setMessages(response.data);
        setSelectedUser(recipient);
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    }
  };

  const sendMessage = () => {
    if (message.trim() && token && selectedUser) {
      const newMessage = {
        content: message,
        sender: username,
        recipient: selectedUser,
      };
      socket.emit("sendMessage", newMessage);
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      setMessage("");
    }
  };

  return (
    <div className="home-container">
      <div className="header">
        <h1 className="title">Realtime Chat App</h1>
        {token && <button onClick={logout}>Logout</button>}
      </div>

      {!token ? (
        <div className="login-container">
          {isRegistering ? (
            <div className="register-form">
              <h3 className="form-title">Register</h3>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="buttons">
                <button className="register-btn" onClick={register}>Register</button>
                <button className="login-btn" onClick={() => setIsRegistering(false)}>Back to Login</button>
              </div>
            </div>
          ) : (
            <div className="login-form">
              <h3 className="form-title">Login</h3>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="buttons">
                <button className="login-btn" onClick={login}>Login</button>
                <button className="register-btn" onClick={() => setIsRegistering(true)}>Register instead</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="chat-container">
          <div className="user-container">
            <h2>Users</h2>
            <ul className="user-list">
              {users.map((user) => (
                <li key={user.username} onClick={() => fetchMessages(user.username)}>
                  <p className="user-avatar">{user.username.charAt(0).toUpperCase()}</p>
                  <span>{user.username}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="chat-board ">
            {selectedUser ? (
              <div>
                <h3>Chat with {selectedUser}</h3>
                <ul className="chats">
                  {messages.map((msg, index) => (
                    <li key={index} className="chat-message">
                      <p className={msg.sender == username ? "me" : "other"}>
                        {msg.content}
                      </p>
                      <span className={msg.sender === username ? "me-time" : undefined}>
  {msg.timestamp ? format(new Date(msg.timestamp), "d MMM, h:mm a") : "Unknown Time"}
</span>

                    </li>
                  ))}
                </ul>
                <div className="msg-container">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message"
                  />
                  <button onClick={sendMessage}>Send</button>
                </div>
              </div>
            )
          :
          <h2 className="chat-info">Click any chat to open</h2>
          }
          </div>

        </div>
      )}
    </div>
  );
};

export default Home;
