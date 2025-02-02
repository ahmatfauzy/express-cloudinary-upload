import express, { Request, Response } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import path from "path";
import streamifier from "streamifier";

dotenv.config({ path: path.join(process.cwd(), ".env") });

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const app = express();
app.use(express.json()); 

const imgUpload = multer({ storage: multer.memoryStorage() });

const uploadToCloudinary = (buffer: Buffer, folder: string) => {
  return new Promise<{ url: string; public_id: string }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result?.secure_url || "", public_id: result?.public_id || "" });
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

let uploadedImages: { id: string; url: string }[] = [];

// post
app.post("/api/v1/upload", imgUpload.array("files", 20), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const uploadPromises = files.map(async (file) => {
      const { url, public_id } = await uploadToCloudinary(file.buffer, "uploads");
      uploadedImages.push({ id: public_id, url });
      return { id: public_id, url };
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    res.status(200).json({ success: true, message: "Images uploaded successfully", files: uploadedFiles });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error: (error as Error).message });
  }
});

// get all
app.get("/api/v1/images", (req: Request, res: Response) => {
  res.status(200).json({ success: true, images: uploadedImages });
});

// get by id
app.get("/api/v1/images/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const image = uploadedImages.find((img) => img.id === id);

    if (!image) {
      return res.status(404).json({ success: false, message: "Image not found" });
    }

    res.status(200).json({ success: true, image });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error: (error as Error).message });
  }
});

// server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
