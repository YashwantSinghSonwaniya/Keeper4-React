const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// ✅ REGISTER
async function register(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters." });
  }

  try {
    // Check if email already exists
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    const user = result.rows[0];

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Account created successfully!",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
}

// ✅ LOGIN
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // Find user
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "No account found with this email." });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Incorrect password." });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful!",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
}

// ✅ FORGOT PASSWORD (simple version — returns reset hint)
async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    const result = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "No account found with this email." });
    }

    // In real app → send email with reset link
    // For now → return success message
    res.json({
      message: "If this email exists, a reset link has been sent.",
    });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
}

// ✅ CHANGE PASSWORD
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "All fields are required." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      error: "New password must be at least 6 characters.",
    });
  }

  try {
    // Get user from database
    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [req.user.id]
    );

    const user = result.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!validPassword) {
      return res.status(400).json({
        error: "Current password is incorrect.",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update in database
    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashedPassword, req.user.id]
    );

    res.json({ message: "Password changed successfully!" });
  } catch (err) {
    console.error("Change password error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
}

// ✅ DELETE ACCOUNT
async function deleteAccount(req, res) {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: "Password is required." });
  }

  try {
    // Get user
    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [req.user.id]
    );

    const user = result.rows[0];

    // Verify password before deleting
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ error: "Incorrect password." });
    }

    // Delete user — notes auto deleted via CASCADE
    await pool.query("DELETE FROM users WHERE id = $1", [req.user.id]);

    res.json({ message: "Account deleted successfully." });
  } catch (err) {
    console.error("Delete account error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
}

// ✅ UPDATE PROFILE (name)
async function updateProfile(req, res) {
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Name is required." });
  }

  try {
    const result = await pool.query(
      "UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email",
      [name.trim(), req.user.id]
    );

    res.json({
      message: "Profile updated successfully!",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Update profile error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
}

// ✅ Add to exports
module.exports = {
  register,
  login,
  forgotPassword,
  changePassword,
  deleteAccount,
  updateProfile,
};