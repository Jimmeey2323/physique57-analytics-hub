import { GoogleGenerativeAI } from '@google/generative-ai';

interface TableColumn {
  key: string;
  header: string;
  type?: 'number' | 'currency' | 'percentage' | 'text' | 'date';
}

interface TableSummaryOptions {
  tableData: any[];
  columns: TableColumn[];
  tableName?: string;
  context?: string;
  summaryType?: 'comprehensive' | 'insights' | 'trends' | 'performance' | 'brief';
  includeRecommendations?: boolean;
  maxRows?: number;
}

interface GeminiSummaryResult {
  summary: string;
  keyInsights: string[];
  trends: string[];
  recommendations?: string[];
  error?: string;
}

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyCy9Z3Sa8KJYY4n9haAmc7QGGaTEE5X0PI';
    if (!apiKey) {
      throw new Error('Gemini API key is not configured');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // Use the exact model name from your reference
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",  // Matching your bash script reference
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4096, // Increased for more detailed responses
        candidateCount: 1,
      }
    });
  }

  /**
   * Test the Gemini connection and model availability
   */
  async testConnection(): Promise<{ success: boolean; model?: string; error?: string }> {
    try {
      const testResult = await this.model.generateContent("Hello, please respond with 'Connection successful'");
      const response = await testResult.response;
      response.text();
      
      return {
        success: true,
        model: "gemini-flash-latest",
      };
    } catch (error: any) {
      console.error('Connection test failed:', error);
      return {
        success: false,
        error: error?.message || 'Connection failed'
      };
    }
  }

  /**
   * Extract key statistics from table data
   */
  private extractTableStatistics(data: any[], columns: TableColumn[]): any {
    if (!data.length) return {};

    const stats: any = {
      totalRows: data.length,
      numericColumns: {},
      textColumns: {},
      dateColumns: {}
    };

    columns.forEach(column => {
      const values = data.map(row => row[column.key]).filter(val => val !== null && val !== undefined);
      
      if (column.type === 'number' || column.type === 'currency' || column.type === 'percentage') {
        const numericValues = values.map(v => typeof v === 'string' ? parseFloat(v.replace(/[$,%]/g, '')) : Number(v))
          .filter(v => !isNaN(v));
        
        if (numericValues.length > 0) {
          stats.numericColumns[column.key] = {
            header: column.header,
            count: numericValues.length,
            sum: numericValues.reduce((a, b) => a + b, 0),
            average: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
            min: Math.min(...numericValues),
            max: Math.max(...numericValues),
            type: column.type
          };
        }
      } else if (column.type === 'text') {
        const uniqueValues = [...new Set(values)];
        stats.textColumns[column.key] = {
          header: column.header,
          uniqueCount: uniqueValues.length,
          mostCommon: this.getMostCommonValue(values),
          examples: uniqueValues.slice(0, 5)
        };
      } else if (column.type === 'date') {
        const dateValues = values.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
        if (dateValues.length > 0) {
          stats.dateColumns[column.key] = {
            header: column.header,
            count: dateValues.length,
            earliest: new Date(Math.min(...dateValues.map(d => d.getTime()))),
            latest: new Date(Math.max(...dateValues.map(d => d.getTime()))),
            range: this.getDateRange(dateValues)
          };
        }
      }
    });

    return stats;
  }

  /**
   * Get the most common value in an array
   */
  private getMostCommonValue(values: any[]): { value: any; count: number } {
    const frequency: Record<string, number> = {};
    values.forEach(val => {
      const key = String(val);
      frequency[key] = (frequency[key] || 0) + 1;
    });
    
    const entries = Object.entries(frequency);
    const mostCommon = entries.reduce((a, b) => a[1] > b[1] ? a : b, ['', 0]);
    return { value: mostCommon[0], count: mostCommon[1] };
  }

  /**
   * Calculate date range description
   */
  private getDateRange(dates: Date[]): string {
    if (dates.length < 2) return 'Single date';
    
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));
    const diffInDays = Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays < 30) return `${diffInDays} days`;
    if (diffInDays < 365) return `${Math.ceil(diffInDays / 30)} months`;
    return `${Math.ceil(diffInDays / 365)} years`;
  }

  /**
   * Format currency values for AI analysis in INR lakhs
   */
  public formatCurrency(amount: number): string {
    const valueInLakhs = amount / 100000; // Convert to lakhs
    if (valueInLakhs >= 1) {
      return `₹${valueInLakhs.toFixed(2)} lakhs`;
    } else {
      // For values less than 1 lakh, show in thousands
      const valueInThousands = amount / 1000;
      if (valueInThousands >= 1) {
        return `₹${valueInThousands.toFixed(1)}K`;
      } else {
        return `₹${amount.toLocaleString('en-IN')}`;
      }
    }
  }

  /**
   * Format number values for AI analysis
   */
  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Create a prompt for Gemini based on table data and options
   */
  /**
 * Create an enhanced, detailed prompt for Gemini with comprehensive month-over-month analysis
 */
