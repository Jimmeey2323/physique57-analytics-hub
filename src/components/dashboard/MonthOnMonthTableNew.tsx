import React, { useMemo, useState, useCallback } from 'react';
import { SalesData, FilterOptions, YearOnYearMetricType } from '@/types/dashboard';
import { ModernTableWrapper, ModernGroupBadge, ModernMetricTabs, STANDARD_METRICS } from './ModernTableWrapper';
import { PersistentTableFooter } from './PersistentTableFooter';
import { formatCurrency, formatNumber, formatPercentage } from '@/utils/formatters';
import { ChevronDown, ChevronRight, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRankingDisplay } from '@/utils/rankingUtils';

interface MonthOnMonthTableNewProps {
  data: SalesData[];
  onRowClick?: (row: any) => void;
  filters?: FilterOptions;
  collapsedGroups?: Set<string>;
  onGroupToggle?: (groups: Set<string>) => void;
  selectedMetric?: YearOnYearMetricType;
  onReady?: () => void;
}

const groupDataByCategory = (data: SalesData[]) => {
  return data.reduce((acc: Record<string, any>, item) => {
    const category = item.cleanedCategory || 'Uncategorized';
    const product = item.cleanedProduct || 'Unspecified';
    if (!acc[category]) {
      acc[category] = {};
    }
    if (!acc[category][product]) {
      acc[category][product] = [];
    }
    acc[category][product].push(item);
    return acc;
  }, {});
};

