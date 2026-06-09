const authenticateToken = require("../middleware/auth");

const express = require("express");
const router = express.Router();
const {
  register,
  login,
  forgotPassword,
  changePassword,
  deleteAccount,
  updateProfile,
} = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.put("/change-password", authenticateToken, changePassword);
router.delete("/delete-account", authenticateToken, deleteAccount);
router.put("/update-profile", authenticateToken, updateProfile);

module.exports = router;