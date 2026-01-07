import type { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import type { CreateProductInput, UpdateProductInput } from '../types/model.types.js';

// Helper function to get product with inventory quantity
const getProductWithStock = async (productId: string) => {
    const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

    if (productError || !product) {
        return { product: null, error: productError };
    }

    // Get current stock quantity
    const { data: inventory, error: inventoryError } = await supabaseAdmin
        .from('inventory')
        .select('quantity')
        .eq('product_id', productId)
        .single();

    const stockQuantity = inventory?.quantity ?? 0;

    // Add stock quantity as computed field
    return {
        product: {
            ...product,
            stock_quantity: stockQuantity,
        },
        error: null,
    };
};

// Create product
export const createProduct = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const productData: CreateProductInput = req.body;

        // Ensure quantity is not in the request
        if ('quantity' in productData) {
            return res.status(400).json({
                status: 'error',
                message: 'quantity field is not allowed. Stock is managed via stock movements.',
            });
        }

        // Validate price relationships
        if (productData.retail_price < productData.purchase_price) {
            return res.status(400).json({
                status: 'error',
                message: 'retail_price must be greater than or equal to purchase_price',
            });
        }

        if (productData.wholesale_price !== undefined && productData.wholesale_price !== null) {
            if (productData.wholesale_price > productData.retail_price) {
                return res.status(400).json({
                    status: 'error',
                    message: 'wholesale_price must be less than or equal to retail_price',
                });
            }
        }

        // Check for duplicate SKU
        const { data: existingProduct } = await supabaseAdmin
            .from('products')
            .select('id')
            .eq('sku', productData.sku)
            .single();

        if (existingProduct) {
            return res.status(409).json({
                status: 'error',
                message: 'Product with this SKU already exists',
            });
        }

        // Create product
        const { data: product, error: productError } = await supabaseAdmin
            .from('products')
            .insert({
                ...productData,
                is_active: productData.is_active !== undefined ? productData.is_active : true,
            })
            .select()
            .single();

        if (productError || !product) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to create product',
                details: productError?.message || 'Unknown error',
            });
        }

        // Create inventory record with quantity = 0 in a transaction-like manner
        // If inventory creation fails, delete the product (rollback)
        const { error: inventoryError } = await supabaseAdmin
            .from('inventory')
            .insert({
                product_id: product.id,
                quantity: 0,
                updated_by: userId || null,
            });

        if (inventoryError) {
            // Rollback: delete the product
            await supabaseAdmin.from('products').delete().eq('id', product.id);
            return res.status(400).json({
                status: 'error',
                message: 'Failed to create inventory record',
                details: inventoryError.message,
            });
        }

        // Get product with stock quantity
        const { product: productWithStock } = await getProductWithStock(product.id);

        res.status(201).json({
            status: 'success',
            message: 'Product created successfully',
            data: productWithStock,
        });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get all products with filters
export const getProducts = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 50, category, supplier, is_active } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        let query = supabaseAdmin
            .from('products')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + Number(limit) - 1);

        if (category) {
            query = query.eq('category', category);
        }
        if (supplier) {
            query = query.eq('supplier_id', supplier);
        }
        if (is_active !== undefined) {
            query = query.eq('is_active', is_active === 'true');
        }

        const { data: products, error, count } = await query;

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch products',
                details: error.message,
            });
        }

        // Get stock quantities for all products
        const productIds = products?.map((p) => p.id) || [];
        const { data: inventoryData } = await supabaseAdmin
            .from('inventory')
            .select('product_id, quantity')
            .in('product_id', productIds);

        const inventoryMap = new Map(
            inventoryData?.map((inv) => [inv.product_id, inv.quantity]) || []
        );

        // Format products with stock quantity
        const productsWithStock = (products || []).map((product) => ({
            ...product,
            stock_quantity: inventoryMap.get(product.id) ?? 0,
        }));

        res.status(200).json({
            status: 'success',
            data: productsWithStock,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(limit)),
            },
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Get single product by ID
export const getProductById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Product ID is required',
            });
        }

        const { product, error } = await getProductWithStock(id);

        if (error || !product) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found',
            });
        }

        res.status(200).json({
            status: 'success',
            data: product,
        });
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Update product (excluding stock quantity)
export const updateProduct = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData: UpdateProductInput = req.body;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Product ID is required',
            });
        }

        // Ensure quantity is not in the update data
        if ('quantity' in updateData || 'stock_quantity' in updateData) {
            return res.status(400).json({
                status: 'error',
                message: 'quantity field is not allowed. Stock is managed via stock movements.',
            });
        }

        // Check if product exists
        const { data: existingProduct } = await supabaseAdmin
            .from('products')
            .select('id, sku, purchase_price, retail_price, wholesale_price')
            .eq('id', id)
            .single();

        if (!existingProduct) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found',
            });
        }

        // Check for duplicate SKU if SKU is being updated
        if (updateData.sku && updateData.sku !== existingProduct.sku) {
            const { data: duplicateProduct } = await supabaseAdmin
                .from('products')
                .select('id')
                .eq('sku', updateData.sku)
                .single();

            if (duplicateProduct) {
                return res.status(409).json({
                    status: 'error',
                    message: 'Product with this SKU already exists',
                });
            }
        }

        // Validate price relationships
        const purchasePrice = updateData.purchase_price ?? existingProduct.purchase_price;
        const retailPrice = updateData.retail_price ?? existingProduct.retail_price;
        const wholesalePrice = updateData.wholesale_price !== undefined 
            ? updateData.wholesale_price 
            : existingProduct.wholesale_price;

        if (retailPrice < purchasePrice) {
            return res.status(400).json({
                status: 'error',
                message: 'retail_price must be greater than or equal to purchase_price',
            });
        }

        if (wholesalePrice !== null && wholesalePrice !== undefined) {
            if (wholesalePrice > retailPrice) {
                return res.status(400).json({
                    status: 'error',
                    message: 'wholesale_price must be less than or equal to retail_price',
                });
            }
        }

        // Update product
        const { data: product, error } = await supabaseAdmin
            .from('products')
            .update({
                ...updateData,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !product) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to update product',
                details: error?.message || 'Unknown error',
            });
        }

        // Get product with stock quantity
        const { product: productWithStock } = await getProductWithStock(id);

        res.status(200).json({
            status: 'success',
            message: 'Product updated successfully',
            data: productWithStock,
        });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Update product prices only
