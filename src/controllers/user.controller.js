import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating tokens:", error);
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access tokens"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  console.log("email:", email);

  if ([username, email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const profileImagePath = req.files?.profileImage[0].path;

  if (!profileImagePath) {
    throw new ApiError(400, "Profile Image is required");
  }

  const profileImage = await uploadOnCloudinary(profileImagePath);

  if (!profileImage) {
    throw new ApiError(400, "avatar file is required");
  }

  const user = await User.create({
    username: username,
    profileImage: profileImage.url,
    email,
    password,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering a user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(404, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In successfully"
      )
    );
});

const logOutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    // only modifiable from server
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const periodTracker = asyncHandler(async (req, res) => {
  const { startDate, cycleLength, periodLength } = req.body;
  if (!startDate || !cycleLength || !periodLength) {
    return res.status(400).json({ error: "All fields are required" });
  }
  // Perform calculations
  const startDateObj = new Date(startDate);
  const cycleLengthDays = parseInt(cycleLength);
  const periodLengthDays = parseInt(periodLength);
  const nextPeriodStartDate = new Date(
    startDateObj.getTime() + cycleLengthDays * 24 * 60 * 60 * 1000
  );
  const ovulationDate = new Date(
    nextPeriodStartDate.getTime() - 14 * 24 * 60 * 60 * 1000
  );
  const fertileStartDate = new Date(
    ovulationDate.getTime() - 5 * 24 * 60 * 60 * 1000
  );
  const fertileEndDate = new Date(
    ovulationDate.getTime() + 4 * 24 * 60 * 60 * 1000
  );
  const pregnancyTestDate = new Date(
    nextPeriodStartDate.getTime() + 1 * 24 * 60 * 60 * 1000
  );
  const options = { day: "numeric", month: "long", year: "numeric" };
  const results = {
    nextPeriodStartDate: nextPeriodStartDate.toLocaleDateString(
      undefined,
      options
    ),
    ovulationDate: ovulationDate.toLocaleDateString(undefined, options),
    fertileWindow: `${fertileStartDate.toLocaleDateString(
      undefined,
      options
    )} - ${fertileEndDate.toLocaleDateString(undefined, options)}`,
    pregnancyTestDate: pregnancyTestDate.toLocaleDateString(undefined, options),
  };
  res.status(200).json(results);
});

export { registerUser, loginUser, logOutUser, refreshAccessToken,periodTracker, };
