const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const { sendPasswordResetEmail } = require("../utils/email");
require("dotenv").config();

// ═══════════════════════════════════════════════════════════════════════
//  VALIDATION & NORMALIZATION HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Normalize an email address.
 * Must be called before every INSERT and every lookup.
 */
function normalizeEmail(raw) {
  return String(raw).trim().toLowerCase();
}

/**
 * Validate email format.
 * Rejects: "abc"  "1@g"  "test@"  "@gmail"  "a b@c.com"
 * Accepts: "user@example.com"  "first.last+tag@sub.domain.co.uk"
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  if (/\s/.test(email)) return false;

  const segments = email.split("@");
  if (segments.length !== 2) return false;

  const [local, domain] = segments;
  if (!local.length || !domain.length) return false;

  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (local.includes("..")) return false;
  if (local.length > 64) return false;
  if (!/^[a-zA-Z0-9._%+\-!#$&'*/=?^`{|}~]+$/.test(local)) return false;

  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (labels.some((l) => l.length === 0)) return false;
  const tld = labels[labels.length - 1];
  if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;
  if (domain.length > 255) return false;
  if (!/^[a-zA-Z0-9.\-]+$/.test(domain)) return false;

  return true;
}

/**
 * Validate password — NIST 800-63B aligned.
 * Returns an error string if invalid, or null if valid.
 *
 * ✅ Minimum 8 characters  (NIST 800-63B minimum)
 * ✅ Maximum 128 characters (prevents bcrypt silent truncation abuse at 72 bytes)
 * ✅ Whitespace-only rejected (accidental input protection)
 *
 * ❌ NO complexity rules enforced — NIST 800-63B explicitly recommends against
 *    mandatory uppercase / lowercase / digit / symbol requirements.
 *    Mandatory complexity produces predictable patterns like "Password1!" which
 *    are weaker than simple long passphrases. Length drives entropy, not variety.
 */
function validatePassword(password) {
  if (!password || typeof password !== "string") {
    return "Password is required.";
  }
  if (password.trim().length === 0) {
    return "Password cannot be blank or contain only spaces.";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 128) {
    return "Password must be 128 characters or fewer.";
  }
  return null; // valid
}

// ═══════════════════════════════════════════════════════════════════════
//  PASSWORD RESET TOKEN HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate a cryptographically secure random reset token (raw, for the email)
 * and its SHA-256 hash (for storage in the database).
 *
 * We never store the raw token. If the DB leaks, stored hashes are useless
 * because an attacker cannot reverse SHA-256 to the original token.
 */
function generateResetToken() {
  const rawToken = crypto.randomBytes(32).toString("hex"); // 64 hex chars
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  return { rawToken, hashedToken };
}

// ═══════════════════════════════════════════════════════════════════════
//  Google OAuth2 client
//  'postmessage' = required redirect_uri for popup auth-code flows
// ═══════════════════════════════════════════════════════════════════════
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "postmessage"
);

// ────────────────────────────────────────────────────────────────────────
// REGISTER
// ────────────────────────────────────────────────────────────────────────
async function register(req, res) {
  const { name, email, password } = req.body;

  // ── Presence check ───────────────────────────────────────────────────
  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  // ── Normalize ────────────────────────────────────────────────────────
  const trimmedName     = String(name).trim();
  const normalizedEmail = normalizeEmail(email);

  // ── Name validation ──────────────────────────────────────────────────
  if (!trimmedName) {
    return res.status(400).json({ error: "Name cannot be blank." });
  }
  if (trimmedName.length > 100) {
    return res.status(400).json({ error: "Name must be 100 characters or fewer." });
  }

  // ── Email format validation ──────────────────────────────────────────
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({
      error: "Please enter a valid email address (e.g. user@example.com).",
    });
  }

  // ── Password validation (Phase 2) ────────────────────────────────────
  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    // ── Duplicate check against normalized email ──────────────────────
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [trimmedName, normalizedEmail, hashedPassword]
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

// ────────────────────────────────────────────────────────────────────────
// LOGIN
// ────────────────────────────────────────────────────────────────────────
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  // Normalize before lookup so "User@Gmail.COM" finds "user@gmail.com"
  const normalizedEmail = normalizeEmail(email);

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "No account found with this email." });
    }

    const user = result.rows[0];

    // Google-only accounts have no password set
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

// ────────────────────────────────────────────────────────────────────────
// GOOGLE AUTH  (sign-in and sign-up in one endpoint)
// ────────────────────────────────────────────────────────────────────────
async function googleAuth(req, res) {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Authorization code is required." });
  }

  try {
    // Exchange the one-time authorization code for tokens
    const { tokens } = await googleClient.getToken(code);

    // Verify and decode the ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, name, picture } = payload;
    const normalizedEmail = normalizeEmail(payload.email);

    let user;

    // Check if a user with this Google ID already exists
    const byGoogleId = await pool.query(
      "SELECT * FROM users WHERE google_id = $1",
      [googleId]
    );

    if (byGoogleId.rows.length > 0) {
      user = byGoogleId.rows[0];
      if (picture && user.avatar !== picture) {
        await pool.query("UPDATE users SET avatar = $1 WHERE id = $2", [
          picture,
          user.id,
        ]);
        user.avatar = picture;
      }
    } else {
      const byEmail = await pool.query(
        "SELECT * FROM users WHERE email = $1",
        [normalizedEmail]
      );

      if (byEmail.rows.length > 0) {
        // Link Google to the existing email/password account
        user = byEmail.rows[0];
        await pool.query(
          "UPDATE users SET google_id = $1, avatar = COALESCE($2, avatar) WHERE id = $3",
          [googleId, picture || null, user.id]
        );
        user.google_id = googleId;
        if (picture) user.avatar = picture;
      } else {
        // Brand-new user — create account automatically
        const result = await pool.query(
          "INSERT INTO users (name, email, google_id, avatar) VALUES ($1, $2, $3, $4) RETURNING *",
          [String(name).trim(), normalizedEmail, googleId, picture || null]
        );
        user = result.rows[0];
      }
    }

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

// ────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD
//  - Always returns the same generic success message (prevents email
//    enumeration: attackers cannot tell which emails are registered).
//  - Generates a secure token, stores ONLY its SHA-256 hash + 1-hour expiry.
//  - Emails the RAW token inside the reset link via Nodemailer.
//  - Google-only accounts (no password) are silently skipped — we still
//    return the generic message so existence is not revealed.
// ────────────────────────────────────────────────────────────────────────
async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const normalizedEmail = normalizeEmail(email);
  const genericMessage =
    "If this email exists, a reset link has been sent.";

  try {
    const result = await pool.query(
      "SELECT id, name, email, password FROM users WHERE email = $1",
      [normalizedEmail]
    );

    // Email not found → respond generically (no enumeration)
    if (result.rows.length === 0) {
      return res.json({ message: genericMessage });
    }

    const user = result.rows[0];

    // Google-only account (no password) → cannot reset a password that
    // doesn't exist. Respond generically without sending an email.
    if (!user.password) {
      return res.json({ message: genericMessage });
    }

    // Generate secure token + store hash and expiry (1 hour from now)
    const { rawToken, hashedToken } = generateResetToken();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // +1 hour

    await pool.query(
      "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
      [hashedToken, expiry, user.id]
    );

    // Build the reset link pointing at the frontend Reset Password page
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    // Send the email. If sending fails, roll back the stored token so the
    // user isn't left with a dangling, unusable reset token.
    try {
      await sendPasswordResetEmail(user.email, resetLink, user.name);
    } catch (mailErr) {
      console.error("Reset email send failed:", mailErr.message);
      await pool.query(
        "UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1",
        [user.id]
      );
      return res.status(500).json({
        error: "Could not send reset email. Please try again later.",
      });
    }

    return res.json({ message: genericMessage });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
}

// ────────────────────────────────────────────────────────────────────────
// RESET PASSWORD
//  - Receives the RAW token + new password from the Reset Password page.
//  - Hashes the raw token and looks up a user whose stored hash matches AND
//    whose expiry is still in the future.
//  - On success: bcrypt-hashes the new password, clears the reset token
//    columns (single-use), and returns success.
//  - Expired or invalid tokens are rejected with a clear message.
// ────────────────────────────────────────────────────────────────────────
async function resetPassword(req, res) {
  const { token, password } = req.body;

  if (!token || !password) {
    return res
      .status(400)
      .json({ error: "Reset token and new password are required." });
  }

  // Validate the new password against the same rules as everywhere else
  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    // Hash the incoming raw token the same way it was stored, then look up
    // a matching, non-expired record.
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const result = await pool.query(
      "SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
      [hashedToken]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: "This reset link is invalid or has expired. Please request a new one.",
      });
    }

    const user = result.rows[0];

    // Hash the new password and clear the reset token (single-use)
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [hashedPassword, user.id]
    );

    res.json({
      message: "Password has been reset successfully! You can now log in.",
    });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
}

// ────────────────────────────────────────────────────────────────────────
// CHANGE PASSWORD
// ────────────────────────────────────────────────────────────────────────
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "All fields are required." });
  }

  // ── Phase 2: Validate the new password against current rules ─────────
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.user.id,
    ]);

    const user = result.rows[0];

    // Google-only accounts have no password
    if (!user.password) {
      return res.status(400).json({
        error: "Google accounts don't use passwords and cannot be changed here.",
      });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashedPassword,
      req.user.id,
    ]);

    res.json({ message: "Password changed successfully!" });
  } catch (err) {
    console.error("Change password error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
}

// ────────────────────────────────────────────────────────────────────────
// DELETE ACCOUNT
// ────────────────────────────────────────────────────────────────────────
async function deleteAccount(req, res) {
  const { password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.user.id,
    ]);

    const user = result.rows[0];

    // Google-only accounts: JWT authentication is sufficient proof of identity
    if (!user.password) {
      await pool.query("DELETE FROM users WHERE id = $1", [req.user.id]);
      return res.json({ message: "Account deleted successfully." });
    }

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

// ────────────────────────────────────────────────────────────────────────
// UPDATE PROFILE
// ────────────────────────────────────────────────────────────────────────
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
  resetPassword,
  changePassword,
  deleteAccount,
  updateProfile,
};