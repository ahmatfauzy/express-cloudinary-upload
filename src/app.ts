import express, { Request, Response } from "express";
import multer, { Multer } from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import path from "path";
import streamifier from "streamifier";

// memanggil file .env
dotenv.config({ path: path.join(process.cwd(), ".env") });

// config key api cloud
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const app = express();

// multer
const imgUpload: Multer = multer({ storage: multer.memoryStorage() });

// get
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    systemHealth: "success",
    base: "/api/v1/upload/",
  });
});

const uploadToCloudinary = (
  buffer: Buffer,
  folder: string,
  resourceType: "image"
) => {
  return new Promise<string>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result?.secure_url || "");
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// post
app.post(
  "/api/v1/upload",
  imgUpload.array("files", 20),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files uploade",
        });
      }

      const uploadPromises = files.map((file) => {
        return uploadToCloudinary(file.buffer, "uploads", "image");
      });

      const urls: string[] = await Promise.all(uploadPromises);

      res.status(200).json({
        success: true,
        message: "Images uploade successfully",
        urls,
      });
    } catch (error) {
      // error handling
      const err = error as Error;
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
      res.status(500).json({
        success: false,
        message: "Server Error",
        error: err.message,
      });
    }
  }
);

// server / port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Running di PORT ${PORT}`);
});