private createAnalysisPrompt(options: TableSummaryOptions): string {
  const { tableData, columns, tableName, context, summaryType, includeRecommendations, maxRows } = options;
  const stats = this.extractTableStatistics(tableData, columns);
  const limitedData = maxRows ? tableData.slice(0, maxRows) : tableData;

  // Detect if data has time-based information for temporal analysis
  const hasDateColumn = columns.some(col => col.type === 'date');
  const dateColumns = columns.filter(col => col.type === 'date');
  
  // Group data by time periods if date columns exist
  let timeBasedAnalysis = '';
  if (hasDateColumn && dateColumns.length > 0) {
    timeBasedAnalysis = this.generateTimeBasedContext(tableData, dateColumns[0]);
  }

  let prompt = `You are a senior business intelligence analyst with expertise in the fitness and wellness industry, specializing in Indian market dynamics, member behavior analysis, and revenue optimization. Your task is to perform a comprehensive, data-driven analysis that executives can use for strategic decision-making.

═══════════════════════════════════════════════════════════════════════════════
📊 DATA CONTEXT & OVERVIEW
═══════════════════════════════════════════════════════════════════════════════

**Business Entity**: ${tableName || 'Business Performance Analytics'}
**Context**: ${context || 'Comprehensive business performance tracking and optimization'}
**Dataset Size**: ${stats.totalRows} total records
**Analysis Framework**: ${summaryType || 'comprehensive'} deep-dive analysis
**Currency**: All financial figures in Indian Rupees (₹), presented in lakhs for amounts ≥ ₹1,00,000

═══════════════════════════════════════════════════════════════════════════════
📋 DATA STRUCTURE & SCHEMA
═══════════════════════════════════════════════════════════════════════════════

**Columns Available for Analysis:**
${columns.map((col, idx) => `${idx + 1}. **${col.header}** (${col.key})
   - Data Type: ${col.type || 'text'}
   - Purpose: ${this.getColumnPurpose(col)}`).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
📈 STATISTICAL FOUNDATION
═══════════════════════════════════════════════════════════════════════════════
`;

  // Enhanced Numeric Metrics Section
  if (Object.keys(stats.numericColumns).length > 0) {
    prompt += '\n**QUANTITATIVE METRICS & FINANCIAL INDICATORS:**\n\n';
    Object.entries(stats.numericColumns).forEach(([, stat]: [string, any]) => {
      const formatValue = (val: number) => {
        if (stat.type === 'currency') return this.formatCurrency(val);
        if (stat.type === 'percentage') return `${val.toFixed(1)}%`;
        return this.formatNumber(val);
      };
      
      const range = stat.max - stat.min;
      const variance = range / stat.average * 100;
      
      prompt += `📊 **${stat.header}**
   • Total Aggregate: ${formatValue(stat.sum)}
   • Mean (Average): ${formatValue(stat.average)}
   • Range: ${formatValue(stat.min)} → ${formatValue(stat.max)}
   • Spread: ${formatValue(range)} (${variance.toFixed(1)}% variance)
   • Sample Size: ${stat.count} data points
   • Median Context: Use this for distribution analysis
\n`;
    });
  }

  // Enhanced Categorical Analysis
  if (Object.keys(stats.textColumns).length > 0) {
    prompt += '\n**CATEGORICAL DISTRIBUTION & SEGMENTATION:**\n\n';
    Object.entries(stats.textColumns).forEach(([, stat]: [string, any]) => {
      const dominancePercentage = ((stat.mostCommon.count / stats.totalRows) * 100).toFixed(1);
      prompt += `🏷️ **${stat.header}**
   • Unique Categories: ${stat.uniqueCount}
   • Distribution Leader: "${stat.mostCommon.value}" (${stat.mostCommon.count} occurrences, ${dominancePercentage}% share)
   • Sample Categories: ${stat.examples.join(', ')}
   • Analysis Focus: Compare performance across these segments
\n`;
    });
  }

  // Enhanced Time Period Analysis
  if (Object.keys(stats.dateColumns).length > 0) {
    prompt += '\n**TEMPORAL SCOPE & TIME-SERIES CONTEXT:**\n\n';
    Object.entries(stats.dateColumns).forEach(([, stat]: [string, any]) => {
      prompt += `📅 **${stat.header}**
   • Analysis Period: ${stat.earliest.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })} 
     ↓ TO ↓
     ${stat.latest.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
   • Duration: ${stat.range}
   • Data Points: ${stat.count} time-stamped records
   • Temporal Granularity: Use this for trend, seasonality, and growth analysis
\n`;
    });
  }

  // Add time-based grouping if available
  if (timeBasedAnalysis) {
    prompt += '\n**PERIOD-OVER-PERIOD BREAKDOWN:**\n\n';
    prompt += timeBasedAnalysis;
  }

  // Enhanced Sample Data Presentation
  if (limitedData.length > 0) {
    prompt += '\n═══════════════════════════════════════════════════════════════════════════════\n';
    prompt += '📋 SAMPLE DATA EXTRACT (First 10 Representative Records)\n';
    prompt += '═══════════════════════════════════════════════════════════════════════════════\n\n';
    
    const sampleData = limitedData.slice(0, 10);
    const headers = columns.map(col => col.header).join(' | ');
    prompt += `${headers}\n`;
    prompt += '─'.repeat(headers.length) + '\n';
    
    sampleData.forEach((row, idx) => {
      const rowData = columns.map(col => {
        const value = row[col.key];
        if (value === null || value === undefined) return 'N/A';
        if (col.type === 'currency' && typeof value === 'number') return this.formatCurrency(value);
        if (col.type === 'number' && typeof value === 'number') return this.formatNumber(value);
        if (col.type === 'date' && value) return new Date(value).toLocaleDateString('en-IN');
        return String(value);
      }).join(' | ');
      prompt += `${idx + 1}. ${rowData}\n`;
    });
  }

  prompt += `\n\n═══════════════════════════════════════════════════════════════════════════════
🎯 COMPREHENSIVE ANALYSIS REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

You are now required to provide an executive-level, boardroom-ready analysis following this exact structure. Each section must be comprehensive, specific, and actionable.

───────────────────────────────────────────────────────────────────────────────
1️⃣ EXECUTIVE SUMMARY (Minimum 6-8 sentences)
───────────────────────────────────────────────────────────────────────────────

Provide a compelling narrative overview that answers:
• What does this data represent and what business questions does it answer?
• What are the 3-4 most critical findings that leadership must know immediately?
• What is the overall health/performance status? (Excellent/Good/Fair/Concerning)
• What is the primary business narrative emerging from this data?
• Include specific KPIs, growth rates, and financial metrics that frame the story
• Contextualize findings within the Indian fitness/wellness market landscape

**Writing Style**: Professional, confident, data-driven. Write as if presenting to the CEO and CFO.

───────────────────────────────────────────────────────────────────────────────
2️⃣ MONTH-OVER-MONTH COMPARATIVE ANALYSIS (Critical Priority)
───────────────────────────────────────────────────────────────────────────────

${hasDateColumn ? `
**This is the most critical section. You MUST provide detailed month-by-month comparisons.**

For EACH month in the dataset, provide:

📊 **Month: [Month Name Year]**
   • **Revenue Performance**: ₹X lakhs (±Y% vs previous month, ±Z% vs same month last year if available)
   • **Volume Metrics**: X transactions/members (±Y% MoM change)
   • **Average Values**: ₹X per transaction (±Y% MoM change)
   • **Key Highlight**: One sentence on what made this month unique
   • **Ranking**: Where this month ranks (e.g., "2nd best month" or "Lowest performing month")

**Then provide:**

🔍 **Cross-Month Insights:**
   • Which month was the best performer and why? (Quantify the advantage)
   • Which month underperformed and what were the contributing factors?
   • What is the month-over-month growth trend? (Calculate CAGR if applicable)
   • Identify any seasonal patterns (e.g., January membership surge, summer slowdown)
   • Compare Q1 vs Q2 vs Q3 vs Q4 performance if full quarters are available
   • Calculate average monthly performance and identify outliers (±1 SD)
   • What is the momentum direction? (Growing/Stable/Declining)

**Required Metrics for Each Comparison:**
   • Absolute change (₹X lakhs increase/decrease)
   • Percentage change (±Y%)
   • Year-over-year comparison if multi-year data exists
   • Cumulative growth rate across the period
` : `
**Time-Series Analysis:**

Since specific date columns may not be prominent, analyze any temporal patterns in the data:
   • If there are sequence numbers, IDs, or ordering, identify any progression trends
   • Compare early dataset records vs later records for any measurable changes
   • Identify any cyclical patterns or groupings in the data
   • Note any performance evolution across the dataset sequence
`}

───────────────────────────────────────────────────────────────────────────────
3️⃣ KEY BUSINESS INSIGHTS (Minimum 8-10 detailed insights)
───────────────────────────────────────────────────────────────────────────────

Each insight must follow this structure:

**Insight #X: [Clear, Action-Oriented Title]**
   • **Finding**: What the data shows (with specific numbers)
   • **Context**: Why this matters to the business
   • **Impact**: Financial or operational implications (quantified)
   • **Benchmark**: How this compares to industry standards or historical performance
   • **Evidence**: Supporting data points or calculations

**Required Focus Areas:**
   ✓ Revenue concentration and diversification
   ✓ Customer/member value and segmentation analysis
   ✓ Service/product mix performance
   ✓ Efficiency and productivity metrics
   ✓ Growth rates and momentum indicators
   ✓ Market positioning and competitive advantages
   ✓ Risk factors and vulnerabilities identified
   ✓ Opportunities for optimization

**Example Format:**
**Insight #1: Premium Membership Drives 67% of Total Revenue**
   • **Finding**: Premium tier generates ₹45.2 lakhs from just 234 members (₹19,316 average)
   • **Context**: Despite being only 28% of member base, premium creates revenue majority
   • **Impact**: High-value segment critical to business sustainability; 10% premium churn = ₹4.5L annual loss
   • **Benchmark**: Industry average premium contribution is 45-50%; we exceed by 17 percentage points
   • **Evidence**: Basic tier (560 members) generates only ₹18.3L (₹3,268 average), showing 5.9x value gap

───────────────────────────────────────────────────────────────────────────────
4️⃣ TREND ANALYSIS & PATTERN RECOGNITION (Minimum 6-8 trends)
───────────────────────────────────────────────────────────────────────────────

Identify and explain significant patterns:

**Growth Trends:**
   • Calculate compound monthly growth rate (CMGR) for key metrics
   • Identify acceleration or deceleration phases
   • Project trajectory if current trends continue (next 3-6 months)

**Seasonal Patterns:**
   • Peak performance periods and triggers
   • Low-performance periods and causes
   • Predictable cyclical behaviors (if applicable)

**Anomalies & Outliers:**
   • Unexpected spikes or drops (with ±% quantification)
   • One-time events vs systematic changes
   • Data quality issues or reporting anomalies

**Correlation Insights:**
   • Relationships between different metrics
   • Leading indicators for future performance
   • Cause-and-effect relationships observed

───────────────────────────────────────────────────────────────────────────────
5️⃣ SEGMENTATION & PERFORMANCE BREAKDOWN
───────────────────────────────────────────────────────────────────────────────

**Top Performers Analysis:**
   • Identify top 20% of performers (by revenue, volume, efficiency)
   • Quantify their contribution (₹X lakhs, Y% of total)
   • What characteristics define top performers?
   • What can be learned and replicated?

**Underperformers Analysis:**
   • Identify bottom 20% and quantify impact
   • Root cause analysis: Why are they underperforming?
   • Recovery potential and required interventions
   • Should they be improved or phased out?

**Middle Performers:**
   • The largest segment - what's their potential?
   • Quick wins to elevate them to top tier?
   • Standardization opportunities

**Pareto Analysis:**
   • Apply 80/20 rule: Do 20% of X generate 80% of Y?
   • Where should focus and resources be concentrated?

───────────────────────────────────────────────────────────────────────────────
6️⃣ FINANCIAL DEEP-DIVE ANALYSIS
───────────────────────────────────────────────────────────────────────────────

**Revenue Architecture:**
   • Total revenue: ₹X lakhs across [period]
   • Revenue per day/week/month: ₹X lakhs average
   • Revenue growth rate: ±X% MoM, ±Y% overall period
   • Revenue concentration risk: Top X contributors = Y% of revenue

**Unit Economics:**
   • Average revenue per user (ARPU): ₹X
   • Average transaction value (ATV): ₹X
   • Cost per acquisition insights (if data available)
   • Lifetime value indicators

**Revenue Quality Metrics:**
   • Recurring vs one-time revenue split
   • Payment consistency and reliability
   • Revenue predictability score
   • Churn risk indicators (if applicable)

**Financial Health Indicators:**
   • Month-over-month revenue volatility
   • Revenue diversification score
   • Growth sustainability assessment
   • Cash flow patterns (if temporal data available)

───────────────────────────────────────────────────────────────────────────────
7️⃣ BENCHMARKING & CONTEXTUAL COMPARISON
───────────────────────────────────────────────────────────────────────────────

**Internal Benchmarks:**
   • Compare current performance to historical best
   • Identify record-breaking achievements
   • Distance from peak performance metrics

**Industry Context (Indian Fitness/Wellness Market):**
   • How do these metrics compare to industry averages?
   • Are we seeing market-wide trends or unique patterns?
   • Competitive positioning insights

**Performance Standards:**
   • Which metrics exceed expectations? (quantify)
   • Which metrics need improvement? (set targets)
   • What is "good" vs "excellent" for each KPI?

${includeRecommendations ? `
───────────────────────────────────────────────────────────────────────────────
8️⃣ STRATEGIC RECOMMENDATIONS & ACTION PLAN (7-10 recommendations)
───────────────────────────────────────────────────────────────────────────────

Each recommendation must be structured as:

**Recommendation #X: [Clear Action Title]**
   • **Objective**: What this aims to achieve
   • **Rationale**: Why this matters (data-driven justification)
   • **Action Steps**: 3-5 specific implementation steps
   • **Expected Impact**: Quantified outcome (e.g., "Increase revenue by ₹8-12 lakhs in 6 months")
   • **Timeline**: Implementation period (Short-term: 0-3 months, Medium: 3-6 months, Long: 6-12 months)
   • **Resources Required**: What's needed to execute
   • **Risk Level**: Low/Medium/High and mitigation strategies
   • **Priority**: Critical/High/Medium/Low
   • **Success Metrics**: How to measure effectiveness

**Prioritization Framework:**
   🔴 **Critical (Do First)**: High impact, urgent, foundational
   🟡 **High Priority**: High impact, important, strategic
   🟢 **Medium Priority**: Moderate impact, beneficial, tactical
   ⚪ **Low Priority**: Nice-to-have, experimental, long-term

**Categories to Address:**
   • Revenue optimization opportunities
   • Cost reduction or efficiency improvements
   • Customer/member experience enhancements
   • Risk mitigation strategies
   • Growth acceleration initiatives
   • Operational excellence improvements
   • Technology or process innovations
` : ''}

───────────────────────────────────────────────────────────────────────────────
9️⃣ RISK ASSESSMENT & RED FLAGS
───────────────────────────────────────────────────────────────────────────────

**Identify and quantify:**
   • Revenue concentration risks (over-reliance on specific segments)
   • Declining trend indicators (momentum loss)
   • Volatility concerns (inconsistent performance)
   • Sustainability questions (one-time vs repeatable success)
   • Market or competitive threats visible in data
   • Operational bottlenecks or capacity constraints

───────────────────────────────────────────────────────────────────────────────
🔟 FORWARD-LOOKING OUTLOOK & PROJECTIONS
───────────────────────────────────────────────────────────────────────────────

Based on the data trends:

**3-Month Forecast:**
   • Expected trajectory if current trends continue
   • Optimistic scenario (if improvements implemented)
   • Conservative scenario (if challenges persist)

**Key Questions for Leadership:**
   • What decisions need to be made based on this data?
   • Where should the next round of investment focus?
   • What emerging opportunities should be prioritized?

═══════════════════════════════════════════════════════════════════════════════
📝 CRITICAL FORMATTING & QUALITY REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

**Mandatory Standards:**
✅ Every claim must be supported by specific numbers from the data
✅ Use Indian Rupee (₹) format with lakhs for amounts ≥ ₹1,00,000
✅ Include percentages alongside absolute numbers (e.g., "₹23.4L, 34% of total")
✅ Compare current vs previous periods with ±X% change notation
✅ Use professional business language suitable for executive presentations
✅ Prioritize actionability - every insight should suggest "so what?"
✅ Be specific, not generic - avoid vague statements like "performance is good"
✅ Include growth rates, ratios, and comparative metrics throughout
✅ Use clear section headers, bullet points, and visual hierarchy
✅ Provide context for all numbers (vs what? vs when? vs whom?)
✅ Highlight the most important 3-5 findings with emphasis

**Prohibited:**
❌ Generic insights that could apply to any business
❌ Vague language like "significant," "considerable" without quantification
❌ Unsupported claims not backed by the data
❌ Repetitive points across sections
❌ Overly technical jargon without explanation
❌ Burying critical insights in long paragraphs

**Tone & Voice:**
• Confident and authoritative, but not arrogant
• Data-driven and analytical, but not robotic
• Strategic and forward-thinking
• Honest about limitations or concerns
• Balanced between celebration of wins and identification of improvements

═══════════════════════════════════════════════════════════════════════════════

**OUTPUT FORMAT:**
Provide your analysis with clear markdown formatting, using headers (##), subheaders (###), bullet points, and emphasis (**bold**) for key metrics. Structure your response to be immediately useful for executive decision-making.

**YOUR ANALYSIS BEGINS BELOW:**`;

  return prompt;
}

