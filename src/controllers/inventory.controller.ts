import type { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

// Get all inventory with filters
export const getInventory = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 50, low_stock, out_of_stock, category, search } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        // Build query for products with inventory
        let productsQuery = supabaseAdmin
            .from('products')
            .select(`
                id,
                sku,
                name,
                category,
                unit,
                retail_price,
                wholesale_price,
                min_stock_level,
                reorder_quantity,
                is_active,
                inventory:inventory(quantity, last_updated, updated_by)
            `, { count: 'exact' })
            .eq('is_active', true)
            .order('name', { ascending: true })
            .range(offset, offset + Number(limit) - 1);

        if (category) {
            productsQuery = productsQuery.eq('category', category);
        }
        if (search) {
            productsQuery = productsQuery.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
        }

        const { data: products, error, count } = await productsQuery;

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch inventory',
                details: error.message,
            });
        }

        // Process products and add stock information
        let inventoryItems = (products || []).map((product: any) => {
            const inventory = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
            const stock = inventory?.quantity ?? 0;
            const stockValue = stock * (product.retail_price || 0);

            return {
                product_id: product.id,
                sku: product.sku,
                name: product.name,
                category: product.category,
                unit: product.unit,
                retail_price: product.retail_price,
                wholesale_price: product.wholesale_price,
                min_stock_level: product.min_stock_level || 0,
                reorder_quantity: product.reorder_quantity || 0,
                quantity: stock,
                stock_value: stockValue,
                is_low_stock: stock <= (product.min_stock_level || 0),
                is_out_of_stock: stock <= 0,
                last_updated: inventory?.last_updated || null,
                updated_by: inventory?.updated_by || null,
            };
        });

        // Apply stock filters
        if (low_stock === 'true') {
            inventoryItems = inventoryItems.filter(item => item.is_low_stock);
        }
        if (out_of_stock === 'true') {
            inventoryItems = inventoryItems.filter(item => item.is_out_of_stock);
        }

        res.status(200).json({
            status: 'success',
            data: inventoryItems,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get inventory for specific product
export const getInventoryByProduct = async (req: Request, res: Response) => {
    try {
        const { product_id } = req.params;

        if (!product_id) {
            return res.status(400).json({
                status: 'error',
                message: 'Product ID is required',
            });
        }

        // Get product with inventory
        const { data: product, error: productError } = await supabaseAdmin
            .from('products')
            .select(`
                id,
                sku,
                name,
                category,
                unit,
                retail_price,
                wholesale_price,
                min_stock_level,
                reorder_quantity,
                is_active,
                inventory:inventory(quantity, last_updated, updated_by)
            `)
            .eq('id', product_id)
            .single();

        if (productError || !product) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found',
            });
        }

        const inventory = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
        const stock = inventory?.quantity ?? 0;
        const stockValue = stock * (product.retail_price || 0);

        const inventoryData = {
            product_id: product.id,
            sku: product.sku,
            name: product.name,
            category: product.category,
            unit: product.unit,
            retail_price: product.retail_price,
            wholesale_price: product.wholesale_price,
            min_stock_level: product.min_stock_level || 0,
            reorder_quantity: product.reorder_quantity || 0,
            quantity: stock,
            stock_value: stockValue,
            is_low_stock: stock <= (product.min_stock_level || 0),
            is_out_of_stock: stock <= 0,
            last_updated: inventory?.last_updated || null,
            updated_by: inventory?.updated_by || null,
        };

        res.status(200).json({
            status: 'success',
            data: inventoryData,
        });
    } catch (error) {
        console.error('Get inventory by product error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get low stock products
export const getLowStockInventory = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        // Get all products with inventory
        const { data: products, error, count } = await supabaseAdmin
            .from('products')
            .select(`
                id,
                sku,
                name,
                category,
                unit,
                retail_price,
                min_stock_level,
                reorder_quantity,
                inventory:inventory(quantity)
            `, { count: 'exact' })
            .eq('is_active', true)
            .order('name', { ascending: true })
            .range(offset, offset + Number(limit) - 1);

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch inventory',
                details: error.message,
            });
        }

        // Filter low stock products
        const lowStockItems = (products || [])
            .map((product: any) => {
                const inventory = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
                const stock = inventory?.quantity ?? 0;
                return {
                    product_id: product.id,
                    sku: product.sku,
                    name: product.name,
                    category: product.category,
                    unit: product.unit,
                    retail_price: product.retail_price,
                    min_stock_level: product.min_stock_level || 0,
                    reorder_quantity: product.reorder_quantity || 0,
                    quantity: stock,
                    stock_value: stock * (product.retail_price || 0),
                };
            })
            .filter(item => item.quantity <= item.min_stock_level);

        res.status(200).json({
            status: 'success',
            data: lowStockItems,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: lowStockItems.length,
                totalPages: Math.ceil(lowStockItems.length / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get low stock inventory error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get inventory value summary
export const getInventoryValue = async (req: Request, res: Response) => {
    try {
        const { category } = req.query;

        // Get all products with inventory
        let productsQuery = supabaseAdmin
            .from('products')
            .select(`
                id,
                category,
                retail_price,
                wholesale_price,
                inventory:inventory(quantity)
            `)
            .eq('is_active', true);

        if (category) {
            productsQuery = productsQuery.eq('category', category);
        }

        const { data: products, error } = await productsQuery;

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch inventory',
                details: error.message,
            });
        }

        // Calculate totals
        let totalRetailValue = 0;
        let totalWholesaleValue = 0;
        let totalQuantity = 0;
        const categoryBreakdown: Record<string, any> = {};

        (products || []).forEach((product: any) => {
            const inventory = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
            const stock = inventory?.quantity ?? 0;
            const retailValue = stock * (product.retail_price || 0);
            const wholesaleValue = stock * (product.wholesale_price || 0);

            totalRetailValue += retailValue;
            totalWholesaleValue += wholesaleValue;
            totalQuantity += stock;

            // Category breakdown
            const cat = product.category || 'Uncategorized';
            if (!categoryBreakdown[cat]) {
                categoryBreakdown[cat] = {
                    category: cat,
                    quantity: 0,
                    retail_value: 0,
                    wholesale_value: 0,
                };
            }
            categoryBreakdown[cat].quantity += stock;
            categoryBreakdown[cat].retail_value += retailValue;
            categoryBreakdown[cat].wholesale_value += wholesaleValue;
        });

        res.status(200).json({
            status: 'success',
            data: {
                summary: {
                    total_quantity: totalQuantity,
                    total_retail_value: totalRetailValue,
                    total_wholesale_value: totalWholesaleValue,
                    product_count: products?.length || 0,
                },
                by_category: Object.values(categoryBreakdown),
            },
        });
    } catch (error) {
        console.error('Get inventory value error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

