import type { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

// Dashboard overview
export const getDashboard = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.toISOString();
        const todayEnd = new Date(today).setHours(23, 59, 59, 999);
        const todayEndISO = new Date(todayEnd).toISOString();

        // Sales today
        const { data: salesToday, count: salesTodayCount } = await supabaseAdmin
            .from('sales')
            .select('total_amount', { count: 'exact' })
            .gte('sale_date', todayStart)
            .lte('sale_date', todayEndISO);

        const salesTodayTotal = salesToday?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;

        // Low stock products
        const { data: lowStockProducts } = await supabaseAdmin
            .from('products')
            .select(`
                id,
                sku,
                name,
                min_stock_level,
                inventory:inventory(quantity)
            `)
            .eq('is_active', true);

        const lowStock = (lowStockProducts || []).filter(product => {
            const inventory = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
            const stock = inventory?.quantity ?? 0;
            return stock <= (product.min_stock_level || 0);
        });

        // Recent sales (last 5)
        const { data: recentSales } = await supabaseAdmin
            .from('sales')
            .select('id, sale_number, total_amount, sale_date, customer:customers(name)')
            .order('sale_date', { ascending: false })
            .limit(5);

        // Recent purchases (last 5)
        const { data: recentPurchases } = await supabaseAdmin
            .from('purchases')
            .select('id, purchase_number, total_amount, purchase_date, supplier:suppliers(name)')
            .order('purchase_date', { ascending: false })
            .limit(5);

        // Total products
        const { count: totalProducts } = await supabaseAdmin
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        // Total customers
        const { count: totalCustomers } = await supabaseAdmin
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        res.status(200).json({
            status: 'success',
            data: {
                sales_today: {
                    count: salesTodayCount || 0,
                    total: salesTodayTotal,
                },
                low_stock: {
                    count: lowStock.length,
                    products: lowStock.map(p => {
                        const inventory = Array.isArray(p.inventory) ? p.inventory[0] : p.inventory;
                        return {
                            id: p.id,
                            sku: p.sku,
                            name: p.name,
                            current_stock: inventory?.quantity ?? 0,
                            min_stock_level: p.min_stock_level || 0,
                        };
                    }),
                },
                recent_sales: recentSales || [],
                recent_purchases: recentPurchases || [],
                totals: {
                    products: totalProducts || 0,
                    customers: totalCustomers || 0,
                },
            },
        });
    } catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Sales report