/**
 * Helper method to generate time-based context for month-over-month analysis
 */
private generateTimeBasedContext(tableData: any[], dateColumn: TableColumn): string {
  try {
    // Group data by month
    const monthlyData: Map<string, any[]> = new Map();
    
    tableData.forEach(row => {
      const dateValue = row[dateColumn.key];
      if (dateValue) {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, []);
          }
          monthlyData.get(monthKey)!.push(row);
        }
      }
    });

    let context = '';
    const sortedMonths = Array.from(monthlyData.keys()).sort();
    
    sortedMonths.forEach((monthKey, index) => {
      const [year, month] = monthKey.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1, 1)
        .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const records = monthlyData.get(monthKey)!;
      
      context += `📅 **${monthName}**: ${records.length} records`;
      
      if (index > 0) {
        const prevMonthKey = sortedMonths[index - 1];
        const prevRecords = monthlyData.get(prevMonthKey)!.length;
        const changePercent = ((records.length - prevRecords) / prevRecords * 100).toFixed(1);
        const changeNumber = parseFloat(changePercent);
        context += ` (${changeNumber > 0 ? '+' : ''}${changePercent}% vs previous month)`;
      }
      
      context += '\n';
    });
    
    return context;
  } catch (error) {
    console.warn('Error generating time-based context:', error);
    return '';
  }
}

