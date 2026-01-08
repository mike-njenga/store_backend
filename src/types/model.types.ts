// Type definitions for Hardware Shop Management Database

// Base types
export type UUID = string;
export type Timestamp = Date | string;

// Enums
export enum UserRole {
  OWNER = 'owner',
  MANAGER = 'manager',
  CASHIER = 'cashier',
  STAFF = 'staff',
}

export enum CustomerType {
  RETAIL = 'retail',
  WHOLESALE = 'wholesale',
  CONTRACTOR = 'contractor',
}

export enum PaymentMethod {
  CASH = 'cash',
  MPESA = 'mpesa',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
}

export enum MovementType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  ADJUSTMENT = 'adjustment',
}

export enum AdjustmentReason {
  EXPIRED = 'expired',
  DAMAGED = 'damaged',
  LOST = 'lost',
  THEFT = 'theft',
  CORRECTION = 'correction',
  BREAKAGE = 'breakage',
}

// User Profile
export interface UserProfile {
  id: UUID;
  username: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CreateUserProfileInput {
  id: UUID;
  username: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  is_active?: boolean;
}

export interface UpdateUserProfileInput {
  username?: string;
  full_name?: string;
  role?: UserRole;
  phone?: string | null;
  is_active?: boolean;
}

// Supplier
export interface Supplier {
  id: UUID;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CreateSupplierInput {
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export interface UpdateSupplierInput {
  name?: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

// Product
export interface Product {
  id: UUID;
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  unit: string;
  purchase_price: number;
  retail_price: number;
  wholesale_price?: number | null;
  min_stock_level: number;
  reorder_quantity: number;
  shelf_location?: string | null;
  supplier_id?: UUID | null;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CreateProductInput {
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  unit: string;
  purchase_price: number;
  retail_price: number;
  wholesale_price?: number | null;
  min_stock_level?: number;
  reorder_quantity?: number;
  shelf_location?: string | null;
  supplier_id?: UUID | null;
  is_active?: boolean;
}

export interface UpdateProductInput {
  sku?: string;
  barcode?: string | null;
  name?: string;
  description?: string | null;
  category?: string | null;
  unit?: string;
  purchase_price?: number;
  retail_price?: number;
  wholesale_price?: number | null;
  min_stock_level?: number;
  reorder_quantity?: number;
  shelf_location?: string | null;
  supplier_id?: UUID | null;
  is_active?: boolean;
}

// Inventory
export interface Inventory {
  id: UUID;
  product_id: UUID;
  quantity: number;
  last_updated: Timestamp;
  updated_by?: UUID | null;
}

export interface CreateInventoryInput {
  product_id: UUID;
  quantity: number;
  updated_by?: UUID | null;
}

export interface UpdateInventoryInput {
  quantity?: number;
  updated_by?: UUID | null;
}

// Customer
export interface Customer {
  id: UUID;
  name: string;
  customer_type: CustomerType;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  credit_limit: number;
  current_balance: number;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CreateCustomerInput {
  name: string;
  customer_type?: CustomerType;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  credit_limit?: number;
  current_balance?: number;
  is_active?: boolean;
}

export interface UpdateCustomerInput {
  name?: string;
  customer_type?: CustomerType;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  credit_limit?: number;
  current_balance?: number;
  is_active?: boolean;
}

// Sale
export interface Sale {
  id: UUID;
  sale_number: number;
  customer_id?: UUID | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status?: PaymentStatus | null;
  amount_paid?: number | null;
  cashier_id?: UUID | null;
  notes?: string | null;
  sale_date: Timestamp;
  created_at: Timestamp;
}

export interface CreateSaleInput {
  customer_id?: UUID | null;
  subtotal: number;
  discount_amount?: number;
  total_amount: number;
  payment_method?: PaymentMethod;
  cashier_id?: UUID | null;
  notes?: string | null;
  sale_date?: Timestamp;
}

export interface UpdateSaleInput {
  customer_id?: UUID | null;
  subtotal?: number;
  discount_amount?: number;
  total_amount?: number;
  payment_method?: PaymentMethod;
  cashier_id?: UUID | null;
  notes?: string | null;
  sale_date?: Timestamp;
}

// Sale Item
export interface SaleItem {
  id: UUID;
  sale_id: UUID;
  product_id: UUID;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

export interface CreateSaleItemInput {
  sale_id: UUID;
  product_id: UUID;
  quantity: number;
  unit_price: number;
  discount?: number;
  line_total: number;
}

export interface UpdateSaleItemInput {
  product_id?: UUID;
  quantity?: number;
  unit_price?: number;
  discount?: number;
  line_total?: number;
}

// Purchase
export interface Purchase {
  id: UUID;
  purchase_number: number;
  supplier_id: UUID;
  subtotal: number;
  
  discount_amount: number;
  total_amount: number;
  payment_method?: string | null;
  payment_status: PaymentStatus;
  notes?: string | null;
  created_by?: UUID | null;
  purchase_date: Timestamp;
  created_at: Timestamp;
}

export interface CreatePurchaseInput {
  supplier_id: UUID;
  subtotal: number;
  discount_amount?: number;
  total_amount: number;
  payment_method?: string | null;
  payment_status?: PaymentStatus;
  notes?: string | null;
  created_by?: UUID | null;
  purchase_date?: Timestamp;
}

export interface UpdatePurchaseInput {
  supplier_id?: UUID;
  subtotal?: number;
  discount_amount?: number;
  total_amount?: number;
  payment_method?: string | null;
  payment_status?: PaymentStatus;
  notes?: string | null;
  created_by?: UUID | null;
  purchase_date?: Timestamp;
}

// Purchase Item
export interface PurchaseItem {
  id: UUID;
  purchase_id: UUID;
  product_id: UUID;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

export interface CreatePurchaseItemInput {
  purchase_id: UUID;
  product_id: UUID;
  quantity: number;
  unit_price: number;
  discount?: number;
  line_total: number;
}

export interface UpdatePurchaseItemInput {
  product_id?: UUID;
  quantity?: number;
  unit_price?: number;
  discount?: number;
  line_total?: number;
}

// Stock Movement
export interface StockMovement {
  id: UUID;
  product_id: UUID;
  movement_type: MovementType;
  sale_item_id?: UUID | null;
  purchase_item_id?: UUID | null;
  adjustment_reason?: AdjustmentReason | null;
  quantity_change: number;
  notes?: string | null;
  created_by?: UUID | null;
  created_at: Timestamp;
}

export interface CreateStockMovementInput {
  product_id: UUID;
  movement_type: MovementType;
  sale_item_id?: UUID | null;
  purchase_item_id?: UUID | null;
  adjustment_reason?: AdjustmentReason | null;
  quantity_change: number;
  notes?: string | null;
  created_by?: UUID | null;
}

export interface UpdateStockMovementInput {
  product_id?: UUID;
  movement_type?: MovementType;
  sale_item_id?: UUID | null;
  purchase_item_id?: UUID | null;
  adjustment_reason?: AdjustmentReason | null;
  quantity_change?: number;
  notes?: string | null;
  created_by?: UUID | null;
}

// Expense
export interface Expense {
  expenses_id: UUID;
  expense_category: string;
  description?: string | null;
  amount: number;
  expense_date: Date | string;
  payment_method?: string | null;
  reference_number?: string | null;
  recorded_by?: UUID | null;
  created_at: Timestamp;
}

export interface CreateExpenseInput {
  expense_category: string;
  description?: string | null;
  amount: number;
  expense_date: Date | string;
  payment_method?: string | null;
  reference_number?: string | null;
  recorded_by?: UUID | null;
}

export interface UpdateExpenseInput {
  expense_category?: string;
  description?: string | null;
  amount?: number;
  expense_date?: Date | string;
  payment_method?: string | null;
  reference_number?: string | null;
  recorded_by?: UUID | null;
}

// Extended types with relations
export interface ProductWithSupplier extends Product {
  supplier?: Supplier | null;
}

export interface ProductWithInventory extends Product {
  inventory?: Inventory | null;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
  customer?: Customer | null;
}

export interface SaleItemWithProduct extends SaleItem {
  product?: Product | null;
}

export interface PurchaseWithItems extends Purchase {
  items: PurchaseItem[];
  supplier?: Supplier | null;
}

export interface PurchaseItemWithProduct extends PurchaseItem {
  product?: Product | null;
}

export interface StockMovementWithProduct extends StockMovement {
  product?: Product | null;
}

// Customer Payment
export interface CustomerPayment {
  id: UUID;
  sale_id: UUID;
  customer_id: UUID;
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string | null;
  notes?: string | null;
  recorded_by?: UUID | null;
  payment_date: Timestamp;
  created_at: Timestamp;
}

export interface CreateCustomerPaymentInput {
  sale_id: UUID;
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string | null;
  notes?: string | null;
}

export interface UpdateCustomerPaymentInput {
  amount?: number;
  payment_method?: PaymentMethod;
  reference_number?: string | null;
  notes?: string | null;
}

export interface CustomerPaymentWithSale extends CustomerPayment {
  sale?: Sale | null;
}

export interface CustomerPaymentWithCustomer extends CustomerPayment {
  customer?: Customer | null;
}

export interface CustomerPaymentWithRelations extends CustomerPayment {
  sale?: Sale | null;
  customer?: Customer | null;
}

