import { body, param, query, validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';
import { UserRole, CustomerType, PaymentMethod, PaymentStatus, MovementType, AdjustmentReason } from '../types/model.types.js';

// Validation result handler middleware
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'error',
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

// UUID validation helper
const uuidValidation = (field: string) => 
    param(field)
        .isUUID()
        .withMessage(`${field} must be a valid UUID`);

// Email validation helper
const emailValidation = (field: string, optional = false) => {
    const chain = body(field)
        .optional({ checkFalsy: optional })
        .isEmail()
        .withMessage(`${field} must be a valid email address`)
        .normalizeEmail();
    return optional ? chain : chain.notEmpty().withMessage(`${field} is required`);
};

// Phone validation helper
const phoneValidation = (field: string, optional = false) => {
    const chain = body(field)
        .optional({ checkFalsy: optional })
        .matches(/^\+?[1-9]\d{1,14}$/)
        .withMessage(`${field} must be a valid phone number`);
    return optional ? chain : chain.notEmpty().withMessage(`${field} is required`);
};

// Auth Validations
// Admin creates user - user doesn't sign up themselves
export const validateAdminCreateUser = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('email is required')
        .isEmail()
        .withMessage('email must be a valid email address')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 })
        .withMessage('password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('username')
        .trim()
        .notEmpty()
        .withMessage('username is required')
        .isLength({ min: 3, max: 50 })
        .withMessage('username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('username can only contain letters, numbers, and underscores'),
    body('full_name')
        .trim()
        .notEmpty()
        .withMessage('full_name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('full_name must be between 2 and 100 characters'),
    body('role')
        .isIn(Object.values(UserRole))
        .withMessage(`role must be one of: ${Object.values(UserRole).join(', ')}`),
    phoneValidation('phone', true),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean'),
    handleValidationErrors
];

export const validateLogin = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('email is required')
        .isEmail()
        .withMessage('email must be a valid email address')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('password is required')
        .isLength({ min: 1 })
        .withMessage('password is required'),
    handleValidationErrors
];

// Password change validation - requires current password and new password
export const validateChangePassword = [
    body('current_password')
        .notEmpty()
        .withMessage('current_password is required')
        .isLength({ min: 1 })
        .withMessage('current_password is required'),
    body('new_password')
        .isLength({ min: 8 })
        .withMessage('new_password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('new_password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('confirm_password')
        .custom((value, { req }) => {
            if (value !== req.body.new_password) {
                throw new Error('confirm_password must match new_password');
            }
            return true;
        }),
    handleValidationErrors
];

// Refresh token validation - token comes from cookie, no body validation needed
export const validateRefreshToken = [
    // Refresh token is read from cookies, no body validation required
    handleValidationErrors
];

// Request password reset validation
export const validateRequestPasswordReset = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('email is required')
        .isEmail()
        .withMessage('email must be a valid email address')
        .normalizeEmail(),
    handleValidationErrors
];

// Reset password validation - user resets password with email and new password
export const validateResetPassword = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('email is required')
        .isEmail()
        .withMessage('email must be a valid email address')
        .normalizeEmail(),
    body('new_password')
        .isLength({ min: 8 })
        .withMessage('new_password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('new_password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('confirm_password')
        .custom((value, { req }) => {
            if (value !== req.body.new_password) {
                throw new Error('confirm_password must match new_password');
            }
            return true;
        }),
    handleValidationErrors
];

// Admin reset password validation - admin can reset user password without current password
export const validateAdminResetPassword = [
    body('new_password')
        .isLength({ min: 8 })
        .withMessage('new_password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('new_password must contain at least one uppercase letter, one lowercase letter, and one number'),
    handleValidationErrors
];

// Update email validation
export const validateUpdateEmail = [
    body('new_email')
        .trim()
        .notEmpty()
        .withMessage('new_email is required')
        .isEmail()
        .withMessage('new_email must be a valid email address')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('password is required to change email')
        .isLength({ min: 1 })
        .withMessage('password is required'),
    handleValidationErrors
];

// User Profile Validations
export const validateCreateUserProfile = [
    body('id')
        .isUUID()
        .withMessage('id must be a valid UUID'),
    body('username')
        .trim()
        .notEmpty()
        .withMessage('username is required')
        .isLength({ min: 3, max: 50 })
        .withMessage('username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('username can only contain letters, numbers, and underscores'),
    body('full_name')
        .trim()
        .notEmpty()
        .withMessage('full_name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('full_name must be between 2 and 100 characters'),
    body('role')
        .isIn(Object.values(UserRole))
        .withMessage(`role must be one of: ${Object.values(UserRole).join(', ')}`),
    phoneValidation('phone', true),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean'),
    handleValidationErrors
];

// User updating their own profile - cannot change role or is_active
export const validateUpdateOwnProfile = [
    body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('username can only contain letters, numbers, and underscores'),
    body('full_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('full_name must be between 2 and 100 characters'),
    phoneValidation('phone', true),
    // Prevent role and is_active from being updated by user themselves
    body('role')
        .optional()
        .custom((value) => {
            throw new Error('You cannot change your own role');
        }),
    body('is_active')
        .optional()
        .custom((value) => {
            throw new Error('You cannot change your own active status');
        }),
    handleValidationErrors
];

// Admin updating user profile - can change all fields including role and is_active
export const validateUpdateUserProfile = [
    body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('username can only contain letters, numbers, and underscores'),
    body('full_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('full_name must be between 2 and 100 characters'),
    body('role')
        .optional()
        .isIn(Object.values(UserRole))
        .withMessage(`role must be one of: ${Object.values(UserRole).join(', ')}`),
    phoneValidation('phone', true),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean'),
    handleValidationErrors
];

// Supplier Validations
export const validateCreateSupplier = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('name is required')
        .isLength({ min: 2, max: 200 })
        .withMessage('name must be between 2 and 200 characters'),
    body('contact_person')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('contact_person must not exceed 100 characters'),
    phoneValidation('phone', true),
    emailValidation('email', true),
    body('address')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('address must not exceed 500 characters'),
    body('payment_terms')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('payment_terms must not exceed 200 characters'),
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('notes must not exceed 1000 characters'),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean'),
    handleValidationErrors
];

export const validateUpdateSupplier = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage('name must be between 2 and 200 characters'),
    body('contact_person')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('contact_person must not exceed 100 characters'),
    phoneValidation('phone', true),
    emailValidation('email', true),
    body('address')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('address must not exceed 500 characters'),
    body('payment_terms')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('payment_terms must not exceed 200 characters'),
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('notes must not exceed 1000 characters'),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean'),
    handleValidationErrors
];

// Product Validations
export const validateCreateProduct = [
    body('sku')
        .trim()
        .notEmpty()
        .withMessage('sku is required')
        .isLength({ min: 1, max: 50 })
        .withMessage('sku must be between 1 and 50 characters'),
    body('barcode')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('barcode must not exceed 100 characters'),
    body('name')
        .trim()
        .notEmpty()
        .withMessage('name is required')
        .isLength({ min: 2, max: 200 })
        .withMessage('name must be between 2 and 200 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('description must not exceed 1000 characters'),
    body('category')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('category must not exceed 100 characters'),
    body('unit')
        .trim()
        .notEmpty()
        .withMessage('unit is required')
        .isLength({ max: 20 })
        .withMessage('unit must not exceed 20 characters'),
    body('purchase_price')
        .isFloat({ min: 0 })
        .withMessage('purchase_price must be a positive number'),
    body('retail_price')
        .isFloat({ min: 0 })
        .withMessage('retail_price must be a positive number'),
    body('wholesale_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('wholesale_price must be a positive number'),
    body('min_stock_level')
        .optional()
        .isInt({ min: 0 })
        .withMessage('min_stock_level must be a non-negative integer'),
    body('reorder_quantity')
        .optional()
        .isInt({ min: 0 })
        .withMessage('reorder_quantity must be a non-negative integer'),
    body('shelf_location')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('shelf_location must not exceed 50 characters'),
    body('supplier_id')
        .optional()
        .isUUID()
        .withMessage('supplier_id must be a valid UUID'),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean'),
    handleValidationErrors
];

export const validateUpdateProduct = [
    body('sku')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('sku must be between 1 and 50 characters'),
    body('barcode')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('barcode must not exceed 100 characters'),
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage('name must be between 2 and 200 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('description must not exceed 1000 characters'),
    body('category')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('category must not exceed 100 characters'),
    body('unit')
        .optional()
        .trim()
        .isLength({ max: 20 })
        .withMessage('unit must not exceed 20 characters'),
    body('purchase_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('purchase_price must be a positive number'),
    body('retail_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('retail_price must be a positive number'),
    body('wholesale_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('wholesale_price must be a positive number'),
    body('min_stock_level')
        .optional()
        .isInt({ min: 0 })
        .withMessage('min_stock_level must be a non-negative integer'),
    body('reorder_quantity')
        .optional()
        .isInt({ min: 0 })
        .withMessage('reorder_quantity must be a non-negative integer'),
    body('shelf_location')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('shelf_location must not exceed 50 characters'),
    body('supplier_id')
        .optional()
        .isUUID()
        .withMessage('supplier_id must be a valid UUID'),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean'),
    handleValidationErrors
];

// Inventory Validations
export const validateCreateInventory = [
    body('product_id')
        .isUUID()
        .withMessage('product_id must be a valid UUID'),
    body('quantity')
        .isInt({ min: 0 })
        .withMessage('quantity must be a non-negative integer'),
    body('updated_by')
        .optional()
        .isUUID()
        .withMessage('updated_by must be a valid UUID'),
    handleValidationErrors
];

export const validateUpdateInventory = [
    body('quantity')
        .optional()
        .isInt({ min: 0 })
        .withMessage('quantity must be a non-negative integer'),
    body('updated_by')
        .optional()
        .isUUID()
        .withMessage('updated_by must be a valid UUID'),
    handleValidationErrors
];

// Customer Validations
export const validateCreateCustomer = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('name is required')
        .isLength({ min: 2, max: 200 })
        .withMessage('name must be between 2 and 200 characters'),
    body('customer_type')
        .optional()
        .isIn(Object.values(CustomerType))
        .withMessage(`customer_type must be one of: ${Object.values(CustomerType).join(', ')}`),
    phoneValidation('phone', true),
    emailValidation('email', true),
    body('address')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('address must not exceed 500 characters'),
    body('credit_limit')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('credit_limit must be a non-negative number'),
    body('current_balance')
        .optional()
        .isFloat()
        .withMessage('current_balance must be a valid number'),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean'),
    handleValidationErrors
];

export const validateUpdateCustomer = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage('name must be between 2 and 200 characters'),
    body('customer_type')
        .optional()
        .isIn(Object.values(CustomerType))
        .withMessage(`customer_type must be one of: ${Object.values(CustomerType).join(', ')}`),
    phoneValidation('phone', true),
    emailValidation('email', true),
    body('address')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('address must not exceed 500 characters'),
    body('credit_limit')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('credit_limit must be a non-negative number'),
    body('current_balance')
        .optional()
        .isFloat()
        .withMessage('current_balance must be a valid number'),
    body('is_active')
        .optional()
        .isBoolean()
        .withMessage('is_active must be a boolean'),
    handleValidationErrors
];

// Sale Validations
export const validateCreateSale = [
    body('customer_id')
        .optional()
        .isUUID()
        .withMessage('customer_id must be a valid UUID'),
    body('subtotal')
        .isFloat({ min: 0 })
        .withMessage('subtotal must be a non-negative number'),
    body('discount_amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('discount_amount must be a non-negative number'),
    body('total_amount')
        .isFloat({ min: 0 })
        .withMessage('total_amount must be a non-negative number'),
    body('payment_method')
        .optional()
        .isIn(Object.values(PaymentMethod))
        .withMessage(`payment_method must be one of: ${Object.values(PaymentMethod).join(', ')}`),
    body('cashier_id')
        .optional()
        .isUUID()
        .withMessage('cashier_id must be a valid UUID'),
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('notes must not exceed 1000 characters'),
    body('sale_date')
        .optional()
        .isISO8601()
        .withMessage('sale_date must be a valid ISO 8601 date'),
    handleValidationErrors
];

export const validateUpdateSale = [
    body('customer_id')
        .optional()
        .isUUID()
        .withMessage('customer_id must be a valid UUID'),
    body('subtotal')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('subtotal must be a non-negative number'),
    body('discount_amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('discount_amount must be a non-negative number'),
    body('total_amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('total_amount must be a non-negative number'),
    body('payment_method')
        .optional()
        .isIn(Object.values(PaymentMethod))
        .withMessage(`payment_method must be one of: ${Object.values(PaymentMethod).join(', ')}`),
    body('cashier_id')
        .optional()
        .isUUID()
        .withMessage('cashier_id must be a valid UUID'),
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('notes must not exceed 1000 characters'),
    body('sale_date')
        .optional()
        .isISO8601()
        .withMessage('sale_date must be a valid ISO 8601 date'),
    handleValidationErrors
];

// Sale Item Validations
export const validateCreateSaleItem = [
    body('sale_id')
        .isUUID()
        .withMessage('sale_id must be a valid UUID'),
    body('product_id')
        .isUUID()
        .withMessage('product_id must be a valid UUID'),
    body('quantity')
        .isInt({ min: 1 })
        .withMessage('quantity must be a positive integer'),
    body('unit_price')
        .isFloat({ min: 0 })
        .withMessage('unit_price must be a non-negative number'),
    body('discount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('discount must be a non-negative number'),
    body('line_total')
        .isFloat({ min: 0 })
        .withMessage('line_total must be a non-negative number'),
    handleValidationErrors
];

export const validateUpdateSaleItem = [
    body('product_id')
        .optional()
        .isUUID()
        .withMessage('product_id must be a valid UUID'),
    body('quantity')
        .optional()
        .isInt({ min: 1 })
        .withMessage('quantity must be a positive integer'),
    body('unit_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('unit_price must be a non-negative number'),
    body('discount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('discount must be a non-negative number'),
    body('line_total')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('line_total must be a non-negative number'),
    handleValidationErrors
];

// Purchase Validations
export const validateCreatePurchase = [
    body('supplier_id')
        .isUUID()
        .withMessage('supplier_id must be a valid UUID'),
    body('subtotal')
        .isFloat({ min: 0 })
        .withMessage('subtotal must be a non-negative number'),
    body('tax_amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('tax_amount must be a non-negative number'),
    body('discount_amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('discount_amount must be a non-negative number'),
    body('total_amount')
        .isFloat({ min: 0 })
        .withMessage('total_amount must be a non-negative number'),
    body('payment_method')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('payment_method must not exceed 50 characters'),
    body('payment_status')
        .optional()
        .isIn(Object.values(PaymentStatus))
        .withMessage(`payment_status must be one of: ${Object.values(PaymentStatus).join(', ')}`),
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('notes must not exceed 1000 characters'),
    body('created_by')
        .optional()
        .isUUID()
        .withMessage('created_by must be a valid UUID'),
    body('purchase_date')
        .optional()
        .isISO8601()
        .withMessage('purchase_date must be a valid ISO 8601 date'),
    handleValidationErrors
];

export const validateUpdatePurchase = [
    body('supplier_id')
        .optional()
        .isUUID()
        .withMessage('supplier_id must be a valid UUID'),
    body('subtotal')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('subtotal must be a non-negative number'),
    body('tax_amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('tax_amount must be a non-negative number'),
    body('discount_amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('discount_amount must be a non-negative number'),
    body('total_amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('total_amount must be a non-negative number'),
    body('payment_method')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('payment_method must not exceed 50 characters'),
    body('payment_status')
        .optional()
        .isIn(Object.values(PaymentStatus))
        .withMessage(`payment_status must be one of: ${Object.values(PaymentStatus).join(', ')}`),
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('notes must not exceed 1000 characters'),
    body('created_by')
        .optional()
        .isUUID()
        .withMessage('created_by must be a valid UUID'),
    body('purchase_date')
        .optional()
        .isISO8601()
        .withMessage('purchase_date must be a valid ISO 8601 date'),
    handleValidationErrors
];

// Purchase Item Validations
export const validateCreatePurchaseItem = [
    body('purchase_id')
        .isUUID()
        .withMessage('purchase_id must be a valid UUID'),
    body('product_id')
        .isUUID()
        .withMessage('product_id must be a valid UUID'),
    body('quantity')
        .isInt({ min: 1 })
        .withMessage('quantity must be a positive integer'),
    body('unit_price')
        .isFloat({ min: 0 })
        .withMessage('unit_price must be a non-negative number'),
    body('discount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('discount must be a non-negative number'),
    body('line_total')
        .isFloat({ min: 0 })
        .withMessage('line_total must be a non-negative number'),
    handleValidationErrors
];

export const validateUpdatePurchaseItem = [
    body('product_id')
        .optional()
        .isUUID()
        .withMessage('product_id must be a valid UUID'),
    body('quantity')
        .optional()
        .isInt({ min: 1 })
        .withMessage('quantity must be a positive integer'),
    body('unit_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('unit_price must be a non-negative number'),
    body('discount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('discount must be a non-negative number'),
    body('line_total')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('line_total must be a non-negative number'),
    handleValidationErrors
];

// Stock Movement Validations
export const validateCreateStockMovement = [
    body('product_id')
        .isUUID()
        .withMessage('product_id must be a valid UUID'),
    body('movement_type')
        .isIn(Object.values(MovementType))
        .withMessage(`movement_type must be one of: ${Object.values(MovementType).join(', ')}`),
    body('sale_item_id')
        .optional()
        .isUUID()
        .withMessage('sale_item_id must be a valid UUID'),
    body('purchase_item_id')
        .optional()
        .isUUID()
        .withMessage('purchase_item_id must be a valid UUID'),
    body('adjustment_reason')
        .optional()
        .isIn(Object.values(AdjustmentReason))
        .withMessage(`adjustment_reason must be one of: ${Object.values(AdjustmentReason).join(', ')}`),
    body('quantity_change')
        .isInt()
        .withMessage('quantity_change must be an integer')
        .custom((value) => {
            if (value === 0) {
                throw new Error('quantity_change cannot be zero');
            }
            return true;
        }),
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('notes must not exceed 1000 characters'),
    body('created_by')
        .optional()
        .isUUID()
        .withMessage('created_by must be a valid UUID'),
    handleValidationErrors
];

export const validateUpdateStockMovement = [
    body('product_id')
        .optional()
        .isUUID()
        .withMessage('product_id must be a valid UUID'),
    body('movement_type')
        .optional()
        .isIn(Object.values(MovementType))
        .withMessage(`movement_type must be one of: ${Object.values(MovementType).join(', ')}`),
    body('sale_item_id')
        .optional()
        .isUUID()
        .withMessage('sale_item_id must be a valid UUID'),
    body('purchase_item_id')
        .optional()
        .isUUID()
        .withMessage('purchase_item_id must be a valid UUID'),
    body('adjustment_reason')
        .optional()
        .isIn(Object.values(AdjustmentReason))
        .withMessage(`adjustment_reason must be one of: ${Object.values(AdjustmentReason).join(', ')}`),
    body('quantity_change')
        .optional()
        .isInt()
        .withMessage('quantity_change must be an integer')
        .custom((value) => {
            if (value === 0) {
                throw new Error('quantity_change cannot be zero');
            }
            return true;
        }),
    body('notes')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('notes must not exceed 1000 characters'),
    body('created_by')
        .optional()
        .isUUID()
        .withMessage('created_by must be a valid UUID'),
    handleValidationErrors
];

// Expense Validations
export const validateCreateExpense = [
    body('expense_category')
        .trim()
        .notEmpty()
        .withMessage('expense_category is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('expense_category must be between 2 and 100 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('description must not exceed 500 characters'),
    body('amount')
        .isFloat({ min: 0 })
        .withMessage('amount must be a non-negative number'),
    body('expense_date')
        .isISO8601()
        .withMessage('expense_date must be a valid ISO 8601 date'),
    body('payment_method')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('payment_method must not exceed 50 characters'),
    body('reference_number')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('reference_number must not exceed 100 characters'),
    body('recorded_by')
        .optional()
        .isUUID()
        .withMessage('recorded_by must be a valid UUID'),
    handleValidationErrors
];

export const validateUpdateExpense = [
    body('expense_category')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('expense_category must be between 2 and 100 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('description must not exceed 500 characters'),
    body('amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('amount must be a non-negative number'),
    body('expense_date')
        .optional()
        .isISO8601()
        .withMessage('expense_date must be a valid ISO 8601 date'),
    body('payment_method')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('payment_method must not exceed 50 characters'),
    body('reference_number')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('reference_number must not exceed 100 characters'),
    body('recorded_by')
        .optional()
        .isUUID()
        .withMessage('recorded_by must be a valid UUID'),
    handleValidationErrors
];

// UUID Parameter Validations
export const validateUUIDParam = (paramName: string = 'id') => [
    param(paramName)
        .isUUID()
        .withMessage(`${paramName} must be a valid UUID`),
    handleValidationErrors
];

// Query Parameter Validations
export const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('limit must be between 1 and 100'),
    handleValidationErrors
];

