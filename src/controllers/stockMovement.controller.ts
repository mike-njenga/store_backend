import type { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import type { CreateStockMovementInput } from '../types/model.types.js';
import { MovementType, AdjustmentReason } from '../types/model.types.js';

// Create stock adjustment (manual adjustment only)
export const createStockAdjustment = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const adjustmentData: CreateStockMovementInput = req.body;

        // Only allow manual adjustments through this endpoint
        if (adjustmentData.movement_type !== MovementType.ADJUSTMENT) {
            return res.status(400).json({
                status: 'error',
                message: 'This endpoint only accepts adjustment movements. Purchase and sale movements are created automatically.',
            });
        }

        // Validate adjustment reason is provided for adjustments
        if (!adjustmentData.adjustment_reason) {
            return res.status(400).json({
                status: 'error',
                message: 'adjustment_reason is required for adjustment movements',
            });
        }

        // Ensure sale_item_id and purchase_item_id are null for adjustments
        if (adjustmentData.sale_item_id || adjustmentData.purchase_item_id) {
            return res.status(400).json({
                status: 'error',
                message: 'sale_item_id and purchase_item_id must be null for adjustment movements',
            });
        }

        // Validate product exists
        const { data: product, error: productError } = await supabaseAdmin
            .from('products')
            .select('id, name, is_active')
            .eq('id', adjustmentData.product_id)
            .single();

        if (productError || !product) {
            return res.status(400).json({
                status: 'error',
                message: 'Product not found',
            });
        }

        if (!product.is_active) {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot adjust stock for inactive product',
            });
        }

        // Get current stock to validate adjustment
        const { data: inventory } = await supabaseAdmin
            .from('inventory')
            .select('quantity')
            .eq('product_id', adjustmentData.product_id)
            .single();

        const currentStock = inventory?.quantity ?? 0;
        const newStock = currentStock + adjustmentData.quantity_change;

        // Warn if adjustment would result in negative stock (but allow it for corrections)
        if (newStock < 0 && adjustmentData.adjustment_reason !== AdjustmentReason.CORRECTION) {
            return res.status(400).json({
                status: 'error',
                message: `Adjustment would result in negative stock (current: ${currentStock}, change: ${adjustmentData.quantity_change}). Use 'correction' reason if this is intentional.`,
            });
        }

        // Create stock movement
        const movementPayload: CreateStockMovementInput = {
            ...adjustmentData,
            movement_type: MovementType.ADJUSTMENT,
            sale_item_id: null,
            purchase_item_id: null,
            created_by: adjustmentData.created_by || userId || null,
        };

        const { data: movement, error: movementError } = await supabaseAdmin
            .from('stock_movements')
            .insert(movementPayload)
            .select()
            .single();

        if (movementError || !movement) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to create stock adjustment',
                details: movementError?.message || 'Unknown error',
            });
        }

        // Get movement with product details
        const { data: movementWithDetails } = await supabaseAdmin
            .from('stock_movements')
            .select(`
                *,
                product:products(id, sku, name, unit)
            `)
            .eq('id', movement.id)
            .single();

        res.status(201).json({
            status: 'success',
            message: 'Stock adjustment created successfully',
            data: movementWithDetails,
        });
    } catch (error) {
        console.error('Create stock adjustment error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get all stock movements with filters
export const getStockMovements = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 50, product_id, movement_type, start_date, end_date } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabaseAdmin
            .from('stock_movements')
            .select(`
                *,
                product:products(id, sku, name, unit)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (product_id) {
            query = query.eq('product_id', product_id);
        }
        if (movement_type) {
            query = query.eq('movement_type', movement_type);
        }
        if (start_date) {
            query = query.gte('created_at', start_date);
        }
        if (end_date) {
            query = query.lte('created_at', end_date);
        }

        const { data: movements, error, count } = await query;

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch stock movements',
                details: error.message,
            });
        }

        res.status(200).json({
            status: 'success',
            data: movements || [],
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get stock movements error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get stock movements by product ID
export const getStockMovementsByProduct = async (req: Request, res: Response) => {
    try {
        const { product_id } = req.params;
        const { page = 1, limit = 50, movement_type, start_date, end_date } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        if (!product_id) {
            return res.status(400).json({
                status: 'error',
                message: 'Product ID is required',
            });
        }

        // Verify product exists
        const { data: product } = await supabaseAdmin
            .from('products')
            .select('id')
            .eq('id', product_id)
            .single();

        if (!product) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found',
            });
        }

        let query = supabaseAdmin
            .from('stock_movements')
            .select(`
                *,
                product:products(id, sku, name, unit)
            `, { count: 'exact' })
            .eq('product_id', product_id)
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (movement_type) {
            query = query.eq('movement_type', movement_type);
        }
        if (start_date) {
            query = query.gte('created_at', start_date);
        }
        if (end_date) {
            query = query.lte('created_at', end_date);
        }

        const { data: movements, error, count } = await query;

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch stock movements',
                details: error.message,
            });
        }

        res.status(200).json({
            status: 'success',
            data: movements || [],
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get stock movements by product error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get single stock movement by ID
export const getStockMovementById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Stock movement ID is required',
            });
        }

        const { data: movement, error } = await supabaseAdmin
            .from('stock_movements')
            .select(`
                *,
                product:products(id, sku, name, unit)
            `)
            .eq('id', id)
            .single();

        if (error || !movement) {
            return res.status(404).json({
                status: 'error',
                message: 'Stock movement not found',
            });
        }

        res.status(200).json({
            status: 'success',
            data: movement,
        });
    } catch (error) {
        console.error('Get stock movement error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

