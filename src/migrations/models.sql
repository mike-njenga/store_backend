-- Hardware Shop Management Database Schema for Supabase
-- PostgreSQL syntax with UUID references to auth.users

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'staff')),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    payment_terms VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(100),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit VARCHAR(50) NOT NULL,
    purchase_price NUMERIC(10, 2) NOT NULL,
    retail_price NUMERIC(10, 2) NOT NULL,
    wholesale_price NUMERIC(10, 2),
    min_stock_level INTEGER DEFAULT 0,
    reorder_quantity INTEGER DEFAULT 0,
    supplier_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- Stock Inventory (tracks current quantity only)
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL UNIQUE,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    customer_type VARCHAR(20) DEFAULT 'retail' CHECK (customer_type IN ('retail', 'wholesale', 'contractor')),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    credit_limit NUMERIC(10, 2) DEFAULT 0,
    current_balance NUMERIC(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales (transaction header - one row per sale)
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_number SERIAL UNIQUE,
    customer_id UUID,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
   
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'mpesa', 'card', 'bank_transfer')),
    cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    sale_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- Sale Items (line items - multiple items per sale)
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    discount NUMERIC(10, 2) DEFAULT 0,
    line_total NUMERIC(10, 2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Purchases (transaction header - one row per purchase)
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_number SERIAL UNIQUE,
    supplier_id UUID NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    purchase_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Purchase Items (line items - multiple items per purchase)
CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    discount NUMERIC(10, 2) DEFAULT 0,
    line_total NUMERIC(10, 2) NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Stock Movements (tracks all inventory changes)
-- This table serves as an audit trail for inventory changes
-- sale_items and purchase_items should create entries here
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment')),
    -- Reference to source transaction (optional - only for purchase/sale movements)
    sale_item_id UUID,
    purchase_item_id UUID,
    -- Adjustment reason (only for adjustment movements)
    adjustment_reason VARCHAR(20) CHECK (
        (movement_type = 'adjustment' AND adjustment_reason IN ('expired', 'damaged', 'lost', 'theft', 'correction', 'breakage'))
        OR (movement_type != 'adjustment' AND adjustment_reason IS NULL)
    ),
    quantity_change NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE SET NULL,
    FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE SET NULL,
    -- Ensure only one reference is set
    CONSTRAINT check_single_reference CHECK (
        (movement_type = 'purchase' AND purchase_item_id IS NOT NULL AND sale_item_id IS NULL)
        OR (movement_type = 'sale' AND sale_item_id IS NOT NULL AND purchase_item_id IS NULL)
        OR (movement_type = 'adjustment' AND sale_item_id IS NULL AND purchase_item_id IS NULL)
    )
);

