import React from 'react';
import { ModernHeroSection } from '@/components/ui/ModernHeroSection';
import { AdvancedExportButton } from '@/components/ui/AdvancedExportButton';
import { useSalesMetrics } from '@/hooks/useSalesMetrics';
import { SalesData } from '@/types/dashboard';

interface SalesHeroSectionProps {
  data: SalesData[];
}

export const SalesHeroSection: React.FC<SalesHeroSectionProps> = ({ data }) => {
  const { metrics } = useSalesMetrics(data);

  // Select only 3 key metrics for hero section
  const metricOrder = [
    'Transactions',
    'Sales Revenue', 
    'Unique Members'
  ];
  
  const heroMetrics = metricOrder
    .map(title => metrics.find(metric => metric.title === title))
    .filter(Boolean)
    .map(metric => ({
      location: metric!.title,
      label: metric!.description,
      value: metric!.value,
      icon: metric!.icon,
      change: metric!.change,
      trend: metric!.changeDetails.trend
    }));

  const exportButton = (
    <AdvancedExportButton 
      salesData={data}
      defaultFileName="sales-analytics-filtered"
      size="sm"
      variant="ghost"
      className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20"
    />
  );

  return (
    <ModernHeroSection 
      title="Sales Analytics"
      subtitle="Comprehensive analysis of sales performance, revenue trends, and customer insights"
      variant="sales"
      metrics={heroMetrics}
      exportButton={exportButton}
      compact={true}
    />
  );
};