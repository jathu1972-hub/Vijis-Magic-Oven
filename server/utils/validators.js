import { body, param, validationResult } from "express-validator";

export const registerValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("Name must be between 2 and 80 characters."),
  body("email")
    .trim()
    .isEmail()
    .withMessage("A valid email address is required.")
    ,
  body("password")
    .isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1
    })
    .withMessage(
      "Password must be at least 8 characters and include upper, lower, number, and symbol."
    )
];

export const loginValidation = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("A valid email address is required.")
    .normalizeEmail(),
  body("password")
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage("Password is required.")
];

export const cakeValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("Cake name must be between 2 and 120 characters."),
  body("imageUrl")
    .trim()
    .isURL({ protocols: ["https"], require_protocol: true })
    .withMessage("A valid HTTPS image URL is required."),
  body("imagePublicId")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 255 })
    .withMessage("Image public ID is too long."),
  body("price")
    .isFloat({ gt: 0, max: 100000 })
    .withMessage("Price must be greater than 0."),
  body("description")
    .trim()
    .isLength({ min: 10, max: 600 })
    .withMessage("Description must be between 10 and 600 characters.")
];

export const orderValidation = [
  body("items")
    .isArray({ min: 1, max: 20 })
    .withMessage("At least one cake item is required."),
  body("items.*.cakeId")
    .isUUID()
    .withMessage("Each cake ID must be a valid UUID."),
  body("items.*.quantity")
    .isInt({ min: 1, max: 20 })
    .withMessage("Each quantity must be between 1 and 20.")
    .toInt(),
  body("deliveryAddress")
    .trim()
    .isLength({ min: 10, max: 250 })
    .withMessage("Delivery address must be between 10 and 250 characters."),
  body("notes")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must be 500 characters or fewer.")
];

export const uuidParamValidation = [
  param("id").isUUID().withMessage("A valid resource ID is required.")
];

export function validateRequest(req, res, next) {
  const result = validationResult(req);

  if (result.isEmpty()) {
    next();
    return;
  }

  res.status(422).json({
    message: "Validation failed.",
    errors: result.array().map((error) => ({
      field: error.path,
      message: error.msg
    }))
  });
}