export const getSalesReport = async (req: Request, res: Response) => {
    try {
        const { start_date, end_date, group_by } = req.query;
        const groupBy = group_by as string || 'day';

        let dateFilter = supabaseAdmin.from('sales').select('*');

        if (start_date) {
            dateFilter = dateFilter.gte('sale_date', start_date as string);
        }
        if (end_date) {
            dateFilter = dateFilter.lte('sale_date', end_date as string);
        }

        const { data: sales, error } = await dateFilter;

        if (error) {
            return res.status(400).json({
                status: 'error',
                message: 'Failed to fetch sales data',
                details: error.message,
            });
        }

        // Calculate totals
        const totalSales = sales?.length || 0;
        const totalRevenue = sales?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;
        const totalDiscount = sales?.reduce((sum, sale) => sum + (sale.discount_amount || 0), 0) || 0;

        // Group by payment method
        const paymentMethodBreakdown = (sales || []).reduce((acc: Record<string, number>, sale) => {
            const method = sale.payment_method || 'unknown';
            acc[method] = (acc[method] || 0) + (sale.total_amount || 0);
            return acc;
        }, {});

        // Get top products
        const { data: saleItems } = await supabaseAdmin
            .from('sale_items')
            .select(`
                quantity,
                unit_price,
                line_total,
                product:products(id, sku, name)
            `)
            .in('sale_id', sales?.map(s => s.id) || []);

        const productSales = (saleItems || []).reduce((acc: Record<string, any>, item: any) => {
            const product = Array.isArray(item.product) ? item.product[0] : item.product;
            const productId = product?.id;
            if (!productId) return acc;

            if (!acc[productId]) {
                acc[productId] = {
                    product: product,
                    quantity_sold: 0,
                    revenue: 0,
                };
            }
            acc[productId].quantity_sold += item.quantity || 0;
            acc[productId].revenue += item.line_total || 0;
            return acc;
        }, {});

        const topProducts = Object.values(productSales)
            .sort((a: any, b: any) => b.revenue - a.revenue)
            .slice(0, 10);

        res.status(200).json({
            status: 'success',
            data: {
                summary: {
                    total_sales: totalSales,
                    total_revenue: totalRevenue,
                    total_discount: totalDiscount,
                    average_sale: totalSales > 0 ? totalRevenue / totalSales : 0,
                },
                payment_methods: paymentMethodBreakdown,
                top_products: topProducts,
                sales: sales || [],
            },
        });
    } catch (error) {
        console.error('Get sales report error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Inventory report
export const getInventoryReport = async (req: Request, res: Response) => {
    try {
        // Low stock products
        const { data: products } = await supabaseAdmin
            .from('products')
            .select(`
                id,
                sku,
                name,
                category,
                min_stock_level,
                reorder_quantity,
                retail_price,
                inventory:inventory(quantity)
            `)
            .eq('is_active', true);

        const productsWithStock = (products || []).map(product => {
            const inventory = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
            return {
                ...product,
                current_stock: inventory?.quantity ?? 0,
            };
        });

        const lowStock = productsWithStock.filter(p => p.current_stock <= (p.min_stock_level || 0));
        const outOfStock = productsWithStock.filter(p => p.current_stock <= 0);

        // Calculate total stock value
        const totalStockValue = productsWithStock.reduce((sum, product) => {
            return sum + ((product.current_stock || 0) * (product.retail_price || 0));
        }, 0);

        // Stock by category
        const stockByCategory = productsWithStock.reduce((acc: Record<string, any>, product) => {
            const category = product.category || 'Uncategorized';
            if (!acc[category]) {
                acc[category] = {
                    category,
                    product_count: 0,
                    total_quantity: 0,
                    total_value: 0,
                };
            }
            acc[category].product_count += 1;
            acc[category].total_quantity += product.current_stock || 0;
            acc[category].total_value += (product.current_stock || 0) * (product.retail_price || 0);
            return acc;
        }, {});

        res.status(200).json({
            status: 'success',
            data: {
                summary: {
                    total_products: productsWithStock.length,
                    low_stock_count: lowStock.length,
                    out_of_stock_count: outOfStock.length,
                    total_stock_value: totalStockValue,
                },
                low_stock: lowStock.map(p => ({
                    id: p.id,
                    sku: p.sku,
                    name: p.name,
                    category: p.category,
                    current_stock: p.current_stock,
                    min_stock_level: p.min_stock_level || 0,
                    reorder_quantity: p.reorder_quantity || 0,
                })),
                out_of_stock: outOfStock.map(p => ({
                    id: p.id,
                    sku: p.sku,
                    name: p.name,
                    category: p.category,
                })),
                by_category: Object.values(stockByCategory),
            },
        });
    } catch (error) {
        console.error('Get inventory report error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Financial report
export const getFinancialReport = async (req: Request, res: Response) => {
    try {
        const { start_date, end_date } = req.query;

        // Sales revenue
        let salesQuery = supabaseAdmin.from('sales').select('total_amount, discount_amount');
        if (start_date) {
            salesQuery = salesQuery.gte('sale_date', start_date as string);
        }
        if (end_date) {
            salesQuery = salesQuery.lte('sale_date', end_date as string);
        }
        const { data: sales } = await salesQuery;

        const totalRevenue = sales?.reduce((sum, sale) => sum + (sale.total_amount || 0), 0) || 0;
        const totalDiscounts = sales?.reduce((sum, sale) => sum + (sale.discount_amount || 0), 0) || 0;

        // Purchase costs
        let purchasesQuery = supabaseAdmin.from('purchases').select('total_amount');
        if (start_date) {
            purchasesQuery = purchasesQuery.gte('purchase_date', start_date as string);
        }
        if (end_date) {
            purchasesQuery = purchasesQuery.lte('purchase_date', end_date as string);
        }
        const { data: purchases } = await purchasesQuery;

        const totalPurchaseCost = purchases?.reduce((sum, purchase) => sum + (purchase.total_amount || 0), 0) || 0;

        // Expenses
        let expensesQuery = supabaseAdmin.from('expenses').select('amount');
        if (start_date) {
            expensesQuery = expensesQuery.gte('expense_date', start_date as string);
        }
        if (end_date) {
            expensesQuery = expensesQuery.lte('expense_date', end_date as string);
        }
        const { data: expenses } = await expensesQuery;

        const totalExpenses = expenses?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0;

        // Calculate profit
        const grossProfit = totalRevenue - totalPurchaseCost;
        const netProfit = grossProfit - totalExpenses;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // Expenses by category
        const { data: expensesByCategory } = await expensesQuery.select('expense_category, amount');
        const expensesBreakdown = (expensesByCategory || []).reduce((acc: Record<string, number>, expense: any) => {
            const category = expense.expense_category || 'Other';
            acc[category] = (acc[category] || 0) + (expense.amount || 0);
            return acc;
        }, {});

        res.status(200).json({
            status: 'success',
            data: {
                revenue: {
                    total: totalRevenue,
                    discounts: totalDiscounts,
                    net_revenue: totalRevenue - totalDiscounts,
                },
                costs: {
                    purchases: totalPurchaseCost,
                    expenses: totalExpenses,
                    total_costs: totalPurchaseCost + totalExpenses,
                },
                profit: {
                    gross_profit: grossProfit,
                    net_profit: netProfit,
                    profit_margin: profitMargin,
                },
                expenses_by_category: expensesBreakdown,
            },
        });
    } catch (error) {
        console.error('Get financial report error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Product performance report
export const getProductPerformanceReport = async (req: Request, res: Response) => {
    try {
        const { start_date, end_date, limit = 20 } = req.query;

        // Get sales in date range
        let salesQuery = supabaseAdmin.from('sales').select('id');
        if (start_date) {
            salesQuery = salesQuery.gte('sale_date', start_date as string);
        }
        if (end_date) {
            salesQuery = salesQuery.lte('sale_date', end_date as string);
        }
        const { data: sales } = await salesQuery;

        if (!sales || sales.length === 0) {
            return res.status(200).json({
                status: 'success',
                data: {
                    best_sellers: [],
                    slow_movers: [],
                },
            });
        }

        // Get sale items for these sales
        const { data: saleItems } = await supabaseAdmin
            .from('sale_items')
            .select(`
                product_id,
                quantity,
                unit_price,
                line_total,
                product:products(id, sku, name, category, retail_price, purchase_price)
            `)
            .in('sale_id', sales.map(s => s.id));

        // Aggregate by product
        const productStats = (saleItems || []).reduce((acc: Record<string, any>, item: any) => {
            const productId = item.product_id;
            const product = Array.isArray(item.product) ? item.product[0] : item.product;
            if (!productId || !product) return acc;

            if (!acc[productId]) {
                acc[productId] = {
                    product: product,
                    quantity_sold: 0,
                    revenue: 0,
                    cost: 0,
                };
            }
            acc[productId].quantity_sold += item.quantity || 0;
            acc[productId].revenue += item.line_total || 0;
            acc[productId].cost += (item.quantity || 0) * (product.purchase_price || 0);
            return acc;
        }, {});

        // Calculate profit for each product
        const productsWithProfit = Object.values(productStats).map((stat: any) => ({
            ...stat,
            profit: stat.revenue - stat.cost,
            profit_margin: stat.revenue > 0 ? ((stat.revenue - stat.cost) / stat.revenue) * 100 : 0,
        }));

        // Best sellers (by revenue)
        const bestSellers = productsWithProfit
            .sort((a: any, b: any) => b.revenue - a.revenue)
            .slice(0, Number(limit));

        // Best sellers by quantity
        const bestSellersByQuantity = productsWithProfit
            .sort((a: any, b: any) => b.quantity_sold - a.quantity_sold)
            .slice(0, Number(limit));

        // Most profitable
        const mostProfitable = productsWithProfit
            .sort((a: any, b: any) => b.profit - a.profit)
            .slice(0, Number(limit));

        res.status(200).json({
            status: 'success',
            data: {
                best_sellers_by_revenue: bestSellers,
                best_sellers_by_quantity: bestSellersByQuantity,
                most_profitable: mostProfitable,
            },
        });
    } catch (error) {
        console.error('Get product performance report error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

