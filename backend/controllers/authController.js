const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const {
  sendPasswordResetEmail,
  sendVerificationEmail,
} = require("../utils/email");
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
//  TOKEN HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate a cryptographically secure random token (raw, for the email link)
 * and its SHA-256 hash (for storage in the database). We never store raw tokens.
 */
function generateToken() {
  const rawToken = crypto.randomBytes(32).toString("hex"); // 64 hex chars
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  return { rawToken, hashedToken };
}

/** Hash an incoming raw token the same way it was stored. */
function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** Build a signed JWT for a user row. */
function signJwt(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * Delete expired pending registrations. Called opportunistically during
 * register/verify so the table is self-cleaning without a separate cron.
 */
async function purgeExpiredPendingUsers() {
  try {
    await pool.query("DELETE FROM pending_users WHERE token_expires < NOW()");
  } catch (err) {
    console.error("Pending users purge error:", err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Google OAuth2 client
// ═══════════════════════════════════════════════════════════════════════
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "postmessage"
);

// ────────────────────────────────────────────────────────────────────────
// REGISTER  (Phase 4: NO user row is created here)
//  - Validates input.
//  - Rejects only if a FULLY VERIFIED account already exists (generic message).
//  - bcrypt-hashes the password BEFORE storing it in pending_users.
//  - Generates a verification token, stores ONLY its SHA-256 hash + 24h expiry.
//  - UPSERTs into pending_users (re-registering overwrites the old pending row).
//  - Emails the RAW token link. NO users row is created until verification.
// ────────────────────────────────────────────────────────────────────────
async function register(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const trimmedName = String(name).trim();
  const normalizedEmail = normalizeEmail(email);

  if (!trimmedName) {
    return res.status(400).json({ error: "Name cannot be blank." });
  }
  if (trimmedName.length > 100) {
    return res
      .status(400)
      .json({ error: "Name must be 100 characters or fewer." });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({
      error: "Please enter a valid email address (e.g. user@example.com).",
    });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  // Generic success message — used whether the email is new OR already taken,
  // so we never reveal which emails are registered (enumeration protection).
  const genericMessage =
    "If your email is valid, a verification link has been sent. Please check your inbox.";

  try {
    // Keep the staging table clean.
    await purgeExpiredPendingUsers();

    // If a REAL (verified) account already exists, do not create a pending
    // record and do not send an email. Respond generically.
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );
    if (existingUser.rows.length > 0) {
      return res.json({ message: genericMessage });
    }

    // Hash the password NOW so plaintext never persists, even in staging.
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token (raw for email, hash for DB) + 24h expiry.
    const { rawToken, hashedToken } = generateToken();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24 hours

    // UPSERT: if the user re-registers before verifying, overwrite the row
    // with fresh credentials + a fresh token. The ON CONFLICT targets the
    // UNIQUE email constraint on pending_users.
    await pool.query(
      `INSERT INTO pending_users
         (name, email, password, verification_token, token_expires)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         name               = EXCLUDED.name,
         password           = EXCLUDED.password,
         verification_token = EXCLUDED.verification_token,
         token_expires      = EXCLUDED.token_expires,
         created_at         = NOW()`,
      [trimmedName, normalizedEmail, hashedPassword, hashedToken, expiry]
    );

    // Build the verification link pointing at the frontend page.
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const verifyLink = `${frontendUrl}/verify-email?token=${rawToken}`;

    // Send the email. If sending fails, remove the pending row so no dangling
    // unverifiable record remains.
    try {
      await sendVerificationEmail(normalizedEmail, verifyLink, trimmedName);
    } catch (mailErr) {
      console.error("Verification email send failed:", mailErr.message);
      await pool.query("DELETE FROM pending_users WHERE email = $1", [
        normalizedEmail,
      ]);
      return res.status(500).json({
        error: "Could not send verification email. Please try again later.",
      });
    }

    return res.json({ message: genericMessage });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
}

// ────────────────────────────────────────────────────────────────────────
// VERIFY EMAIL  (Phase 4: this is where the users row is finally created)
//  - Receives the RAW token from the verification link.
//  - Hashes it and looks up a non-expired pending_users row.
//  - Transactionally: creates the verified users row + deletes the pending row.
//  - Returns a JWT so the user is logged in immediately after verifying.
// ────────────────────────────────────────────────────────────────────────
async function verifyEmail(req, res) {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Verification token is required." });
  }

  const client = await pool.connect();

  try {
    await purgeExpiredPendingUsers();

    const hashedToken = hashToken(token);

    // Find the matching, non-expired pending registration.
    const pendingResult = await pool.query(
      `SELECT id, name, email, password
         FROM pending_users
        WHERE verification_token = $1
          AND token_expires > NOW()`,
      [hashedToken]
    );

    if (pendingResult.rows.length === 0) {
      client.release();
      return res.status(400).json({
        error:
          "This verification link is invalid or has expired. Please register again.",
      });
    }

    const pending = pendingResult.rows[0];

    // ── Transaction: create verified user + remove pending row atomically ──
    await client.query("BEGIN");

    // Race safety: ensure no verified account was created in the meantime.
    const existingUser = await client.query(
      "SELECT id, name, email FROM users WHERE email = $1",
      [pending.email]
    );

    let user;

    if (existingUser.rows.length > 0) {
      // Already verified elsewhere — just clean up the pending row.
      user = existingUser.rows[0];
      await client.query("DELETE FROM pending_users WHERE id = $1", [
        pending.id,
      ]);
    } else {
      const inserted = await client.query(
        `INSERT INTO users (name, email, password, is_verified)
         VALUES ($1, $2, $3, true)
         RETURNING id, name, email`,
        [pending.name, pending.email, pending.password] // password is already a bcrypt hash
      );
      user = inserted.rows[0];

      await client.query("DELETE FROM pending_users WHERE id = $1", [
        pending.id,
      ]);
    }

    await client.query("COMMIT");
    client.release();

    const jwtToken = signJwt(user);

    return res.json({
      message: "Email verified! Your account is now active.",
      token: jwtToken,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    client.release();
    console.error("Verify email error:", err.message);
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

  const normalizedEmail = normalizeEmail(email);

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      normalizedEmail,
    ]);

    if (result.rows.length === 0) {
      // Check if there's a PENDING (unverified) registration to give a helpful hint.
      const pending = await pool.query(
        "SELECT id FROM pending_users WHERE email = $1 AND token_expires > NOW()",
        [normalizedEmail]
      );
      if (pending.rows.length > 0) {
        return res.status(400).json({
          error:
            "This email is awaiting verification. Please check your inbox for the verification link.",
        });
      }
      return res
        .status(400)
        .json({ error: "No account found with this email." });
    }

    const user = result.rows[0];

    // Google-only accounts have no password set.
    if (!user.password) {
      return res.status(400).json({
        error:
          "This account was created with Google. Please click 'Continue with Google' to sign in.",
      });
    }

    // Safety net: reject any legacy unverified accounts (should not exist after migration).
    if (user.is_verified === false) {
      return res.status(400).json({
        error:
          "Your account is not verified. Please complete email verification first.",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Incorrect password." });
    }

    const token = signJwt(user);

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
// GOOGLE AUTH  (auto-verified — Google already confirmed the email)
// ────────────────────────────────────────────────────────────────────────
async function googleAuth(req, res) {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Authorization code is required." });
  }

  try {
    const { tokens } = await googleClient.getToken(code);

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, name, picture } = payload;
    const normalizedEmail = normalizeEmail(payload.email);

    let user;

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
        // Link Google to the existing account — and ensure it's verified.
        user = byEmail.rows[0];
        await pool.query(
          "UPDATE users SET google_id = $1, avatar = COALESCE($2, avatar), is_verified = true WHERE id = $3",
          [googleId, picture || null, user.id]
        );
        user.google_id = googleId;
        user.is_verified = true;
        if (picture) user.avatar = picture;
      } else {
        // Brand-new Google user — created immediately and auto-verified.
        // Also clear any stale pending registration for this email.
        await pool.query("DELETE FROM pending_users WHERE email = $1", [
          normalizedEmail,
        ]);
        const result = await pool.query(
          "INSERT INTO users (name, email, google_id, avatar, is_verified) VALUES ($1, $2, $3, $4, true) RETURNING *",
          [String(name).trim(), normalizedEmail, googleId, picture || null]
        );
        user = result.rows[0];
      }
    }

    const token = signJwt(user);

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
    res
      .status(500)
      .json({ error: "Google authentication failed. Please try again." });
  }
}

// ────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD
// ────────────────────────────────────────────────────────────────────────
async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const normalizedEmail = normalizeEmail(email);
  const genericMessage = "If this email exists, a reset link has been sent.";

  try {
    const result = await pool.query(
      "SELECT id, name, email, password FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.json({ message: genericMessage });
    }

    const user = result.rows[0];

    if (!user.password) {
      return res.json({ message: genericMessage });
    }

    const { rawToken, hashedToken } = generateToken();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // +1 hour

    await pool.query(
      "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
      [hashedToken, expiry, user.id]
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

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
// ────────────────────────────────────────────────────────────────────────
async function resetPassword(req, res) {
  const { token, password } = req.body;

  if (!token || !password) {
    return res
      .status(400)
      .json({ error: "Reset token and new password are required." });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const hashedToken = hashToken(token);

    const result = await pool.query(
      "SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
      [hashedToken]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error:
          "This reset link is invalid or has expired. Please request a new one.",
      });
    }

    const user = result.rows[0];
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

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.user.id,
    ]);

    const user = result.rows[0];

    if (!user.password) {
      return res.status(400).json({
        error:
          "Google accounts don't use passwords and cannot be changed here.",
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
  verifyEmail,
  login,
  googleAuth,
  forgotPassword,
  resetPassword,
  changePassword,
  deleteAccount,
  updateProfile,
};