export const updateProductPrice = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { purchase_price, retail_price, wholesale_price } = req.body;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Product ID is required',
            });
        }

        // Check if product exists
        const { data: existingProduct } = await supabaseAdmin
            .from('products')
            .select('id, purchase_price, retail_price, wholesale_price')
            .eq('id', id)
            .single();

        if (!existingProduct) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found',
            });
        }

        // Use existing prices if not provided
        const finalPurchasePrice = purchase_price ?? existingProduct.purchase_price;
        const finalRetailPrice = retail_price ?? existingProduct.retail_price;
        const finalWholesalePrice = wholesale_price !== undefined 
            ? wholesale_price 
            : existingProduct.wholesale_price;

        // Validate price relationships
        if (finalRetailPrice < finalPurchasePrice) {
            return res.status(400).json({
                status: 'error',
                message: 'retail_price must be greater than or equal to purchase_price',
            });
        }

        if (finalWholesalePrice !== null && finalWholesalePrice !== undefined) {
            if (finalWholesalePrice > finalRetailPrice) {
                return res.status(400).json({
                    status: 'error',
                    message: 'wholesale_price must be less than or equal to retail_price',
                });
            }
        }

        // Update prices
        const updateData: Partial<UpdateProductInput> = {};
        if (purchase_price !== undefined) updateData.purchase_price = purchase_price;
        if (retail_price !== undefined) updateData.retail_price = retail_price;
        if (wholesale_price !== undefined) updateData.wholesale_price = wholesale_price;

        const { data: product, error } = await supabaseAdmin
            .from('products')
            .update({
                ...updateData,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !product) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to update product prices',
                details: error?.message || 'Unknown error',
            });
        }

        // Get product with stock quantity
        const { product: productWithStock } = await getProductWithStock(id);

        res.status(200).json({
            status: 'success',
            message: 'Product prices updated successfully',
            data: productWithStock,
        });
    } catch (error) {
        console.error('Update product price error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Update product status (activate/deactivate)
export const updateProductStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (!id) {
            return res.status(400).json({
                status: 'error',
                message: 'Product ID is required',
            });
        }

        if (typeof is_active !== 'boolean') {
            return res.status(400).json({
                status: 'error',
                message: 'is_active must be a boolean',
            });
        }

        // Check if product exists
        const { data: existingProduct } = await supabaseAdmin
            .from('products')
            .select('id')
            .eq('id', id)
            .single();

        if (!existingProduct) {
            return res.status(404).json({
                status: 'error',
                message: 'Product not found',
            });
        }

        // Update status
        const { data: product, error } = await supabaseAdmin
            .from('products')
            .update({
                is_active,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error || !product) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to update product status',
                details: error?.message || 'Unknown error',
            });
        }

        // Get product with stock quantity
        const { product: productWithStock } = await getProductWithStock(id);

        res.status(200).json({
            status: 'success',
            message: `Product ${is_active ? 'activated' : 'deactivated'} successfully`,
            data: productWithStock,
        });
    } catch (error) {
        console.error('Update product status error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

