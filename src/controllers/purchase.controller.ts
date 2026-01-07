import type { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import type { CreatePurchaseInput, CreatePurchaseItemInput } from '../types/model.types.js';
import { PaymentStatus } from '../types/model.types.js';

// Create purchase with items
export const createPurchase = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { items, ...purchaseData }: CreatePurchaseInput & { items: CreatePurchaseItemInput[] } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Purchase must have at least one item',
            });
        }

        // Validate supplier exists and is active
        const { data: supplier, error: supplierError } = await supabaseAdmin
            .from('suppliers')
            .select('id, is_active')
            .eq('id', purchaseData.supplier_id)
            .single();

        if (supplierError || !supplier) {
            return res.status(400).json({
                status: 'error',
                message: 'Supplier not found',
            });
        }

        if (!supplier.is_active) {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot purchase from inactive supplier',
            });
        }

        // Validate that all products exist
        const productIds = items.map(item => item.product_id);
        const { data: products, error: productsError } = await supabaseAdmin
            .from('products')
            .select('id, name')
            .in('id', productIds);

        if (productsError || !products || products.length !== productIds.length) {
            return res.status(400).json({
                status: 'error',
                message: 'One or more products not found',
            });
        }

        // Create purchase
        const purchasePayload: CreatePurchaseInput = {
            ...purchaseData,
            created_by: purchaseData.created_by || userId || null,
            payment_status: purchaseData.payment_status || PaymentStatus.PENDING,
            discount_amount: purchaseData.discount_amount ?? 0,
            purchase_date: purchaseData.purchase_date || new Date().toISOString(),
        };

        const { data: purchase, error: purchaseError } = await supabaseAdmin
            .from('purchases')
            .insert(purchasePayload)
            .select()
            .single();

        if (purchaseError || !purchase) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to create purchase',
                details: purchaseError?.message || 'Unknown error',
            });
        }

        // Create purchase items
        const purchaseItems = items.map(item => ({
            purchase_id: purchase.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount ?? 0,
            line_total: item.line_total,
        }));

        const { data: createdItems, error: itemsError } = await supabaseAdmin
            .from('purchase_items')
            .insert(purchaseItems)
            .select();

        if (itemsError || !createdItems) {
            // Rollback: delete the purchase
            await supabaseAdmin.from('purchases').delete().eq('id', purchase.id);
            return res.status(400).json({
                status: 'error',
                message: 'Failed to create purchase items',
                details: itemsError?.message || 'Unknown error',
            });
        }

        // Get purchase with items and supplier
        const { data: purchaseWithDetails } = await supabaseAdmin
            .from('purchases')
            .select(`
                *,
                supplier:suppliers(*),
                items:purchase_items(
                    *,
                    product:products(*)
                )
            `)
            .eq('id', purchase.id)
            .single();

        res.status(201).json({
            status: 'success',
            message: 'Purchase created successfully',
            data: purchaseWithDetails,
        });
    } catch (error) {
        console.error('Create purchase error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get all purchases with filters
export const getPurchases = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 50, supplier_id, payment_status, start_date, end_date } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabaseAdmin
            .from('purchases')
            .select(`
                *,
                supplier:suppliers(id, name, contact_person),
                creator:user_profiles(id, username, full_name)
            `, { count: 'exact' })
            .order('purchase_date', { ascending: false })
            .order('purchase_number', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (supplier_id) {
            query = query.eq('supplier_id', supplier_id);
        }
        if (payment_status) {
            query = query.eq('payment_status', payment_status);
        }
        if (start_date) {
            query = query.gte('purchase_date', start_date);
        }
        if (end_date) {
            query = query.lte('purchase_date', end_date);
        }

        const { data: purchases, error, count } = await query;

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch purchases',
                details: error.message,
            });
        }

        res.status(200).json({
            status: 'success',
            data: purchases || [],
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get purchases error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get single purchase by ID with items
export const getPurchaseById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Purchase ID is required',
            });
        }

        const { data: purchase, error } = await supabaseAdmin
            .from('purchases')
            .select(`
                *,
                supplier:suppliers(*),
                creator:user_profiles(id, username, full_name, role),
                items:purchase_items(
                    *,
                    product:products(*)
                )
            `)
            .eq('id', id)
            .single();

        if (error || !purchase) {
            return res.status(404).json({
                status: 'error',
                message: 'Purchase not found',
            });
        }

        res.status(200).json({
            status: 'success',
            data: purchase,
        });
    } catch (error) {
        console.error('Get purchase error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Update purchase payment status
export const updatePurchasePaymentStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { payment_status } = req.body;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Purchase ID is required',
            });
        }

        if (!payment_status || !Object.values(PaymentStatus).includes(payment_status)) {
            return res.status(400).json({
                status: 'error',
                message: `payment_status must be one of: ${Object.values(PaymentStatus).join(', ')}`,
            });
        }

        // Check if purchase exists
        const { data: existingPurchase } = await supabaseAdmin
            .from('purchases')
            .select('id')
            .eq('id', id)
            .single();

        if (!existingPurchase) {
            return res.status(404).json({
                status: 'error',
                message: 'Purchase not found',
            });
        }

        // Update payment status
        const { data: purchase, error } = await supabaseAdmin
            .from('purchases')
            .update({
                payment_status,
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !purchase) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to update purchase payment status',
                details: error?.message || 'Unknown error',
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Purchase payment status updated successfully',
            data: purchase,
        });
    } catch (error) {
        console.error('Update purchase payment status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Delete purchase (cascade deletes items and reverses stock movements)
export const deletePurchase = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Purchase ID is required',
            });
        }

        // Check if purchase exists
        const { data: existingPurchase } = await supabaseAdmin
            .from('purchases')
            .select('id')
            .eq('id', id)
            .single();

        if (!existingPurchase) {
            return res.status(404).json({
                status: 'error',
                message: 'Purchase not found',
            });
        }

        // Delete purchase (cascade deletes items, which triggers stock movement reversal via database triggers)
        const { error } = await supabaseAdmin
            .from('purchases')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to delete purchase',
                details: error.message,
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Purchase deleted successfully',
        });
    } catch (error) {
        console.error('Delete purchase error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

