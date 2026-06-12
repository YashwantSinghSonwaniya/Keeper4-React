const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
require("dotenv").config();

// ✅ Google OAuth2 client — 'postmessage' is the required redirect_uri for popup flows
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "postmessage"
);

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
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    const user = result.rows[0];

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
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "No account found with this email." });
    }

    const user = result.rows[0];

    // ✅ Google-only accounts have no password — give a helpful message
    if (!user.password) {
      return res.status(400).json({
        error:
          "This account was created with Google. Please click 'Continue with Google' to sign in.",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Incorrect password." });
    }

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

// ✅ GOOGLE AUTH — handles both sign-in and sign-up in one endpoint
async function googleAuth(req, res) {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Authorization code is required." });
  }

  try {
    // Step 1: Exchange the one-time authorization code for tokens
    const { tokens } = await googleClient.getToken(code);

    // Step 2: Verify and decode the ID token — confirms the token is genuine
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    let user;

    // Step 3: Check if a user with this Google ID already exists
    const byGoogleId = await pool.query(
      "SELECT * FROM users WHERE google_id = $1",
      [googleId]
    );

    if (byGoogleId.rows.length > 0) {
      // Returning Google user — update avatar if it changed
      user = byGoogleId.rows[0];

      if (picture && user.avatar !== picture) {
        await pool.query(
          "UPDATE users SET avatar = $1 WHERE id = $2",
          [picture, user.id]
        );
        user.avatar = picture;
      }
    } else {
      // Step 4: Check if this email already exists (existing email/password user)
      const byEmail = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );

      if (byEmail.rows.length > 0) {
        // Link the Google account to the existing email/password account
        user = byEmail.rows[0];
        await pool.query(
          "UPDATE users SET google_id = $1, avatar = COALESCE($2, avatar) WHERE id = $3",
          [googleId, picture || null, user.id]
        );
        user.google_id = googleId;
        if (picture) user.avatar = picture;
      } else {
        // Step 5: Brand-new user — create account automatically
        const result = await pool.query(
          "INSERT INTO users (name, email, google_id, avatar) VALUES ($1, $2, $3, $4) RETURNING *",
          [name, email, googleId, picture || null]
        );
        user = result.rows[0];
      }
    }

    // Step 6: Issue our own JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Google login successful!",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || null,
      },
    });
  } catch (err) {
    console.error("Google auth error:", err.message);
    res.status(500).json({ error: "Google authentication failed. Please try again." });
  }
}

// ✅ FORGOT PASSWORD
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
    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [req.user.id]
    );

    const user = result.rows[0];

    // ✅ Google-only users have no password
    if (!user.password) {
      return res.status(400).json({
        error: "Google accounts don't use passwords and cannot be changed here.",
      });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);

    if (!validPassword) {
      return res.status(400).json({
        error: "Current password is incorrect.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

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

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [req.user.id]
    );

    const user = result.rows[0];

    // ✅ Google-only users have no password — JWT authentication is sufficient
    if (!user.password) {
      await pool.query("DELETE FROM users WHERE id = $1", [req.user.id]);
      return res.json({ message: "Account deleted successfully." });
    }

    // Email/password users still require password confirmation
    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ error: "Incorrect password." });
    }

    await pool.query("DELETE FROM users WHERE id = $1", [req.user.id]);

    res.json({ message: "Account deleted successfully." });
  } catch (err) {
    console.error("Delete account error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
}

// ✅ UPDATE PROFILE
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

module.exports = {
  register,
  login,
  googleAuth,
  forgotPassword,
  changePassword,
  deleteAccount,
  updateProfile,
};