export const MonthOnMonthTableNew: React.FC<MonthOnMonthTableNewProps> = ({
  data,
  onRowClick,
  filters = {
    dateRange: { start: '', end: '' },
    location: [],
    category: [],
    product: [],
    soldBy: [],
    paymentMethod: []
  },
  collapsedGroups = new Set(),
  onGroupToggle = () => {},
  selectedMetric: initialMetric = 'revenue',
  onReady
}) => {
  const [selectedMetric, setSelectedMetric] = useState<YearOnYearMetricType>(initialMetric);
  const [localCollapsedGroups, setLocalCollapsedGroups] = useState<Set<string>>(new Set());
  const [displayMode, setDisplayMode] = useState<'values' | 'growth'>('values');
  const [sortKey, setSortKey] = useState<string>('total');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  // Keep local collapsed groups in sync if parent provides a controlled Set
  React.useEffect(() => {
    if (!collapsedGroups) return;
    // Compare contents to avoid unnecessary updates
    const isSame = (a: Set<string>, b: Set<string>) => {
      if (a.size !== b.size) return false;
      for (const v of a) if (!b.has(v)) return false;
      return true;
    };
    if (!isSame(localCollapsedGroups, collapsedGroups)) {
      setLocalCollapsedGroups(new Set(collapsedGroups));
    }
  }, [collapsedGroups]);

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
    const uniqueSalesItemIds = new Set(items.map(item => item.salesItemId || item.itemId || item.saleItemId).filter(Boolean));
    const totalUnits = uniqueSalesItemIds.size > 0 ? uniqueSalesItemIds.size : items.length;
    
    const totalDiscountAmount = items.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
    const totalVat = items.reduce((sum, item) => sum + (item.paymentVAT || item.vat || 0), 0);
    const avgDiscountPercentage = items.length > 0 ? 
      items.reduce((sum, item) => sum + (item.discountPercentage || 0), 0) / items.length : 0;
    
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
      case 'discountValue': return totalDiscountAmount;
      case 'discountAmount': return totalDiscountAmount;
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
      case 'discountValue':
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

  const monthlyData = useMemo(() => {
    const months = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Generate last 22 months in descending order (current month back)
    for (let i = 0; i < 22; i++) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthName = monthNames[date.getMonth()];
      months.push({
        key: `${year}-${String(month).padStart(2, '0')}`,
        display: `${monthName} ${year}`,
        year: year,
        month: month,
        quarter: Math.ceil(month / 3)
      });
    }
    return months;
  }, []);

  const processedData = useMemo(() => {
    const grouped = groupDataByCategory(data);
    const categories = Object.entries(grouped).map(([category, products]) => {
      const categoryData = {
        category,
        products: Object.entries(products).map(([product, items]) => {
          const monthlyValues: Record<string, number> = {};

          monthlyData.forEach(({ key, year, month }) => {
            const monthItems = (items as SalesData[]).filter(item => {
              const itemDate = parseDate(item.paymentDate);
              return itemDate && itemDate.getFullYear() === year && itemDate.getMonth() + 1 === month;
            });
            monthlyValues[key] = getMetricValue(monthItems, selectedMetric);
          });

          return {
            product,
            monthlyValues,
            rawData: items,
            totalValue: getMetricValue(items as SalesData[], selectedMetric)
          };
        })
      };

      const categoryMonthlyValues: Record<string, number> = {};
      monthlyData.forEach(({ key, year, month }) => {
        // Compute from raw items to ensure averages (ATV/AUV/ASV/UPT/Discount %) are correct
        const monthItems = (categoryData.products.flatMap(p => p.rawData) as SalesData[]).filter(item => {
          const itemDate = parseDate(item.paymentDate);
          return itemDate && itemDate.getFullYear() === year && itemDate.getMonth() + 1 === month;
        });
        categoryMonthlyValues[key] = getMetricValue(monthItems, selectedMetric);
      });
      
      return {
        ...categoryData,
        monthlyValues: categoryMonthlyValues,
        products: categoryData.products.sort((a, b) => b.totalValue - a.totalValue)
      };
    });
    
    const comparator = (a: any, b: any) => {
      const byMonth = (obj: any, key: string) => obj.monthlyValues?.[key] || 0;
      let av: number, bv: number;
      if (sortKey === 'total') {
        const sumVals = (obj: any): number => {
          const vals = Object.values(obj?.monthlyValues ?? {}) as number[];
          return vals.reduce((sum: number, val: number) => sum + (typeof val === 'number' ? val : Number(val || 0)), 0);
        };
        av = sumVals(a);
        bv = sumVals(b);
      } else {
        av = byMonth(a, sortKey);
        bv = byMonth(b, sortKey);
      }
      return sortDir === 'desc' ? bv - av : av - bv;
    };
    return categories.sort(comparator);
  }, [data, selectedMetric, monthlyData, sortKey, sortDir]);

  const toggleGroup = useCallback((groupKey: string) => {
    setLocalCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      // Inform parent immediately to avoid effect-driven loops
      onGroupToggle?.(newSet);
      return newSet;
    });
  }, [onGroupToggle]);

  const handleCollapseAll = useCallback(() => {
    const allGroups = new Set(processedData.map(item => item.category));
    setLocalCollapsedGroups(allGroups);
    onGroupToggle?.(allGroups);
  }, [processedData, onGroupToggle]);

  // Show the full descending range (current month back to Jan 2024)
  const visibleMonths = useMemo(() => monthlyData, [monthlyData]);

  // Notify parent when ready (once)
  const [readySent, setReadySent] = React.useState(false);
  React.useEffect(() => {
    if (!readySent && processedData.length > 0 && visibleMonths.length > 0) {
      setReadySent(true);
      onReady?.();
    }
  }, [readySent, processedData, visibleMonths, onReady]);

  // Prepare data for AI analysis
  const aiTableData = useMemo(() => {
    const flatData: any[] = [];
    processedData.forEach(categoryGroup => {
      categoryGroup.products.forEach(product => {
        const monthlyEntries = Object.fromEntries(
          // Use the entire range from current month back to Jan 2024
          visibleMonths.map(({ key }) => [
            `month_${key}`, product.monthlyValues[key] || 0
          ])
        );
        
        flatData.push({
          category: categoryGroup.category,
          product: product.product,
          totalValue: product.totalValue,
          totalItems: (product.rawData as SalesData[]).length,
          totalRevenue: (product.rawData as SalesData[]).reduce((sum, item) => sum + (item.paymentValue || 0), 0),
          uniqueMembers: new Set((product.rawData as SalesData[]).map(item => item.memberId)).size,
          ...monthlyEntries
        });
      });
    });
    return flatData;
  }, [processedData, monthlyData, visibleMonths]);

  const aiTableColumns = useMemo(() => {
    const baseColumns = [
      { key: 'category', header: 'Category', type: 'text' as const },
      { key: 'product', header: 'Product', type: 'text' as const },
      { key: 'totalValue', header: `Total ${selectedMetric}`, type: selectedMetric === 'revenue' || selectedMetric === 'atv' || selectedMetric === 'auv' ? 'currency' as const : 'number' as const },
      { key: 'totalItems', header: 'Total Items', type: 'number' as const },
      { key: 'totalRevenue', header: 'Total Revenue', type: 'currency' as const },
      { key: 'uniqueMembers', header: 'Unique Members', type: 'number' as const }
    ];

    const monthColumns = visibleMonths.map(({ key, display }) => ({
      key: `month_${key}`,
      header: display,
      type: selectedMetric === 'revenue' || selectedMetric === 'atv' || selectedMetric === 'auv' ? 'currency' as const : 'number' as const
    }));

    return [...baseColumns, ...monthColumns];
  }, [monthlyData, selectedMetric, visibleMonths]);

  const handleExpandAll = useCallback(() => {
    const empty = new Set<string>();
    setLocalCollapsedGroups(empty);
    onGroupToggle?.(empty);
  }, [onGroupToggle]);

  const getGrowthPercentage = (current: number, previous: number) => {
    if (previous === 0 && current === 0) return null;
    if (previous === 0) return '+100';
    return ((current - previous) / previous * 100).toFixed(1);
  };

  // visibleMonths already defined above

  return (
    <div className="space-y-4">
      {/* Modern Metric Selector */}
      <ModernMetricTabs
        metrics={STANDARD_METRICS}
        selectedMetric={selectedMetric}
        onMetricChange={(metric) => setSelectedMetric(metric as YearOnYearMetricType)}
        className="mb-4"
      />
      <ModernTableWrapper
        title="Month-on-Month Analysis"
        description="Comprehensive monthly performance comparison across categories and products"
        icon={<Calendar className="w-5 h-5 text-white" />}
        totalItems={processedData.reduce((sum, cat) => sum + cat.products.length, 0)}
        collapsedGroups={localCollapsedGroups}
        onCollapseAll={handleCollapseAll}
        onExpandAll={handleExpandAll}
        showDisplayToggle={true}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
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
                    <Calendar className="w-4 h-4 text-white" />
                    <span>Category / Product</span>
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
              {processedData.map((categoryGroup, categoryIndex) => {
                const categoryTotalValue = Object.values(categoryGroup.monthlyValues).reduce((sum, val) => sum + val, 0);
                
                return (
                  <React.Fragment key={categoryGroup.category}>
                    {/* Category Row */}
                    <tr className="group bg-slate-100 border-b border-slate-300 font-semibold hover:bg-slate-200 transition-all duration-200 h-10 max-h-10">
                      <td 
                        className="w-80 px-4 py-2 text-left sticky left-0 bg-slate-100 group-hover:bg-slate-200 border-r border-slate-300 z-20 cursor-pointer transition-all duration-200"
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest('button')) return;
                          
                          onRowClick?.({
                            type: 'category',
                            category: categoryGroup.category,
                            data: categoryGroup.products,
                            metric: selectedMetric,
                            value: categoryTotalValue
                          });
                        }}
                      >
                        <div className="flex items-center space-x-2 min-h-6">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGroup(categoryGroup.category);
                            }} 
                            className="p-1 h-5 w-5 rounded text-slate-600 hover:text-slate-800 hover:bg-white/50 transition-all duration-200 shrink-0"
                          >
                            {localCollapsedGroups.has(categoryGroup.category) ? 
                              <ChevronRight className="w-3 h-3" /> : 
                              <ChevronDown className="w-3 h-3" />
                            }
                          </Button>
                          <div className="flex items-center space-x-2 flex-1">
                            {getRankingDisplay(categoryIndex + 1)}
                            <span className="font-bold text-sm text-slate-800 truncate">{categoryGroup.category}</span>
                          </div>
                          <ModernGroupBadge 
                            count={categoryGroup.products.length} 
                            label="items"
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
                                drillDownContext: 'mom-category-month',
                                filterCriteria: { category: categoryGroup.category, month: key },
                                name: `${categoryGroup.category} (${key})`,
                                category: categoryGroup.category,
                                month: key,
                              });
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
                        >
                          <td className="w-80 px-8 py-2 text-left sticky left-0 bg-white hover:bg-slate-50 border-r border-gray-200 z-10 cursor-pointer transition-all duration-200"
                            onClick={() => {
                              onRowClick?.({
                                drillDownContext: 'mom-product-all',
                                filterCriteria: { product: product.product, category: categoryGroup.category },
                                name: product.product,
                                product: product.product,
                                category: categoryGroup.category,
                              });
                            }}
                          >
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
                                className="px-2 py-2 text-center text-sm font-mono text-slate-700 border-l border-gray-200 hover:bg-orange-100 cursor-pointer transition-all duration-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRowClick?.({
                                    drillDownContext: 'mom-product-month',
                                    filterCriteria: { product: product.product, category: categoryGroup.category, month: key },
                                    name: `${product.product} (${key})`,
                                    product: product.product,
                                    category: categoryGroup.category,
                                    month: key,
                                  });
                                }}
                                title={growthPercentage ? `${growthPercentage}% vs previous month` : ''}
                              >
                                <div className="flex flex-col items-center space-y-0.5 min-h-6 justify-center">
                                  {displayMode === 'values' ? (
                                    <span className="text-xs whitespace-nowrap">{formatMetricValue(current, selectedMetric)}</span>
                                  ) : (
                                    growthPercentage && (
                                      <div className={`flex items-center space-x-1 text-xs ${
                                        parseFloat(growthPercentage) > 0 ? 'text-emerald-500' : 'text-red-400'
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
                      ))
                    }
                  </React.Fragment>
                );
              })}
              
              {/* Totals Row */}
              <tr className="bg-slate-800 text-white font-bold border-t-2 border-slate-400 h-10 max-h-10">
                <td className="w-80 px-4 py-2 text-left sticky left-0 bg-slate-800 border-r border-slate-400 z-20">
                  <div className="flex items-center space-x-2 min-h-6">
                    <span className="font-bold text-sm text-white">TOTALS</span>
                  </div>
                </td>
                
                {visibleMonths.map(({ key, year, month }) => {
                  // Derive from all data in the month so average-type metrics are correct
                  const monthItems = (data as SalesData[]).filter(item => {
                    const itemDate = parseDate(item.paymentDate);
                    return itemDate && itemDate.getFullYear() === year && itemDate.getMonth() + 1 === month;
                  });
                  const totalValue = getMetricValue(monthItems, selectedMetric);
                  
                  return (
                    <td 
                      key={key} 
                      className="px-2 py-2 text-center text-sm font-bold text-white border-l border-slate-400 hover:bg-slate-700 cursor-pointer transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowClick?.({
                          drillDownContext: 'mom-total-month',
                          filterCriteria: { month: key },
                          name: `All Products (${key})`,
                          month: key,
                        });
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
        tableId="month-on-month-analysis"
        initialText="• Monthly performance trends across all product categories • Growth patterns and seasonal variations • Key performance indicators by category and product"
        tableData={aiTableData}
        tableColumns={aiTableColumns}
        tableName="Month-on-Month Performance Analysis"
        tableContext={`Detailed monthly performance tracking by category and product showing ${selectedMetric} trends over ${visibleMonths.length} months`}
      />
    </div>
  );
};