/**
 * Helper method to determine column purpose for better context
 */
private getColumnPurpose(column: TableColumn): string {
  const key = column.key.toLowerCase();
  
  if (key.includes('revenue') || key.includes('amount') || key.includes('price')) {
    return 'Financial metric for revenue analysis';
  }
  if (key.includes('date') || key.includes('time')) {
    return 'Temporal dimension for trend analysis';
  }
  if (key.includes('member') || key.includes('customer') || key.includes('user')) {
    return 'Customer/member identifier or attribute';
  }
  if (key.includes('name') || key.includes('title')) {
    return 'Categorical identifier for segmentation';
  }
  if (key.includes('count') || key.includes('quantity') || key.includes('number')) {
    return 'Volume or quantity metric';
  }
  if (key.includes('rate') || key.includes('percentage')) {
    return 'Performance ratio or percentage metric';
  }
  
  return 'Business attribute for analysis and segmentation';
}
}

  /**
   * Generate AI summary of table data using Gemini
   */
  async generateTableSummary(options: TableSummaryOptions): Promise<GeminiSummaryResult> {
    try {
      if (!options.tableData || options.tableData.length === 0) {
        return {
          summary: 'No data available for analysis.',
          keyInsights: ['No data to analyze'],
          trends: ['Insufficient data for trend analysis'],
          error: 'No data provided'
        };
      }

      const prompt = this.createAnalysisPrompt(options);
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the structured response
      const sections = this.parseGeminiResponse(text);

      return {
        summary: sections.summary || text.slice(0, 1000) + (text.length > 1000 ? '...' : ''),
        keyInsights: sections.keyInsights || this.extractBulletPoints(text).slice(0, 8),
        trends: sections.trends || this.extractBulletPoints(text).slice(0, 6),
        recommendations: sections.recommendations || undefined
      };
      
    } catch (error: any) {
      console.error('Gemini API error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'AI analysis temporarily unavailable. Please try again later.';
      if (error?.status === 404) {
        errorMessage = 'Model not found. Please check the Gemini model configuration.';
      } else if (error?.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again in a few moments.';
      } else if (error?.status === 403) {
        errorMessage = 'API access denied. Please check your API key.';
      }
      
      return {
        summary: errorMessage,
        keyInsights: ['AI service encountered an error'],
        trends: ['Unable to analyze trends at this time'],
        error: error?.message || error?.status || 'Unknown error occurred'
      };
    }
  }

  /**
   * Parse Gemini response into structured sections
   */
  private parseGeminiResponse(text: string): {
    summary?: string;
    keyInsights?: string[];
    trends?: string[];
    recommendations?: string[];
  } {
    const sections: any = {};
    
    try {
      // Enhanced pattern matching for more comprehensive sections
      const summaryMatch = text.match(/(?:Executive Summary|Summary)[:\s]*\n([\s\S]*?)(?=\n\s*(?:\d+\.|\*\*(?:Key Insights|Insights|Trends|Performance|Financial|Recommendations)))/i);
      if (summaryMatch) {
        sections.summary = summaryMatch[1].trim();
      }

      // Capture Key Insights with more flexible matching
      const insightsMatch = text.match(/(?:Key Insights|Insights)[:\s]*\n([\s\S]*?)(?=\n\s*(?:\d+\.|\*\*(?:Trends|Performance|Financial|Recommendations)))/i);
      if (insightsMatch) {
        sections.keyInsights = this.extractBulletPoints(insightsMatch[1], 8);
      }

      // Capture Trends, Performance Assessment, and Financial Analysis together
      const trendsMatch = text.match(/(?:Trends|Patterns|Performance Assessment|Financial Analysis)[\s\S]*?\n([\s\S]*?)(?=\n\s*(?:\d+\.|\*\*(?:Strategic|Recommendations))|$)/i);
      if (trendsMatch) {
        sections.trends = this.extractBulletPoints(trendsMatch[1], 8);
      }

      const recommendationsMatch = text.match(/(?:Strategic Recommendations|Recommendations)[:\s]*\n([\s\S]*?)$/i);
      if (recommendationsMatch) {
        sections.recommendations = this.extractBulletPoints(recommendationsMatch[1], 8);
      }
      
      // If structured parsing fails, try to extract all bullet points from the full text
      if (!sections.keyInsights || sections.keyInsights.length === 0) {
        const allPoints = this.extractBulletPoints(text, 15);
        sections.keyInsights = allPoints.slice(0, 8);
        sections.trends = allPoints.slice(8, 14);
        if (allPoints.length > 14) {
          sections.recommendations = allPoints.slice(14);
        }
      }
      
    } catch (error) {
      console.warn('Error parsing Gemini response structure:', error);
    }

    return sections;
  }

  /**
   * Extract bullet points from text with configurable limits
   */
  private extractBulletPoints(text: string, maxPoints: number = 8): string[] {
    if (!text) return [];
    
    // Split by various bullet point indicators and numbered lists
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Remove various bullet point prefixes
        return line.replace(/^[-•*+→▶]\s*/, '')
                  .replace(/^\d+\.\s*/, '')
                  .replace(/^[a-zA-Z]\.\s*/, '')
                  .trim();
      })
      .filter(line => {
        // Filter out very short lines, headers, and section markers
        return line.length > 15 && 
               !line.match(/^\*\*.*\*\*$/) && // Remove markdown headers
               !line.match(/^#{1,6}\s/) && // Remove markdown headers
               !line.includes('**') && // Remove bold markers
               line.length < 500; // Remove overly long paragraphs
      })
      .map(line => {
        // Clean up the text and ensure proper formatting
        return line.replace(/\*\*/g, '').trim();
      })
      .filter(line => line.length > 15); // Final length filter
    
    return lines.slice(0, maxPoints);
  }

  /**
   * Quick insight generation for smaller data sets
   */
  async generateQuickInsights(data: any[], columns: TableColumn[], tableName?: string): Promise<string[]> {
    try {
      const stats = this.extractTableStatistics(data, columns);
      const currentDate = new Date();
      const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const previousMonthName = previousMonth.toLocaleString('default', { month: 'long' });
      
      const prompt = `Analyze this ${tableName || 'business'} data with PRIMARY FOCUS on ${previousMonthName} performance and provide 5 detailed key insights:

Data: ${data.length} rows
Key metrics: ${Object.values(stats.numericColumns).map((stat: any) => `${stat.header}: ${this.formatCurrency(stat.sum)}`).join(', ')}

FOCUS REQUIREMENTS for insights:
1. Start each insight with "${previousMonthName}:" when referring to previous month data
2. Include month-over-month comparisons involving ${previousMonthName}
3. Show how ${previousMonthName} ranks against other months in the dataset
4. Highlight ${previousMonthName} specific performance metrics
5. Compare ${previousMonthName} to historical averages and trends

Note: All currency figures are in Indian Rupees (₹) and large amounts should be presented in lakhs.

Provide exactly 5 detailed bullet points focusing on ${previousMonthName} performance with specific numbers, percentages, and month-over-month comparisons for the Indian fitness/wellness market:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.extractBulletPoints(text, 5);
    } catch (error: any) {
      console.error('Quick insights error:', error);
      
      if (error?.status === 404) {
        return ['Model configuration error - please contact support'];
      } else if (error?.status === 429) {
        return ['Rate limit exceeded - please try again in a moment'];
      } else if (error?.status === 403) {
        return ['API access denied - please check configuration'];
      }
      
      return ['Analysis unavailable at this time'];
    }
  }
}

// Export singleton instance
export const geminiService = new GeminiService();
export type { TableSummaryOptions, GeminiSummaryResult, TableColumn };
