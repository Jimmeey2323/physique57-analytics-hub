
import React from 'react';
import { ExecutiveSummarySection } from '@/components/dashboard/ExecutiveSummarySection';
import { Footer } from '@/components/ui/footer';
import { GlobalFiltersProvider } from '@/contexts/GlobalFiltersContext';
import DashboardMotionHero from '@/components/ui/DashboardMotionHero';
import { AdvancedExportButton } from '@/components/ui/AdvancedExportButton';
import { FileText, Download, Home, Play, Pause } from 'lucide-react';
import { useSalesData } from '@/hooks/useSalesData';
import { useSessionsData } from '@/hooks/useSessionsData';
import { usePayrollData } from '@/hooks/usePayrollData';
import { useNewClientData } from '@/hooks/useNewClientData';
import { useLeadsData } from '@/hooks/useLeadsData';
import { useDiscountAnalysis } from '@/hooks/useDiscountAnalysis';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { useDynamicHeroMetrics } from '@/hooks/useDynamicHeroMetrics';
import { AiNotes } from '@/components/ui/AiNotes';

// Inner component that has access to GlobalFilters context
const ExecutiveSummaryContent = () => {
  const { data: salesData = [] } = useSalesData();
  const { data: sessionsData = [] } = useSessionsData();
  const { data: payrollData = [] } = usePayrollData();
  const { data: newClientData = [] } = useNewClientData();
  const { data: leadsData = [] } = useLeadsData();
  const { data: discountData = [] } = useDiscountAnalysis();
  const exportRef = React.useRef<{ open: () => void }>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);

  // Get dynamic hero metrics that update with location filter
  const heroMetrics = useDynamicHeroMetrics({
    salesData,
    sessionsData,
    leadsData,
    newClientsData: newClientData
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20">
      <DashboardMotionHero
        title="Executive Overview"
        subtitle="A concise, high-level view of revenue, attendance, and growth trends across all locations."
        metrics={heroMetrics}
          extra={
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => setIsPlaying(p => !p)}
                className="rounded-xl border border-white/30 bg-transparent text-white hover:border-white/50 px-4 py-2 text-sm font-semibold"
                variant="ghost"
              >
                {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button 
                onClick={() => exportRef.current?.open()}
                className="rounded-xl border border-white/30 bg-transparent text-white hover:border-white/50 px-4 py-2 text-sm font-semibold"
                variant="ghost"
              >
                <Download className="w-4 h-4 mr-2" />
                Export All Data
              </Button>
              <Button
                onClick={() => document.getElementById('exec-pdf-trigger')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}
                className="rounded-xl border border-white/30 bg-transparent text-white hover:border-white/50 px-4 py-2 text-sm font-semibold"
                variant="ghost"
              >
                <FileText className="w-4 h-4 mr-2" />
                Download PDF Reports
              </Button>
              <Button 
                onClick={() => window.location.href = '/'}
                className="rounded-xl border border-white/30 bg-transparent text-white hover:border-white/50 px-4 py-2 text-sm font-semibold"
                variant="ghost"
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Main Dashboard
              </Button>
            </div>
          }
        />
        
        <div className="container mx-auto px-6 py-8">
          <ExecutiveSummarySection />
          
          <div className="mt-8">
            <AiNotes 
              location="executive-summary"
              sectionId="executive-overview" 
              tableKey="executive-summary-main"
              author="Executive Analyst"
            />
          </div>
        </div>

        {/* Hidden export dialog wired for programmatic open */}
        <div className="hidden">
          <AdvancedExportButton 
            renderTrigger={false}
            openRef={exportRef as any}
            salesData={salesData}
            sessionsData={sessionsData as any}
            newClientData={newClientData}
            payrollData={payrollData}
            lateCancellationsData={[]}
            discountData={discountData as any}
            defaultFileName="executive-dashboard-export"
          />
        </div>
        <Footer />
      </div>
  );
};

// Outer wrapper component
const ExecutiveSummary = () => {
  return (
    <GlobalFiltersProvider>
      <ExecutiveSummaryContent />
    </GlobalFiltersProvider>
  );
};

export default ExecutiveSummary;
