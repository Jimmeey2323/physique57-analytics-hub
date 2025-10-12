import { useMemo } from 'react';
import { SalesData } from '@/types/dashboard';
import { parseDate } from '@/utils/dateUtils';
import { formatCurrency, formatNumber, formatPercentage } from '@/utils/formatters';

type Trend = 'strong' | 'moderate' | 'weak';

export interface DiscountMetric {
  title: string;
  value: string;
  rawValue: number;
  change: number; // percent
  changeDetails: { rate: number; isSignificant: boolean; trend: Trend };
  previousValue: string;
  previousRawValue: number;
  periodLabel?: string;
  icon: string;
  description: string;
}

interface Options {
  dateRange?: { start?: string | Date; end?: string | Date };
}

const num = (v: any): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

const calcGrowth = (current: number, previous: number) => {
  if (previous === 0) return { rate: current > 0 ? 100 : 0, isSignificant: current > 0, trend: current > 0 ? 'moderate' as Trend : 'weak' as Trend };
  const rate = ((current - previous) / previous) * 100;
  const mag = Math.abs(rate);
  const trend: Trend = mag > 20 ? 'strong' : mag > 5 ? 'moderate' : 'weak';
  return { rate, isSignificant: mag > 2, trend };
};

export function useDiscountMetrics(
  data: SalesData[] = [],
  historicalData?: SalesData[],
  options?: Options
) {
  return useMemo(() => {
    const base = (historicalData && historicalData.length > 0 ? historicalData : data) as SalesData[];
    const compareEnd = options?.dateRange?.end
      ? (typeof options.dateRange.end === 'string' ? new Date(options.dateRange.end) : (options.dateRange.end as Date))
      : new Date();
    const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const currentStart = monthStart(compareEnd);
    const currentEnd = monthEnd(compareEnd);
    const prevAnchor = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 15);
    const prevStart = monthStart(prevAnchor);
    const prevEnd = monthEnd(prevAnchor);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    const periodLabel = `${fmt(currentStart)} vs ${fmt(prevStart)}`;

    const within = (d?: Date | null, start?: Date, end?: Date) => !!(d && start && end && d >= start && d <= end);

    const current = base.filter((it) => within(parseDate((it as any).paymentDate), currentStart, currentEnd));
    const previous = base.filter((it) => within(parseDate((it as any).paymentDate), prevStart, prevEnd));

    // Compute metrics for a list
    const totals = (list: SalesData[]) => {
      const totalDiscounts = list.reduce((s, it) => s + num(it.discountAmount), 0);
      const totalRevenue = list.reduce((s, it) => s + num(it.paymentValue), 0);
      const totalTransactions = list.length;
      const discountedTransactions = list.filter((it) => num(it.discountAmount) > 0).length;
      const uniqueCustomers = new Set(list.map((it) => it.memberId || it.customerEmail).filter(Boolean)).size;
      const customersWithDiscounts = new Set(
        list.filter((it) => num(it.discountAmount) > 0).map((it) => it.memberId || it.customerEmail).filter(Boolean)
      ).size;

      const discountRate = totalRevenue + totalDiscounts > 0 ? (totalDiscounts / (totalRevenue + totalDiscounts)) * 100 : 0;
      const discountPenetration = totalTransactions > 0 ? (discountedTransactions / totalTransactions) * 100 : 0;
      const customerDiscountPenetration = uniqueCustomers > 0 ? (customersWithDiscounts / uniqueCustomers) * 100 : 0;
      const avgDiscountPerTransaction = discountedTransactions > 0 ? totalDiscounts / discountedTransactions : 0;
      const avgDiscountPerCustomer = customersWithDiscounts > 0 ? totalDiscounts / customersWithDiscounts : 0;

      return {
        totalDiscounts,
        discountRate,
        discountedTransactions,
        customersWithDiscounts,
        avgDiscountPerTransaction,
        avgDiscountPerCustomer,
      };
    };

    const cur = totals(current);
    const prev = totals(previous);

    const m: DiscountMetric[] = [
      {
        title: 'Total Discounts',
        value: formatCurrency(cur.totalDiscounts),
        rawValue: cur.totalDiscounts,
        change: calcGrowth(cur.totalDiscounts, prev.totalDiscounts).rate,
        changeDetails: calcGrowth(cur.totalDiscounts, prev.totalDiscounts),
        previousValue: formatCurrency(prev.totalDiscounts),
        previousRawValue: prev.totalDiscounts,
        periodLabel,
        icon: 'DollarSign',
        description: 'Total amount discounted this month',
      },
      {
        title: 'Discount Rate',
        value: formatPercentage(cur.discountRate),
        rawValue: cur.discountRate,
        change: calcGrowth(cur.discountRate, prev.discountRate).rate,
        changeDetails: calcGrowth(cur.discountRate, prev.discountRate),
        previousValue: formatPercentage(prev.discountRate),
        previousRawValue: prev.discountRate,
        periodLabel,
        icon: 'Percent',
        description: 'Discounts as % of gross (pre-discount) revenue',
      },
      {
        title: 'Transactions with Discounts',
        value: formatNumber(cur.discountedTransactions),
        rawValue: cur.discountedTransactions,
        change: calcGrowth(cur.discountedTransactions, prev.discountedTransactions).rate,
        changeDetails: calcGrowth(cur.discountedTransactions, prev.discountedTransactions),
        previousValue: formatNumber(prev.discountedTransactions),
        previousRawValue: prev.discountedTransactions,
        periodLabel,
        icon: 'ShoppingCart',
        description: 'Number of transactions where a discount was applied',
      },
      {
        title: 'Customers with Discounts',
        value: formatNumber(cur.customersWithDiscounts),
        rawValue: cur.customersWithDiscounts,
        change: calcGrowth(cur.customersWithDiscounts, prev.customersWithDiscounts).rate,
        changeDetails: calcGrowth(cur.customersWithDiscounts, prev.customersWithDiscounts),
        previousValue: formatNumber(prev.customersWithDiscounts),
        previousRawValue: prev.customersWithDiscounts,
        periodLabel,
        icon: 'Users',
        description: 'Unique customers receiving discounts',
      },
      {
        title: 'Avg Discount per Transaction',
        value: formatCurrency(cur.avgDiscountPerTransaction),
        rawValue: cur.avgDiscountPerTransaction,
        change: calcGrowth(cur.avgDiscountPerTransaction, prev.avgDiscountPerTransaction).rate,
        changeDetails: calcGrowth(cur.avgDiscountPerTransaction, prev.avgDiscountPerTransaction),
        previousValue: formatCurrency(prev.avgDiscountPerTransaction),
        previousRawValue: prev.avgDiscountPerTransaction,
        periodLabel,
        icon: 'Target',
        description: 'Average discount per discounted transaction',
      },
      {
        title: 'Avg Discount per Customer',
        value: formatCurrency(cur.avgDiscountPerCustomer),
        rawValue: cur.avgDiscountPerCustomer,
        change: calcGrowth(cur.avgDiscountPerCustomer, prev.avgDiscountPerCustomer).rate,
        changeDetails: calcGrowth(cur.avgDiscountPerCustomer, prev.avgDiscountPerCustomer),
        previousValue: formatCurrency(prev.avgDiscountPerCustomer),
        previousRawValue: prev.avgDiscountPerCustomer,
        periodLabel,
        icon: 'Activity',
        description: 'Average discount per customer receiving discounts',
      },
    ];

    return { metrics: m };
  }, [data, historicalData, options?.dateRange?.start, options?.dateRange?.end]);
}
