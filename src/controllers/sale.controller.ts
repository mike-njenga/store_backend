import type { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import type { CreateSaleInput, CreateSaleItemInput } from '../types/model.types.js';
import { PaymentMethod, PaymentStatus } from '../types/model.types.js';
import { generateReceiptPDF } from '../services/receipt.service.js';

// Create sale with items
export const createSale = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { items, ...saleData }: CreateSaleInput & { items: CreateSaleItemInput[] } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Sale must have at least one item',
            });
        }

        // Validate that all products exist and are active
        const productIds = items.map(item => item.product_id);
        const { data: products, error: productsError } = await supabaseAdmin
            .from('products')
            .select('id, retail_price, wholesale_price, is_active')
            .in('id', productIds);

        if (productsError || !products || products.length !== productIds.length) {
            return res.status(400).json({
                status: 'error',
                message: 'One or more products not found',
            });
        }

        // Check if any product is inactive
        const inactiveProducts = products.filter(p => !p.is_active);
        if (inactiveProducts.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot sell inactive products',
            });
        }

        // Check stock availability for all items
        const { data: inventory, error: inventoryError } = await supabaseAdmin
            .from('inventory')
            .select('product_id, quantity')
            .in('product_id', productIds);

        if (inventoryError) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to check inventory',
                details: inventoryError.message,
            });
        }

        const inventoryMap = new Map(
            inventory?.map(inv => [inv.product_id, inv.quantity]) || []
        );

        // Validate stock availability
        for (const item of items) {
            const availableStock = inventoryMap.get(item.product_id) ?? 0;
            if (item.quantity > availableStock) {
                const product = products.find(p => p.id === item.product_id);
                return res.status(400).json({
                    status: 'error',
                    message: `Insufficient stock for product. Available: ${availableStock}, Requested: ${item.quantity}`,
                });
            }
        }

        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
        const discountAmount = saleData.discount_amount ?? 0;
        const totalAmount = subtotal - discountAmount;

        // Determine payment status and amount_paid
        const paymentMethod = saleData.payment_method ?? PaymentMethod.CASH;
        const isCashPayment = paymentMethod === PaymentMethod.CASH;
        const hasCustomer = !!saleData.customer_id;
        
        // If cash payment OR no customer (walk-in), mark as paid
        // Otherwise, if customer exists and not cash, mark as pending (credit sale)
        const paymentStatus = (isCashPayment || !hasCustomer) 
            ? PaymentStatus.PAID 
            : PaymentStatus.PENDING;
        const amountPaid = (isCashPayment || !hasCustomer) 
            ? totalAmount 
            : 0;

        // Create sale
        const salePayload: CreateSaleInput & { payment_status?: PaymentStatus; amount_paid?: number } = {
            ...saleData,
            subtotal,
            total_amount: totalAmount,
            cashier_id: saleData.cashier_id || userId || null,
            payment_method: paymentMethod,
            discount_amount: discountAmount,
            payment_status: paymentStatus,
            amount_paid: amountPaid,
            sale_date: saleData.sale_date || new Date().toISOString(),
        };

        const { data: sale, error: saleError } = await supabaseAdmin
            .from('sales')
            .insert(salePayload)
            .select()
            .single();

        if (saleError || !sale) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to create sale',
                details: saleError?.message || 'Unknown error',
            });
        }

        // Create sale items
        const saleItems = items.map(item => ({
            sale_id: sale.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount ?? 0,
            line_total: item.line_total,
        }));

        const { data: createdItems, error: itemsError } = await supabaseAdmin
            .from('sale_items')
            .insert(saleItems)
            .select();

        if (itemsError || !createdItems) {
            // Rollback: delete the sale
            await supabaseAdmin.from('sales').delete().eq('id', sale.id);
            return res.status(400).json({
                status: 'error',
                message: 'Failed to create sale items',
                details: itemsError?.message || 'Unknown error',
            });
        }

        // Get sale with items and customer
        const { data: saleWithDetails } = await supabaseAdmin
            .from('sales')
            .select(`
                *,
                customer:customers(*),
                items:sale_items(
                    *,
                    product:products(*)
                )
            `)
            .eq('id', sale.id)
            .single();

        res.status(201).json({
            status: 'success',
            message: 'Sale created successfully',
            data: saleWithDetails,
        });
    } catch (error) {
        console.error('Create sale error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get all sales with filters
export const getSales = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 50, customer_id, cashier_id, payment_method, start_date, end_date } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabaseAdmin
            .from('sales')
            .select(`
                *,
                customer:customers(id, name, customer_type),
                cashier:user_profiles(id, username, full_name)
            `, { count: 'exact' })
            .order('sale_date', { ascending: false })
            .order('sale_number', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (customer_id) {
            query = query.eq('customer_id', customer_id);
        }
        if (cashier_id) {
            query = query.eq('cashier_id', cashier_id);
        }
        if (payment_method) {
            query = query.eq('payment_method', payment_method);
        }
        if (start_date) {
            query = query.gte('sale_date', start_date);
        }
        if (end_date) {
            query = query.lte('sale_date', end_date);
        }

        const { data: sales, error, count } = await query;

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch sales',
                details: error.message,
            });
        }

        res.status(200).json({
            status: 'success',
            data: sales || [],
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get sales error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get single sale by ID with items
export const getSaleById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Sale ID is required',
            });
        }

        const { data: sale, error } = await supabaseAdmin
            .from('sales')
            .select(`
                *,
                customer:customers(*),
                cashier:user_profiles(id, username, full_name, role),
                items:sale_items(
                    *,
                    product:products(*)
                )
            `)
            .eq('id', id)
            .single();

        if (error || !sale) {
            return res.status(404).json({
                status: 'error',
                message: 'Sale not found',
            });
        }

        res.status(200).json({
            status: 'success',
            data: sale,
        });
    } catch (error) {
        console.error('Get sale error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Generate receipt PDF for a sale
export const generateReceipt = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Sale ID is required',
            });
        }

        // Fetch sale with all related data
        const { data: sale, error } = await supabaseAdmin
            .from('sales')
            .select(`
                *,
                customer:customers(*),
                cashier:user_profiles(id, username, full_name, role),
                items:sale_items(
                    *,
                    product:products(*)
                )
            `)
            .eq('id', id)
            .single();

        if (error || !sale) {
            return res.status(404).json({
                status: 'error',
                message: 'Sale not found',
            });
        }

        // Handle Supabase array response for relations
        const saleData = {
            ...sale,
            customer: Array.isArray(sale.customer) ? sale.customer[0] : sale.customer,
            cashier: Array.isArray(sale.cashier) ? sale.cashier[0] : sale.cashier,
            items: Array.isArray(sale.items) ? sale.items.map((item: any) => ({
                ...item,
                product: Array.isArray(item.product) ? item.product[0] : item.product,
            })) : sale.items,
        };

        // Generate PDF receipt
        const pdfBuffer = await generateReceiptPDF({
            sale: saleData,
            // Shop information can be configured via environment variables or settings
            shopName: process.env.SHOP_NAME || 'Hardware Shop',
            shopAddress: process.env.SHOP_ADDRESS || '',
            shopPhone: process.env.SHOP_PHONE || '',
            shopEmail: process.env.SHOP_EMAIL || '',
        });

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="receipt-${sale.sale_number}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        // Send PDF buffer
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Generate receipt error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate receipt',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Delete sale (cascade deletes items and reverses stock movements)
export const deleteSale = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Sale ID is required',
            });
        }

        // Check if sale exists
        const { data: existingSale } = await supabaseAdmin
            .from('sales')
            .select('id')
            .eq('id', id)
            .single();

        if (!existingSale) {
            return res.status(404).json({
                status: 'error',
                message: 'Sale not found',
            });
        }

        // Delete sale (cascade deletes items, which triggers stock movement reversal via database triggers)
        const { error } = await supabaseAdmin
            .from('sales')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to delete sale',
                details: error.message,
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Sale deleted successfully',
        });
    } catch (error) {
        console.error('Delete sale error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};


