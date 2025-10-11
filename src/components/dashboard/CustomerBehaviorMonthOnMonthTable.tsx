import React, { useMemo, useState } from 'react';
import { SalesData } from '@/types/dashboard';
import { ModernMetricTabs, ModernTableWrapper } from './ModernTableWrapper';
import { Activity, Users, ShoppingCart, Clock, Percent, Calendar } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { PersistentTableFooter } from './PersistentTableFooter';

interface Props {
  data: SalesData[]; // Provide data independent of date filters
  onRowClick?: (row: any) => void;
  onReady?: () => void;
}

const BEHAVIOR_METRICS = [
  { key: 'purchaseFrequency', label: 'Purchase Frequency (days)', icon: <Clock className="w-4 h-4" /> },
  { key: 'avgSpend', label: 'Avg Spend per Member', icon: <Activity className="w-4 h-4" /> },
  { key: 'transactions', label: 'Transactions', icon: <ShoppingCart className="w-4 h-4" /> },
  { key: 'discountedTx', label: 'Discounted Transactions', icon: <Activity className="w-4 h-4" /> },
  { key: 'undiscountedTx', label: 'Undiscounted Transactions', icon: <Activity className="w-4 h-4" /> },
  { key: 'percentDiscounted', label: '% Discounted Transactions', icon: <Percent className="w-4 h-4" /> },
  { key: 'usedSessions', label: 'Used Sessions', icon: <Users className="w-4 h-4" /> },
  { key: 'avgSessionsPerMember', label: 'Avg Sessions per Member', icon: <Users className="w-4 h-4" /> },
  { key: 'avgCustomerLifespan', label: 'Avg Customer Lifespan (days)', icon: <Calendar className="w-4 h-4" /> },
  { key: 'avgDaysToSecondPurchase', label: 'Avg Days to Second Purchase', icon: <Clock className="w-4 h-4" /> },
];

