import React, { useMemo, useState, useCallback, useRef } from 'react';
import { SalesData, YearOnYearMetricType } from '@/types/dashboard';
import { ModernTableWrapper, ModernGroupBadge, ModernMetricTabs, STANDARD_METRICS } from './ModernTableWrapper';
import { PersistentTableFooter } from './PersistentTableFooter';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { ChevronDown, ChevronRight, ShoppingCart, TrendingUp, TrendingDown, BarChart3, DollarSign, Users, Target, Trophy, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRankingDisplay } from '@/utils/rankingUtils';
import { generateStandardMonthRange } from '@/utils/dateUtils';

interface ProductPerformanceTableNewProps {
  data: SalesData[];
  onRowClick: (row: any) => void;
  selectedMetric?: YearOnYearMetricType;
  onReady?: () => void;
}

export const ProductPerformanceTableNew: React.FC<ProductPerformanceTableNewProps> = ({
  data,
  onRowClick,
  selectedMetric: initialMetric = 'revenue',
  onReady
}) => {
  const [selectedMetric, setSelectedMetric] = useState<YearOnYearMetricType>(initialMetric);
  const tableRef = useRef<HTMLTableElement>(null);
  const [localCollapsedGroups, setLocalCollapsedGroups] = useState<Set<string>>(new Set());
  const [displayMode, setDisplayMode] = useState<'values' | 'growth'>('values');
  const [sortKey, setSortKey] = useState<string>('total');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  const getMetricValue = (items: SalesData[], metric: YearOnYearMetricType) => {
    if (!items.length) return 0;
    const totalRevenue = items.reduce((sum, item) => sum + (item.paymentValue || 0), 0);
    
    // Transactions = unique count of payment transaction ID
    const uniqueTransactionIds = new Set(items.map(item => item.paymentTransactionId || item.transactionId).filter(Boolean));
    const totalTransactions = uniqueTransactionIds.size > 0 ? uniqueTransactionIds.size : items.length;
    
    // Members = unique count of member ID
    const uniqueMembers = new Set(items.map(item => item.memberId).filter(Boolean)).size;
    
    // Units Sold = unique count of sales item ID
    const uniqueSalesItemIds = new Set(items.map(item => item.salesItemId || item.itemId).filter(Boolean));
    const totalUnits = uniqueSalesItemIds.size > 0 ? uniqueSalesItemIds.size : items.length;
    
    // VAT and Discount
    const totalVat = items.reduce((sum, item) => sum + (item.paymentVAT || item.vat || 0), 0);
    const totalDiscount = items.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    
    // Calculate average discount percentage
    const itemsWithDiscount = items.filter(item => (item.discountAmount || 0) > 0);
    const avgDiscountPercentage = itemsWithDiscount.length > 0
      ? itemsWithDiscount.reduce((sum, item) => sum + (item.discountPercentage || 0), 0) / itemsWithDiscount.length
      : 0;
    
    // Purchase Frequency in Days
    const dates = items.map(item => {
      const dateStr = item.paymentDate;
      if (!dateStr) return null;
      const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (ddmmyyyy) {
        const [, day, month, year] = ddmmyyyy;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      return new Date(dateStr);
    }).filter((date): date is Date => date !== null && !isNaN(date.getTime())).sort((a, b) => a.getTime() - b.getTime());
    
    let purchaseFrequency = 0;
    if (dates.length > 1) {
      const totalDays = (dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24);
      purchaseFrequency = totalDays / (dates.length - 1);
    }

    switch (metric) {
      case 'revenue': return totalRevenue;
      case 'transactions': return totalTransactions;
      case 'members': return uniqueMembers;
      case 'units': return totalUnits;
      case 'atv': return totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
      case 'auv': return uniqueMembers > 0 ? totalRevenue / uniqueMembers : 0;
      case 'asv': return uniqueMembers > 0 ? totalRevenue / uniqueMembers : 0; // ASV = Gross Sales / Unique Members
      case 'upt': return totalTransactions > 0 ? totalUnits / totalTransactions : 0;
      case 'vat': return totalVat;
      case 'discountAmount': return totalDiscount;
      case 'discountPercentage': return avgDiscountPercentage;
      case 'purchaseFrequency': return purchaseFrequency;
      default: return 0;
    }
  };

  const formatMetricValue = (value: number, metric: YearOnYearMetricType) => {
    switch (metric) {
      case 'revenue':
      case 'auv':
      case 'atv':
      case 'asv':
      case 'vat':
      case 'discountAmount':
        return formatCurrency(value);
      case 'transactions':
      case 'members':
      case 'units':
        return formatNumber(value);
      case 'upt':
        return value.toFixed(2);
      case 'discountPercentage':
        return `${value.toFixed(1)}%`;
      case 'purchaseFrequency':
        return `${value.toFixed(1)} days`;
      default:
        return formatNumber(value);
    }
  };

  // Use standard 22-month range (October 2025 to January 2024)
  const monthlyData = useMemo(() => generateStandardMonthRange(), []);
  // generateStandardMonthRange returns oldest -> newest; use full range reversed (newest -> oldest)
  const visibleMonths = useMemo(() => [...monthlyData].reverse(), [monthlyData]);

  const processedData = useMemo(() => {
    // Group by category and product
    const categoryGroups = data.reduce((acc: Record<string, Record<string, SalesData[]>>, item) => {
      const category = item.cleanedCategory || 'Uncategorized';
      const product = item.cleanedProduct || 'Unknown';
      
      if (!acc[category]) {
        acc[category] = {};
      }
      if (!acc[category][product]) {
        acc[category][product] = [];
      }
      acc[category][product].push(item);
      return acc;
    }, {});

  const categoryData = Object.entries(categoryGroups).map(([category, products]) => {
      const productData = Object.entries(products).map(([product, items]) => {
        const monthlyValues: Record<string, number> = {};
        
        monthlyData.forEach(({ key, year, month }) => {
          const monthItems = items.filter(item => {
            const itemDate = parseDate(item.paymentDate);
            return itemDate && itemDate.getFullYear() === year && itemDate.getMonth() + 1 === month;
          });
          monthlyValues[key] = getMetricValue(monthItems, selectedMetric);
        });

        return {
          product,
          monthlyValues,
          totalValue: getMetricValue(items, selectedMetric),
          totalRevenue: items.reduce((sum, item) => sum + (item.paymentValue || 0), 0),
          totalTransactions: items.length,
          uniqueMembers: new Set(items.map(item => item.memberId)).size,
          rawData: items
        };
      });

      // Calculate category totals
      const categoryMonthlyValues: Record<string, number> = {};
      monthlyData.forEach(({ key }) => {
        categoryMonthlyValues[key] = productData.reduce((sum, p) => sum + (p.monthlyValues[key] || 0), 0);
      });

      const sortedProducts = productData.sort((a, b) => {
        const byMonth = (obj: any, key: string) => obj.monthlyValues?.[key] || 0;
        let av: number, bv: number;
        if (sortKey === 'total') { av = a.totalValue; bv = b.totalValue; }
        else { av = byMonth(a, sortKey); bv = byMonth(b, sortKey); }
        return sortDir === 'desc' ? bv - av : av - bv;
      });
      return {
        category,
        products: sortedProducts,
        monthlyValues: categoryMonthlyValues,
        totalValue: productData.reduce((sum, p) => sum + p.totalValue, 0)
      };
    });

    const comparator = (a: any, b: any) => {
      const byMonth = (obj: any, key: string) => obj.monthlyValues?.[key] || 0;
      let av: number, bv: number;
      if (sortKey === 'total') { av = a.totalValue; bv = b.totalValue; }
      else { av = byMonth(a, sortKey); bv = byMonth(b, sortKey); }
      return sortDir === 'desc' ? bv - av : av - bv;
    };
    return categoryData.sort(comparator);
  }, [data, selectedMetric, monthlyData, sortKey, sortDir]);

  // Notify parent when heavy computation is ready
  const [readySent, setReadySent] = React.useState(false);
  React.useEffect(() => {
    // consider processedData ready when categories present and months computed
    if (!readySent && processedData.length > 0 && visibleMonths.length > 0) {
      setReadySent(true);
      onReady?.();
    }
  }, [readySent, processedData, visibleMonths, onReady]);

  const toggleGroup = useCallback((groupKey: string) => {
    setLocalCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  }, []);

  const handleCollapseAll = useCallback(() => {
    const allGroups = new Set(processedData.map(item => item.category));
    setLocalCollapsedGroups(allGroups);
  }, [processedData]);

  const handleExpandAll = useCallback(() => {
    setLocalCollapsedGroups(new Set());
  }, []);

  const getGrowthPercentage = (current: number, previous: number) => {
    if (previous === 0 && current === 0) return null;
    if (previous === 0) return '+100';
    return ((current - previous) / previous * 100).toFixed(1);
  };



  return (
    <div className="space-y-6">
      {/* Modern Metric Selector */}
      <ModernMetricTabs
        metrics={STANDARD_METRICS}
        selectedMetric={selectedMetric}
        onMetricChange={(metric) => setSelectedMetric(metric as YearOnYearMetricType)}
      />

      <ModernTableWrapper
        title="Product Performance Analysis"
        description="Detailed performance metrics for all products across categories and timeframes"
        icon={<Trophy className="w-6 h-6 text-white" />}
        totalItems={processedData.reduce((sum, cat) => sum + cat.products.length, 0)}
        collapsedGroups={localCollapsedGroups}
        onCollapseAll={handleCollapseAll}
        onExpandAll={handleExpandAll}
        showDisplayToggle={true}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        className="animate-in slide-in-from-bottom-8 fade-in duration-1000"
        tableRef={tableRef}
        showCopyButton={true}
      >
        <div className="overflow-x-auto">
          <table ref={tableRef} className="min-w-full bg-white">
            <thead className="sticky top-0 z-30">
              <tr className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800">
                <th
                  className="w-80 px-6 py-3 text-left text-white font-bold text-sm uppercase tracking-wide sticky left-0 bg-gradient-to-r from-slate-800 to-slate-900 z-40 border-r border-white/20 cursor-pointer select-none"
                  onClick={() => {
                    if (sortKey !== 'total') { setSortKey('total'); setSortDir('desc'); }
                    else setSortDir(d => d === 'desc' ? 'asc' : 'desc');
                  }}
                  title={`Sort by total (${sortDir})`}
                >
                  <div className="flex items-center space-x-2">
                    <ShoppingCart className="w-4 h-4 text-white" />
                    <span>Product</span>
                  </div>
                </th>
                
                                {visibleMonths.map(({ key, display }) => (
                  <th
                    key={key}
                    className="px-3 py-3 text-center text-white font-bold text-xs uppercase tracking-wider border-l border-white/20 min-w-[90px] cursor-pointer select-none"
                    onClick={() => {
                      if (sortKey !== key) { setSortKey(key); setSortDir('desc'); }
                      else setSortDir(d => d === 'desc' ? 'asc' : 'desc');
                    }}
                    title={`Sort by ${display} (${sortDir})`}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold whitespace-nowrap">{display.split(' ')[0]}</span>
                      <span className="text-slate-300 text-xs">{display.split(' ')[1]}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {processedData.map((categoryGroup, categoryIndex) => (
                <React.Fragment key={categoryGroup.category}>
                  {/* Category Row */}
                  <tr 
                    className="group bg-slate-100 border-b border-slate-300 font-semibold hover:bg-slate-200 transition-all duration-200 h-10 max-h-10 cursor-pointer"
                    onClick={() => onRowClick?.({
                      drillDownContext: 'product-category-total',
                      filterCriteria: { category: categoryGroup.category },
                      name: `${categoryGroup.category} (Total)`,
                      category: categoryGroup.category,
                      rawData: categoryGroup.products.flatMap(p => p.rawData),
                      isGroup: true,
                    })}
                  >
                    <td 
                      className="w-80 px-8 py-4 text-left sticky left-0 bg-gradient-to-r from-orange-100 via-red-50 to-pink-50 group-hover:from-orange-200 group-hover:via-red-100 group-hover:to-pink-100 border-r border-orange-300 z-20 transition-all duration-300 shadow-sm"
                    >
                      <div className="flex items-center space-x-4">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGroup(categoryGroup.category);
                          }} 
                          className="p-2 h-8 w-8 rounded-full text-orange-600 hover:text-orange-800 hover:bg-white/50 transition-all duration-200"
                        >
                          {localCollapsedGroups.has(categoryGroup.category) ? 
                            <ChevronRight className="w-5 h-5" /> : 
                            <ChevronDown className="w-5 h-5" />
                          }
                        </Button>
                        <span className="font-bold text-lg text-orange-800">#{categoryIndex + 1} {categoryGroup.category}</span>
                        <ModernGroupBadge 
                          count={categoryGroup.products.length} 
                          label="products" 
                          variant="warning"
                        />
                      </div>
                    </td>
                    
                    {visibleMonths.map(({ key }, monthIndex) => {
                      const current = categoryGroup.monthlyValues[key] || 0;
                      const previousMonthKey = visibleMonths[monthIndex + 1]?.key;
                      const previous = previousMonthKey ? (categoryGroup.monthlyValues[previousMonthKey] || 0) : 0;
                      const growthPercentage = monthIndex < visibleMonths.length - 1 ? getGrowthPercentage(current, previous) : null;
                      
                      return (
                        <td 
                          key={key} 
                          className="px-2 py-2 text-center text-sm font-bold text-slate-800 border-l border-slate-300 hover:bg-orange-100/50 cursor-pointer transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRowClick?.({
                              drillDownContext: 'product-category-month',
                              filterCriteria: { category: categoryGroup.category, month: key },
                              name: `${categoryGroup.category} (${key})`,
                              category: categoryGroup.category,
                              month: key,
                            })
                          }}
                          title={growthPercentage ? `${growthPercentage}% vs previous month` : ''}
                        >
                          <div className="flex flex-col items-center space-y-0.5 min-h-6 justify-center">
                            {displayMode === 'values' ? (
                              <span className="font-mono text-xs whitespace-nowrap">{formatMetricValue(current, selectedMetric)}</span>
                            ) : (
                              growthPercentage && (
                                <div className={`flex items-center space-x-1 text-xs ${
                                  parseFloat(growthPercentage) > 0 ? 'text-emerald-600' : 'text-red-500'
                                }`}>
                                  {parseFloat(growthPercentage) > 0 ? 
                                    <TrendingUp className="w-2 h-2" /> : 
                                    <TrendingDown className="w-2 h-2" />
                                  }
                                  <span className="font-mono">{Math.abs(parseFloat(growthPercentage))}%</span>
                                </div>
                              )
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Product Rows */}
                  {!localCollapsedGroups.has(categoryGroup.category) && 
                    categoryGroup.products.map((product, productIndex) => (
                      <tr 
                        key={`${categoryGroup.category}-${product.product}`}
                        className="bg-white hover:bg-slate-50 border-b border-gray-200 transition-all duration-200 h-10 max-h-10"
                        onClick={() => onRowClick?.({
                          ...product,
                          contextType: 'product',
                          category: categoryGroup.category,
                          drillDownContext: 'product-performance',
                          filterCriteria: {
                            product: product.product,
                            category: categoryGroup.category
                          }
                        })}
                      >
                        <td className="w-80 px-8 py-2 text-left sticky left-0 bg-white hover:bg-slate-50 border-r border-gray-200 z-10 cursor-pointer transition-all duration-200">
                          <div className="flex items-center space-x-2 min-h-6">
                            <div className="shrink-0">{getRankingDisplay(productIndex + 1)}</div>
                            <span className="text-slate-700 font-medium text-sm truncate">{product.product}</span>
                          </div>
                        </td>
                        
                        {visibleMonths.map(({ key }, monthIndex) => {
                          const current = product.monthlyValues[key] || 0;
                          const previousMonthKey = visibleMonths[monthIndex + 1]?.key;
                          const previous = previousMonthKey ? (product.monthlyValues[previousMonthKey] || 0) : 0;
                          const growthPercentage = monthIndex < visibleMonths.length - 1 ? getGrowthPercentage(current, previous) : null;
                          
                          return (
                            <td 
                              key={key} 
                              className="px-6 py-3 text-center text-sm font-mono text-slate-700 border-l border-gray-200 hover:bg-orange-100 cursor-pointer transition-all duration-300"
                              title={growthPercentage ? `${growthPercentage}% vs previous month` : ''}
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent row click
                                console.log('🎯 CELL CLICKED:', {
                                  productName: product.product,
                                  monthKey: key,
                                  value: current,
                                  category: categoryGroup.category
                                });
                                onRowClick?.({
                                  ...product,
                                  contextType: 'product-month',
                                  category: categoryGroup.category,
                                  month: key,
                                  monthValue: current,
                                  drillDownContext: 'product-month-performance',
                                  filterCriteria: {
                                    product: product.product,
                                    category: categoryGroup.category,
                                    month: key,
                                    specificValue: current
                                  }
                                });
                              }}
                            >
                              <div className="flex flex-col items-center space-y-1">
                                {displayMode === 'values' ? (
                                  <span>{formatMetricValue(current, selectedMetric)}</span>
                                ) : (
                                  growthPercentage && (
                                    <div className={`flex items-center space-x-1 text-xs ${
                                      parseFloat(growthPercentage) > 0 ? 'text-emerald-500' : 'text-red-400'
                                    }`}>
                                      {parseFloat(growthPercentage) > 0 ? 
                                        <TrendingUp className="w-3 h-3" /> : 
                                        <TrendingDown className="w-3 h-3" />
                                      }
                                      <span>{Math.abs(parseFloat(growthPercentage))}%</span>
                                    </div>
                                  )
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  }
                </React.Fragment>
              ))}
              
              {/* Totals Row */}
              <tr 
                className="bg-slate-800 text-white font-bold border-t-2 border-slate-400 h-10 max-h-10 cursor-pointer hover:bg-slate-700"
                onClick={() => onRowClick?.({
                  drillDownContext: 'product-grand-total',
                  filterCriteria: {},
                  name: 'Grand Total (All Products)',
                  rawData: data,
                  isGroup: true,
                })}
              >
                <td className="w-80 px-4 py-2 text-left sticky left-0 bg-slate-800 group-hover:bg-slate-700 border-r border-slate-400 z-20">
                  <div className="flex items-center space-x-2 min-h-6">
                    <span className="font-bold text-sm text-white">TOTALS</span>
                  </div>
                </td>
                
                {visibleMonths.map(({ key }) => {
                  const totalValue = processedData.reduce((sum, categoryGroup) => {
                    return sum + (categoryGroup.monthlyValues[key] || 0);
                  }, 0);
                  
                  return (
                    <td 
                      key={key} 
                      className="px-2 py-2 text-center text-sm font-bold text-white border-l border-slate-400 group-hover:bg-slate-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowClick?.({
                          drillDownContext: 'product-total-month',
                          filterCriteria: { month: key },
                          name: `Grand Total (${key})`,
                          month: key,
                        })
                      }}
                    >
                      <div className="flex flex-col items-center space-y-0.5 min-h-6 justify-center">
                        <span className="font-mono text-xs whitespace-nowrap">{formatMetricValue(totalValue, selectedMetric)}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </ModernTableWrapper>
      
      {/* Persistent Footer */}
      <PersistentTableFooter
        tableId="product-performance-analysis"
        initialText="• Top performing products by revenue, transactions, and member engagement\n• Monthly trends showing seasonal patterns and growth opportunities\n• Category performance comparison with detailed product breakdown"
        className="animate-in slide-in-from-bottom-4 fade-in duration-1000 delay-300"
      />
    </div>
  );
};