const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");

router.get("/dashboard", auth, async (req, res) => {
  console.log('Headers received:', req.headers);
  const user = await User.findByPk(req.userId);

  res.json({
    message: "Dashboard loaded",
    user,
  });
});

module.exports = router;