export const CustomerBehaviorMonthOnMonthTable: React.FC<Props> = ({ data, onRowClick, onReady }) => {
  const [selectedMetric, setSelectedMetric] = useState<string>('purchaseFrequency');

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const monthKeys = useMemo(() => {
    const months: { key: string; display: string; year: number; month: number }[] = [];
    const now = new Date();
    for (let i = 0; i < 22; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        display: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        year: d.getFullYear(),
        month: d.getMonth() + 1,
      });
    }
    return months;
  }, []);

  const groupData = useMemo(() => {
    const catMap = new Map<string, Map<string, SalesData[]>>();
    data.forEach(item => {
      const cat = item.cleanedCategory || 'Uncategorized';
      const prod = item.cleanedProduct || 'Unspecified';
      if (!catMap.has(cat)) catMap.set(cat, new Map());
      const prodMap = catMap.get(cat)!;
      if (!prodMap.has(prod)) prodMap.set(prod, []);
      prodMap.get(prod)!.push(item);
    });
    return catMap;
  }, [data]);

  const groupByMember = (items: SalesData[]) => {
    const map = new Map<string, SalesData[]>();
    items.forEach(it => {
      const id = it.memberId || it.customerEmail || 'unknown';
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push(it);
    });
    return map;
  };

  const getMetricValue = (items: SalesData[], metric: string) => {
    if (items.length === 0) return 0;
    if (metric === 'transactions') return items.length;
    if (metric === 'discountedTx') return items.filter(it => (it.discountAmount || 0) > 0).length;
    if (metric === 'undiscountedTx') return items.filter(it => (it.discountAmount || 0) <= 0).length;
    if (metric === 'percentDiscounted') {
      const disc = items.filter(it => (it.discountAmount || 0) > 0).length;
      return items.length > 0 ? (disc / items.length) * 100 : 0;
    }
    if (metric === 'usedSessions') return items.reduce((s, it) => s + (it.secMembershipUsedSessions || 0), 0);

    const byMember = groupByMember(items);
    if (metric === 'avgSpend') {
      const spends = Array.from(byMember.values()).map(list => list.reduce((sum, i) => sum + (i.paymentValue || 0), 0));
      return spends.length ? spends.reduce((a, b) => a + b, 0) / spends.length : 0;
    }
    if (metric === 'avgSessionsPerMember') {
      const sessions = Array.from(byMember.values()).map(list => list.reduce((sum, i) => sum + (i.secMembershipUsedSessions || 0), 0));
      return sessions.length ? sessions.reduce((a, b) => a + b, 0) / sessions.length : 0;
    }
    if (metric === 'purchaseFrequency') {
      const freqs: number[] = [];
      byMember.forEach(list => {
        const dates = list.map(l => parseDate(l.paymentDate)).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
        if (dates.length > 1) {
          const totalDays = (dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24);
          freqs.push(totalDays / (dates.length - 1));
        }
      });
      return freqs.length ? freqs.reduce((a, b) => a + b, 0) / freqs.length : 0;
    }
    if (metric === 'avgCustomerLifespan') {
      const spans: number[] = [];
      byMember.forEach(list => {
        const dates = list.map(l => parseDate(l.paymentDate)).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
        if (dates.length > 0) {
          const span = (dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24);
          spans.push(span);
        }
      });
      return spans.length ? spans.reduce((a, b) => a + b, 0) / spans.length : 0;
    }
    if (metric === 'avgDaysToSecondPurchase') {
      const diffs: number[] = [];
      byMember.forEach(list => {
        const dates = list.map(l => parseDate(l.paymentDate)).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
        if (dates.length > 1) {
          const diff = (dates[1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24);
          diffs.push(diff);
        }
      });
      return diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
    }
    return 0;
  };

  const formatValue = (value: number, metric: string) => {
    if (metric === 'avgSpend') return formatCurrency(value);
    if (['purchaseFrequency', 'avgCustomerLifespan', 'avgDaysToSecondPurchase'].includes(metric)) return `${value.toFixed(1)} days`;
    if (metric === 'avgSessionsPerMember') return value.toFixed(1);
    if (metric === 'percentDiscounted') return `${value.toFixed(1)}%`;
    return formatNumber(value);
  };

  const processed = useMemo(() => {
    // Build nested structure: category -> product -> monthly values
    const categories: Array<{ 
      category: string;
      products: Array<{ product: string; monthlyValues: Record<string, number>; rawData: SalesData[]; totalValue: number; }>;
      monthlyValues: Record<string, number>;
    }> = [];

    groupData.forEach((prodMap, category) => {
      const products: Array<{ product: string; monthlyValues: Record<string, number>; rawData: SalesData[]; totalValue: number; }> = [];
      prodMap.forEach((items, product) => {
        const monthlyValues: Record<string, number> = {};
        monthKeys.forEach(({ key, year, month }) => {
          const monthItems = items.filter(it => {
            const d = parseDate(it.paymentDate);
            return d && d.getFullYear() === year && d.getMonth() + 1 === month;
          });
          monthlyValues[key] = getMetricValue(monthItems, selectedMetric);
        });
        products.push({ product, monthlyValues, rawData: items, totalValue: getMetricValue(items, selectedMetric) });
      });

      // Category monthly values derived from raw items across all its products
      const categoryMonthlyValues: Record<string, number> = {};
      monthKeys.forEach(({ key, year, month }) => {
        const monthItems = Array.from(prodMap.values()).flat().filter(it => {
          const d = parseDate(it.paymentDate);
          return d && d.getFullYear() === year && d.getMonth() + 1 === month;
        });
        categoryMonthlyValues[key] = getMetricValue(monthItems, selectedMetric);
      });

      categories.push({
        category,
        products: products.sort((a, b) => b.totalValue - a.totalValue),
        monthlyValues: categoryMonthlyValues,
      });
    });

    return categories.sort((a, b) => {
      const aSum = Object.values(a.monthlyValues).reduce((s, v) => s + v, 0);
      const bSum = Object.values(b.monthlyValues).reduce((s, v) => s + v, 0);
      return bSum - aSum;
    });
  }, [groupData, monthKeys, selectedMetric]);

  React.useEffect(() => {
    if (processed.length) onReady?.();
  }, [processed, onReady]);

  // AI footer data (flattened rows for current metric)
  const aiTableColumns = [
    { header: 'Category', key: 'category', type: 'text' },
    { header: 'Product', key: 'product', type: 'text' },
    { header: 'Month', key: 'month', type: 'text' },
    { header: 'Value', key: 'value', type: 'number' },
  ];
  const aiTableData = useMemo(() => {
    const rows: any[] = [];
    processed.forEach(cat => {
      cat.products.forEach(prod => {
        Object.entries(prod.monthlyValues).forEach(([month, val]) => {
          rows.push({ category: cat.category, product: prod.product, month, value: val });
        });
      });
    });
    return rows;
  }, [processed]);

  return (
    <div className="space-y-4">
      <ModernMetricTabs metrics={BEHAVIOR_METRICS as any} selectedMetric={selectedMetric} onMetricChange={setSelectedMetric} />

      <ModernTableWrapper
        title="Customer Purchase Behavior (All Dates)"
        description="Month-on-month behavior metrics by category and product (ignores date filters)"
        icon={<Activity className="w-5 h-5 text-white" />}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="sticky top-0 z-30">
              <tr className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800">
                <th className="w-96 px-6 py-3 text-left text-white font-bold text-sm uppercase tracking-wide sticky left-0 bg-gradient-to-r from-slate-800 to-slate-900 z-40 border-r border-white/20">
                  Category / Product
                </th>
                {monthKeys.map(({ key, display }) => (
                  <th key={key} className="px-3 py-3 text-center text-white font-bold text-xs uppercase tracking-wider border-l border-white/20 min-w-[90px]">
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold whitespace-nowrap">{display.split(' ')[0]}</span>
                      <span className="text-slate-300 text-xs">{display.split(' ')[1]}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {processed.map(cat => (
                <React.Fragment key={cat.category}>
                  <tr className="bg-slate-100 border-b border-slate-300 font-semibold">
                    <td
                      className="w-96 px-6 py-3 text-left sticky left-0 bg-gradient-to-r from-slate-100 via-blue-50 to-indigo-50 border-r border-slate-300 z-20 cursor-pointer hover:underline"
                      onClick={() =>
                        onRowClick?.({
                          category: cat.category,
                          name: cat.category,
                          filterCriteria: { category: cat.category },
                          drillDownContext: {
                            source: 'customerBehavior',
                            level: 'category',
                            metric: selectedMetric,
                            category: cat.category,
                          },
                        })
                      }
                      title={`View all transactions for ${cat.category}`}
                    >
                      <span className="text-slate-800 font-bold">{cat.category}</span>
                    </td>
                    {monthKeys.map(({ key }) => (
                      <td
                        key={key}
                        className="px-2 py-2 text-center text-sm font-bold text-slate-800 border-l border-slate-300 cursor-pointer hover:bg-blue-100/60"
                        onClick={() =>
                          onRowClick?.({
                            category: cat.category,
                            name: cat.category,
                            filterCriteria: { month: key, category: cat.category },
                            drillDownContext: {
                              source: 'customerBehavior',
                              level: 'category',
                              metric: selectedMetric,
                              category: cat.category,
                              month: key,
                            },
                          })
                        }
                        title={`View ${cat.category} transactions for ${key}`}
                      >
                        {formatValue(cat.monthlyValues[key] || 0, selectedMetric)}
                      </td>
                    ))}
                  </tr>
                  {cat.products.map(prod => (
                    <tr key={`${cat.category}-${prod.product}`} className="bg-white hover:bg-blue-50 border-b border-gray-200 transition-all">
                      <td
                        className="w-96 px-10 py-2 text-left sticky left-0 bg-white border-r border-gray-200 z-10 cursor-pointer hover:underline"
                        onClick={() =>
                          onRowClick?.({
                            product: prod.product,
                            name: prod.product,
                            filterCriteria: { product: prod.product },
                            drillDownContext: {
                              source: 'customerBehavior',
                              level: 'product',
                              metric: selectedMetric,
                              category: cat.category,
                              product: prod.product,
                            },
                          })
                        }
                        title={`View all transactions for ${prod.product}`}
                      >
                        <span className="text-slate-700 font-medium">{prod.product}</span>
                      </td>
                      {monthKeys.map(({ key }) => (
                        <td
                          key={key}
                          className="px-2 py-2 text-center text-sm font-mono text-slate-700 border-l border-gray-200 cursor-pointer hover:bg-blue-100/60"
                          onClick={() =>
                            onRowClick?.({
                              product: prod.product,
                              name: prod.product,
                              filterCriteria: { month: key, product: prod.product },
                              drillDownContext: {
                                source: 'customerBehavior',
                                level: 'product',
                                metric: selectedMetric,
                                category: cat.category,
                                product: prod.product,
                                month: key,
                              },
                            })
                          }
                          title={`View ${prod.product} transactions for ${key}`}
                        >
                          {formatValue(prod.monthlyValues[key] || 0, selectedMetric)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}

              {/* Totals row across all categories/products per month */}
              <tr className="bg-slate-800 text-white font-bold border-t-2 border-slate-400">
                <td
                  className="w-96 px-6 py-2 text-left sticky left-0 bg-slate-800 border-r border-slate-400 z-20 cursor-pointer hover:underline"
                  onClick={() =>
                    onRowClick?.({
                      name: 'TOTALS',
                      filterCriteria: {},
                      drillDownContext: {
                        source: 'customerBehavior',
                        level: 'total',
                        metric: selectedMetric,
                      },
                    })
                  }
                  title="View all transactions across all months"
                >
                  TOTALS
                </td>
                {monthKeys.map(({ key, year, month }) => {
                  const monthItems = data.filter(it => {
                    const d = parseDate(it.paymentDate);
                    return d && d.getFullYear() === year && d.getMonth() + 1 === month;
                  });
                  const totalVal = getMetricValue(monthItems, selectedMetric);
                  return (
                    <td
                      key={key}
                      className="px-2 py-2 text-center text-sm font-bold text-white border-l border-slate-400 cursor-pointer hover:bg-slate-700/60"
                      onClick={() =>
                        onRowClick?.({
                          name: 'TOTALS',
                          filterCriteria: { month: key },
                          drillDownContext: {
                            source: 'customerBehavior',
                            level: 'total',
                            metric: selectedMetric,
                            month: key,
                          },
                        })
                      }
                      title={`View all transactions for ${key}`}
                    >
                      {formatValue(totalVal, selectedMetric)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </ModernTableWrapper>

      <PersistentTableFooter
        tableId="customer-behavior-mom"
        initialText="• Behavior insights across all dates (location context may still apply)\n• Metrics include purchase frequency, spends, sessions usage, and discount patterns\n• Use the export for AI-driven summaries and trends"
        tableName="Customer Behavior (MoM)"
        tableContext={`Behavior metric: ${BEHAVIOR_METRICS.find(m => m.key === selectedMetric)?.label}`}
        tableData={aiTableData}
        tableColumns={aiTableColumns as any}
      />
    </div>
  );
};
