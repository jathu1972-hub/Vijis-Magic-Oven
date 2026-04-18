import { v2 as cloudinary } from "cloudinary";

import { env } from "./env.js";

export const cloudinaryReady = Boolean(
  env.cloudinaryCloudName &&
    env.cloudinaryApiKey &&
    env.cloudinaryApiSecret
);

if (cloudinaryReady) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true
  });
}

export function uploadImageBuffer(buffer, folder = "vijis-magic-oven/cakes") {
  if (!cloudinaryReady) {
    throw new Error("Cloudinary is not configured. Add the Cloudinary environment variables first.");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image"
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

export async function deleteCloudinaryImage(publicId) {
  if (!cloudinaryReady || !publicId) {
    return;
  }

  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
