require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Serve HTML files from "public/" folder
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api/auth", require("./src/routes/auth"));
app.use("/api", require("./src/routes/dashboard"));

app.listen(process.env.PORT || 4000, () =>
  console.log("Server running on port " + process.env.PORT)
);
