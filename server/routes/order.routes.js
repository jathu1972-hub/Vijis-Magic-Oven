import express from "express";

import { pool } from "../db/pool.js";
import {
  verifyCustomerRole,
  verifyOwnerRole,
  verifyToken,
} from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { cleanMultilineText } from "../utils/sanitize.js";
import { orderValidation, validateRequest } from "../utils/validators.js";
import { body, param } from "express-validator";

const router = express.Router();

const MIN_ORDER_VALUE = 100; // ₹100 minimum

/* ── Place order (CUSTOMER) ─────────────────────────── */
router.post(
  "/",
  verifyToken,
  verifyCustomerRole,
  orderValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    // Duplicate order spam guard — one order per 60 seconds per customer
    const recentOrder = await pool.query(
      `SELECT id FROM orders
       WHERE customer_id = $1 AND created_at > NOW() - INTERVAL '60 seconds'
       LIMIT 1`,
      [req.user.id]
    );
    if (recentOrder.rowCount > 0) {
      res.status(429).json({
        message: "Please wait a moment before placing another order.",
      });
      return;
    }

    const items = req.body.items.map((item) => ({
      cakeId: item.cakeId,
      quantity: Number(item.quantity),
    }));
    const deliveryAddress = cleanMultilineText(req.body.deliveryAddress, { maxLength: 250 });
    const notes = cleanMultilineText(req.body.notes || "", { maxLength: 500 }) || null;

    // Verify all cake IDs exist and fetch current server-side prices
    const cakeIds = items.map((item) => item.cakeId);
    const cakesResult = await pool.query(
      "SELECT id, name, price FROM cakes WHERE id = ANY($1::uuid[])",
      [cakeIds]
    );
    if (cakesResult.rowCount !== cakeIds.length) {
      res.status(400).json({ message: "One or more selected cakes no longer exist." });
      return;
    }

    const cakesById = new Map(cakesResult.rows.map((c) => [c.id, c]));
    const normalizedItems = items.map((item) => {
      const cake = cakesById.get(item.cakeId);
      return {
        cakeId: cake.id,
        cakeName: cake.name,
        quantity: item.quantity,
        unitPrice: Number(cake.price),
      };
    });

    const total = normalizedItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );

    if (total < MIN_ORDER_VALUE) {
      res.status(400).json({
        message: `Minimum order value is ₹${MIN_ORDER_VALUE}. Your cart total is ₹${total.toFixed(2)}.`,
      });
      return;
    }

    // Transactional insert
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const orderResult = await client.query(
        `
          INSERT INTO orders (customer_id, delivery_address, notes, total)
          VALUES ($1, $2, $3, $4)
          RETURNING id, customer_id, status, delivery_address, notes, total, created_at
        `,
        [req.user.id, deliveryAddress, notes, total]
      );
      const order = orderResult.rows[0];

      for (const item of normalizedItems) {
        await client.query(
          `
            INSERT INTO order_items (order_id, cake_id, cake_name, unit_price, quantity)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [order.id, item.cakeId, item.cakeName, item.unitPrice, item.quantity]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({
        message: "Order placed successfully.",
        order: { ...order, items: normalizedItems },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

/* ── My orders (CUSTOMER) ───────────────────────────── */
router.get(
  "/me",
  verifyToken,
  verifyCustomerRole,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `
        SELECT
          o.id, o.status, o.delivery_address, o.notes, o.total, o.created_at,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'cakeName', oi.cake_name,
                'unitPrice', oi.unit_price,
                'quantity', oi.quantity
              ) ORDER BY oi.cake_name
            ) FILTER (WHERE oi.id IS NOT NULL),
            '[]'::json
          ) AS items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.customer_id = $1
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `,
      [req.user.id]
    );
    res.json({ orders: result.rows });
  })
);

/* ── All orders (OWNER) ─────────────────────────────── */
router.get(
  "/",
  verifyToken,
  verifyOwnerRole,
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      `
        SELECT
          o.id, o.status, o.delivery_address, o.notes, o.total, o.created_at,
          u.name AS customer_name, u.email AS customer_email,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'cakeName', oi.cake_name,
                'unitPrice', oi.unit_price,
                'quantity', oi.quantity
              ) ORDER BY oi.cake_name
            ) FILTER (WHERE oi.id IS NOT NULL),
            '[]'::json
          ) AS items
        FROM orders o
        INNER JOIN users u ON u.id = o.customer_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        GROUP BY o.id, u.name, u.email
        ORDER BY o.created_at DESC
      `
    );
    res.json({ orders: result.rows });
  })
);

/* ── Update order status (OWNER) ────────────────────── */
router.patch(
  "/:id/status",
  verifyToken,
  verifyOwnerRole,
  [
    param("id").isUUID().withMessage("Invalid order ID."),
    body("status")
      .isIn(["PLACED", "PREPARING", "READY", "COMPLETED"])
      .withMessage("Status must be one of: PLACED, PREPARING, READY, COMPLETED."),
  ],
  validateRequest,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `
        UPDATE orders
        SET status = $1
        WHERE id = $2
        RETURNING id, status, customer_id, delivery_address, notes, total, created_at
      `,
      [req.body.status, req.params.id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: "Order not found." });
      return;
    }

    res.json({ message: `Order status updated to ${req.body.status}.`, order: result.rows[0] });
  })
);

export default router;
