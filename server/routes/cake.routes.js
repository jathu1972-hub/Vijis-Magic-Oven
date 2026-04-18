import express from "express";

import { deleteCloudinaryImage, uploadImageBuffer } from "../config/cloudinary.js";
import { pool } from "../db/pool.js";
import { verifyOwnerRole, verifyToken } from "../middleware/auth.js";
import { uploadCakeImage } from "../middleware/upload.js";
import { asyncHandler } from "../utils/async-handler.js";
import { cleanMultilineText, cleanText } from "../utils/sanitize.js";
import {
  cakeValidation,
  uuidParamValidation,
  validateRequest
} from "../utils/validators.js";

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      `
        SELECT id, name, image_url, image_public_id, price, description, created_at
        FROM cakes
        ORDER BY created_at DESC
      `
    );

    res.json({ cakes: result.rows });
  })
);

router.get(
  "/:id",
  uuidParamValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `
        SELECT id, name, image_url, image_public_id, price, description, created_at
        FROM cakes
        WHERE id = $1
        LIMIT 1
      `,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Cake not found." });
      return;
    }

    res.json({ cake: result.rows[0] });
  })
);

router.post(
  "/upload-image",
  verifyToken,
  verifyOwnerRole,
  uploadCakeImage.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ message: "An image file is required." });
      return;
    }

    const uploadResult = await uploadImageBuffer(req.file.buffer);

    res.status(201).json({
      imageUrl: uploadResult.secure_url,
      imagePublicId: uploadResult.public_id
    });
  })
);

router.post(
  "/",
  verifyToken,
  verifyOwnerRole,
  cakeValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    const name = cleanText(req.body.name, { maxLength: 120 });
    const imageUrl = req.body.imageUrl.trim();
    const imagePublicId = req.body.imagePublicId?.trim() || null;
    const price = Number(req.body.price);
    const description = cleanMultilineText(req.body.description, { maxLength: 600 });

    const result = await pool.query(
      `
        INSERT INTO cakes (name, image_url, image_public_id, price, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, image_url, image_public_id, price, description, created_at
      `,
      [name, imageUrl, imagePublicId, price, description]
    );

    res.status(201).json({
      message: "Cake created successfully.",
      cake: result.rows[0]
    });
  })
);

router.put(
  "/:id",
  verifyToken,
  verifyOwnerRole,
  uuidParamValidation,
  cakeValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    const existingCake = await pool.query(
      "SELECT image_public_id FROM cakes WHERE id = $1 LIMIT 1",
      [req.params.id]
    );

    if (existingCake.rowCount === 0) {
      res.status(404).json({ message: "Cake not found." });
      return;
    }

    const name = cleanText(req.body.name, { maxLength: 120 });
    const imageUrl = req.body.imageUrl.trim();
    const imagePublicId = req.body.imagePublicId?.trim() || null;
    const price = Number(req.body.price);
    const description = cleanMultilineText(req.body.description, { maxLength: 600 });

    const result = await pool.query(
      `
        UPDATE cakes
        SET name = $1,
            image_url = $2,
            image_public_id = $3,
            price = $4,
            description = $5
        WHERE id = $6
        RETURNING id, name, image_url, image_public_id, price, description, created_at
      `,
      [name, imageUrl, imagePublicId, price, description, req.params.id]
    );

    const previousPublicId = existingCake.rows[0].image_public_id;

    if (previousPublicId && previousPublicId !== imagePublicId) {
      await deleteCloudinaryImage(previousPublicId);
    }

    res.json({
      message: "Cake updated successfully.",
      cake: result.rows[0]
    });
  })
);

router.delete(
  "/:id",
  verifyToken,
  verifyOwnerRole,
  uuidParamValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    const existingCake = await pool.query(
      "SELECT image_public_id FROM cakes WHERE id = $1 LIMIT 1",
      [req.params.id]
    );

    if (existingCake.rowCount === 0) {
      res.status(404).json({ message: "Cake not found." });
      return;
    }

    await pool.query("DELETE FROM cakes WHERE id = $1", [req.params.id]);
    await deleteCloudinaryImage(existingCake.rows[0].image_public_id);

    res.json({ message: "Cake deleted successfully." });
  })
);

export default router;
