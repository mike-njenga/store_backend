-- Migration: Add Payment Tracking for Customer Credit Management
-- This migration adds payment tracking capabilities to link customers with sales
-- and track payment status and balance

-- Add payment_status and amount_paid columns to sales table
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'paid' CHECK (payment_status IN ('pending', 'partial', 'paid')),
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) DEFAULT 0;

-- Update existing sales: if payment_method is 'cash', set payment_status to 'paid' and amount_paid to total_amount
UPDATE sales 
SET 
    payment_status = CASE 
        WHEN payment_method = 'cash' THEN 'paid'
        ELSE 'pending'
    END,
    amount_paid = CASE 
        WHEN payment_method = 'cash' THEN total_amount
        ELSE 0
    END
WHERE payment_status IS NULL OR amount_paid IS NULL;

-- Create customer_payments table to track individual payments
CREATE TABLE IF NOT EXISTS customer_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'mpesa', 'card', 'bank_transfer')),
    reference_number VARCHAR(100),
    notes TEXT,
    recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_payments_sale ON customer_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON customer_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_customer_payment ON sales(customer_id, payment_status);

-- Function to update sale payment status and amount_paid
CREATE OR REPLACE FUNCTION update_sale_payment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_total_amount NUMERIC(10, 2);
    v_amount_paid NUMERIC(10, 2);
    v_payment_status VARCHAR(20);
BEGIN
    -- Get sale total amount
    SELECT total_amount INTO v_total_amount FROM sales WHERE id = NEW.sale_id;
    
    -- Calculate total amount paid for this sale
    SELECT COALESCE(SUM(amount), 0) INTO v_amount_paid 
    FROM customer_payments 
    WHERE sale_id = NEW.sale_id;
    
    -- Determine payment status
    IF v_amount_paid >= v_total_amount THEN
        v_payment_status := 'paid';
    ELSIF v_amount_paid > 0 THEN
        v_payment_status := 'partial';
    ELSE
        v_payment_status := 'pending';
    END IF;
    
    -- Update sale record
    UPDATE sales 
    SET 
        payment_status = v_payment_status,
        amount_paid = v_amount_paid
    WHERE id = NEW.sale_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update sale payment status when payment is recorded
CREATE TRIGGER update_sale_payment_on_payment_insert
    AFTER INSERT ON customer_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_payment_status();

-- Trigger to update sale payment status when payment is deleted
CREATE TRIGGER update_sale_payment_on_payment_delete
    AFTER DELETE ON customer_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_payment_status();

-- Function to update customer balance when payment is recorded
CREATE OR REPLACE FUNCTION update_customer_balance_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_sale_total NUMERIC(10, 2);
    v_customer_id UUID;
BEGIN
    -- Get sale details
    SELECT customer_id, total_amount INTO v_customer_id, v_sale_total
    FROM sales WHERE id = NEW.sale_id;
    
    -- Only update balance if sale has a customer (credit sale)
    IF v_customer_id IS NOT NULL THEN
        -- Recalculate customer balance based on all unpaid sales
        UPDATE customers
        SET current_balance = (
            SELECT COALESCE(SUM(s.total_amount - COALESCE(s.amount_paid, 0)), 0)
            FROM sales s
            WHERE s.customer_id = v_customer_id
            AND s.payment_status IN ('pending', 'partial')
        )
        WHERE id = v_customer_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update customer balance when payment is recorded
CREATE TRIGGER update_customer_balance_on_payment_insert
    AFTER INSERT ON customer_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_balance_on_payment();

-- Trigger to update customer balance when payment is deleted
CREATE TRIGGER update_customer_balance_on_payment_delete
    AFTER DELETE ON customer_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_balance_on_payment();

-- Function to update customer balance when sale is created
CREATE OR REPLACE FUNCTION update_customer_balance_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update balance if sale has a customer and is not fully paid
    IF NEW.customer_id IS NOT NULL AND NEW.payment_status IN ('pending', 'partial') THEN
        UPDATE customers
        SET current_balance = (
            SELECT COALESCE(SUM(s.total_amount - COALESCE(s.amount_paid, 0)), 0)
            FROM sales s
            WHERE s.customer_id = NEW.customer_id
            AND s.payment_status IN ('pending', 'partial')
        )
        WHERE id = NEW.customer_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update customer balance when sale is created or updated
CREATE TRIGGER update_customer_balance_on_sale_insert
    AFTER INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_balance_on_sale();

CREATE TRIGGER update_customer_balance_on_sale_update
    AFTER UPDATE ON sales
    FOR EACH ROW
    WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status OR OLD.amount_paid IS DISTINCT FROM NEW.amount_paid)
    EXECUTE FUNCTION update_customer_balance_on_sale();

-- Enable RLS on customer_payments table
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_payments
CREATE POLICY "Authenticated users can view customer payments"
    ON customer_payments FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Cashiers and above can create customer payments"
    ON customer_payments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('owner', 'manager', 'cashier')
        )
    );

CREATE POLICY "Managers and owners can update customer payments"
    ON customer_payments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('owner', 'manager')
        )
    );

CREATE POLICY "Managers and owners can delete customer payments"
    ON customer_payments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role IN ('owner', 'manager')
        )
    );