-- Expenses
CREATE TABLE expenses (
    expenses_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_category VARCHAR(100) NOT NULL,
    description TEXT,
    amount NUMERIC(10, 2) NOT NULL,
    expense_date DATE NOT NULL,
    payment_method VARCHAR(50),
    reference_number VARCHAR(100),
    recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update inventory from stock movements
CREATE OR REPLACE FUNCTION update_inventory_from_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert or update inventory record
    INSERT INTO inventory (product_id, quantity, last_updated, updated_by)
    VALUES (NEW.product_id, NEW.quantity_change, NOW(), NEW.created_by)
    ON CONFLICT (product_id) DO UPDATE
    SET 
        quantity = inventory.quantity + NEW.quantity_change,
        last_updated = NOW(),
        updated_by = NEW.created_by;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update inventory when stock movement is created
CREATE TRIGGER update_inventory_on_stock_movement
    AFTER INSERT ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_from_stock_movement();

-- Function to create stock movement from sale item
CREATE OR REPLACE FUNCTION create_stock_movement_from_sale()
RETURNS TRIGGER AS $$
DECLARE
    v_cashier_id UUID;
BEGIN
    -- Get cashier_id from the sale
    SELECT cashier_id INTO v_cashier_id FROM sales WHERE id = NEW.sale_id;
    
    -- Create stock movement (negative quantity for sale)
    INSERT INTO stock_movements (
        product_id,
        movement_type,
        sale_item_id,
        quantity_change,
        created_by,
        notes
    ) VALUES (
        NEW.product_id,
        'sale',
        NEW.id,
        -NEW.quantity, -- Negative because it's a sale (reducing inventory)
        v_cashier_id,
        'Auto-generated from sale item'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create stock movement when sale item is created
CREATE TRIGGER create_stock_movement_on_sale_item
    AFTER INSERT ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION create_stock_movement_from_sale();

-- Function to create stock movement from purchase item
CREATE OR REPLACE FUNCTION create_stock_movement_from_purchase()
RETURNS TRIGGER AS $$
DECLARE
    v_created_by UUID;
BEGIN
    -- Get created_by from the purchase
    SELECT created_by INTO v_created_by FROM purchases WHERE id = NEW.purchase_id;
    
    -- Create stock movement (positive quantity for purchase)
    INSERT INTO stock_movements (
        product_id,
        movement_type,
        purchase_item_id,
        quantity_change,
        created_by,
        notes
    ) VALUES (
        NEW.product_id,
        'purchase',
        NEW.id,
        NEW.quantity, -- Positive because it's a purchase (increasing inventory)
        v_created_by,
        'Auto-generated from purchase item'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create stock movement when purchase item is created
CREATE TRIGGER create_stock_movement_on_purchase_item
    AFTER INSERT ON purchase_items
    FOR EACH ROW
    EXECUTE FUNCTION create_stock_movement_from_purchase();

-- Indexes for better performance
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sales_sale_number ON sales(sale_number);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_purchases_date ON purchases(purchase_date);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX idx_purchases_purchase_number ON purchases(purchase_number);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_product ON purchase_items(product_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_date ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_sale_item ON stock_movements(sale_item_id);
CREATE INDEX idx_stock_movements_purchase_item ON stock_movements(purchase_item_id);
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Owners and managers can view all profiles"
    ON user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('owner', 'manager')
        )
    );

CREATE POLICY "Users can update their own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Owners can manage all profiles"
    ON user_profiles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'owner'
        )
    );

-- RLS Policies for products (all authenticated users can view, managers+ can modify)
CREATE POLICY "Authenticated users can view products"
    ON products FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Managers and owners can manage products"
    ON products FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('owner', 'manager')
        )
    );

-- RLS Policies for sales (cashiers+ can create, all can view)
CREATE POLICY "Authenticated users can view sales"
    ON sales FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Cashiers and above can create sales"
    ON sales FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('owner', 'manager', 'cashier')
        )
    );

CREATE POLICY "Cashiers and above can update sales"
    ON sales FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('owner', 'manager', 'cashier')
        )
    );

-- RLS Policies for sale_items
CREATE POLICY "Authenticated users can view sale items"
    ON sale_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sales
            WHERE sales.id = sale_items.sale_id
        )
    );

CREATE POLICY "Cashiers and above can manage sale items"
    ON sale_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('owner', 'manager', 'cashier')
        )
    );

-- RLS Policies for purchases
CREATE POLICY "Authenticated users can view purchases"
    ON purchases FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Managers and owners can create purchases"
    ON purchases FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('owner', 'manager')
        )
    );

CREATE POLICY "Managers and owners can update purchases"
    ON purchases FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('owner', 'manager')
        )
    );

-- RLS Policies for purchase_items
CREATE POLICY "Authenticated users can view purchase items"
    ON purchase_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM purchases
            WHERE purchases.id = purchase_items.purchase_id
        )
    );

CREATE POLICY "Managers and owners can manage purchase items"
    ON purchase_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('owner', 'manager')
        )
    );

-- RLS Policies for stock_movements
CREATE POLICY "Authenticated users can view stock movements"
    ON stock_movements FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authorized users can create stock movements"
    ON stock_movements FOR INSERT
    WITH CHECK (
        -- Adjustments require manager/owner role
        (movement_type = 'adjustment' AND
         EXISTS (
             SELECT 1 FROM user_profiles
             WHERE id = auth.uid() AND role IN ('owner', 'manager')
         ))
        OR
        -- Purchase/sale movements can be created by cashiers and above
        (movement_type IN ('purchase', 'sale') AND
         EXISTS (
             SELECT 1 FROM user_profiles
             WHERE id = auth.uid() AND role IN ('owner', 'manager', 'cashier')
         ))
    );