// const joblib = require("joblib");
// import joblib from "joblib";
import express, { urlencoded } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "16kb",
  })
);
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

import userRouter from "./routes/user.routes.js";
app.use("/api/v1/users", userRouter);

export { app };

// Load the PCOS detection model
// const model = joblib.load("pcos_model.joblib");

// // Define your API endpoints using Express.js
// // For example:
// app.post("/predict", (req, res) => {
//   // Extract data from the request body
//   const inputData = req.body;

//   // Use the loaded model to make predictions
//   const prediction = model.predict(inputData);

//   // Return the prediction as the response
//   res.json({ prediction });
// });
