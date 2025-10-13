import React, { useState } from 'react';
import { Copy, Check, FileText } from 'lucide-react';
import { Button } from './button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';
import { toast } from './use-toast';

interface CopyTableButtonProps {
  tableRef: React.RefObject<HTMLTableElement | HTMLDivElement>;
  tableName?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showDropdown?: boolean; // If false, defaults to HTML copy on click
}

export const CopyTableButton: React.FC<CopyTableButtonProps> = ({
  tableRef,
  tableName = 'Table',
  className = '',
  size = 'sm',
  showDropdown = true
}) => {
  const [copied, setCopied] = useState(false);

  const copyTableAsHTML = async () => {
    if (!tableRef.current) {
      toast({
        title: "Error",
        description: "Table not found",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create a temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      document.body.appendChild(container);

      // Clone the table element
      const tableClone = tableRef.current.cloneNode(true) as HTMLElement;
      
      // Add comprehensive styling to the cloned table
      const styleSheet = document.createElement('style');
      styleSheet.textContent = `
        /* Table Container */
        .table-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          border: 1px solid #e5e7eb;
        }

        /* Table Styling */
        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          font-size: 14px;
        }

        /* Header Styling */
        thead tr {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-bottom: 2px solid #e2e8f0;
        }

        th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          border-right: 1px solid #e5e7eb;
          position: relative;
        }

        th:last-child {
          border-right: none;
        }

        /* Body Styling */
        tbody tr {
          border-bottom: 1px solid #f3f4f6;
          transition: background-color 0.2s ease;
        }

        tbody tr:nth-child(even) {
          background-color: #f9fafb;
        }

        tbody tr:hover {
          background-color: #f3f4f6;
        }

        td {
          padding: 12px 16px;
          color: #374151;
          border-right: 1px solid #f3f4f6;
        }

        td:last-child {
          border-right: none;
        }

        /* Number formatting */
        .number-cell {
          text-align: right;
          font-variant-numeric: tabular-nums;
          font-weight: 500;
        }

        /* Currency formatting */
        .currency-cell {
          text-align: right;
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          color: #059669;
        }

        /* Percentage formatting */
        .percentage-cell {
          text-align: right;
          font-variant-numeric: tabular-nums;
          font-weight: 500;
        }

        /* Status badges */
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .status-active {
          background-color: #dcfce7;
          color: #166534;
        }

        .status-inactive {
          background-color: #fef3c7;
          color: #92400e;
        }

        /* Metric highlights */
        .metric-positive {
          color: #059669;
          font-weight: 600;
        }

        .metric-negative {
          color: #dc2626;
          font-weight: 600;
        }

        .metric-neutral {
          color: #6b7280;
          font-weight: 500;
        }

        /* Card wrapper for better presentation */
        .table-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          border: 1px solid #e5e7eb;
          overflow: hidden;
          margin: 16px 0;
        }

        .table-header {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .table-title {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .table-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 4px 0 0 0;
        }
      `;

      // Wrap the table in a styled container
      const wrapper = document.createElement('div');
      wrapper.className = 'table-card';
      
      // Add title header
      const header = document.createElement('div');
      header.className = 'table-header';
      header.innerHTML = `
        <h3 class="table-title">${tableName}</h3>
        <p class="table-subtitle">Exported on ${new Date().toLocaleDateString()}</p>
      `;
      
      wrapper.appendChild(header);
      wrapper.appendChild(styleSheet);
      wrapper.appendChild(tableClone);
      container.appendChild(wrapper);

      // Enhance table cells with proper classes
      try {
        const cells = tableClone.querySelectorAll('td, th');
        cells.forEach((cell) => {
          try {
            const text = cell.textContent?.trim() || '';
            
            // Add appropriate classes based on content
            if (text.match(/^\$[\d,]+\.?\d*$/) || text.match(/^₹[\d,]+\.?\d*$/)) {
              cell.classList.add('currency-cell');
            } else if (text.match(/^\d+\.?\d*%$/)) {
              cell.classList.add('percentage-cell');
            } else if (text.match(/^[\d,]+\.?\d*$/)) {
              cell.classList.add('number-cell');
            }

            // Add status styling
            if (text.toLowerCase().includes('active') || text.toLowerCase().includes('converted')) {
              cell.innerHTML = `<span class="status-badge status-active">${text}</span>`;
            } else if (text.toLowerCase().includes('inactive') || text.toLowerCase().includes('pending')) {
              cell.innerHTML = `<span class="status-badge status-inactive">${text}</span>`;
            }

            // Add metric styling for positive/negative values
            if (text.includes('+') || (text.includes('%') && parseFloat(text) > 0)) {
              cell.classList.add('metric-positive');
            } else if (text.includes('-') || (text.includes('%') && parseFloat(text) < 0)) {
              cell.classList.add('metric-negative');
            }
          } catch (cellError) {
            console.warn('Error processing cell:', cellError);
            // Continue processing other cells
          }
        });
      } catch (cellsError) {
        console.warn('Error processing table cells:', cellsError);
        // Continue with table copy without enhanced styling
      }

      // Create the HTML content to copy
      const htmlContent = wrapper.outerHTML;

      // Copy to clipboard using the Clipboard API
      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          const blob = new Blob([htmlContent], { type: 'text/html' });
          const clipboardItem = new ClipboardItem({ 'text/html': blob });
          await navigator.clipboard.write([clipboardItem]);
        } catch (clipboardError) {
          // If HTML copying fails, fall back to plain text
          console.warn('HTML copy failed, falling back to text:', clipboardError);
          const plainText = tableClone.textContent || '';
          await navigator.clipboard.writeText(plainText);
        }
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = htmlContent;
        container.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        container.removeChild(textArea);
      }

      // Cleanup
      document.body.removeChild(container);

      // Show success feedback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      toast({
        title: "Copied to Clipboard",
        description: `${tableName} has been copied with styling`,
      });

    } catch (error) {
      console.error('Error copying table:', error);
      toast({
        title: "Copy Failed",
        description: `Unable to copy table to clipboard: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  const copyTableAsText = async () => {
    if (!tableRef.current) {
      toast({
        title: "Error",
        description: "Table not found",
        variant: "destructive"
      });
      return;
    }

    try {
      // Extract text content from the table
      const tableElement = tableRef.current;
      
      // Find the actual table or extract data from the component
      const table = tableElement.querySelector('table') || tableElement;
      
      let textContent = `${tableName}\n`;
      textContent += `Exported on ${new Date().toLocaleDateString()}\n\n`;
      
      // Extract headers
      const headers: string[] = [];
      const headerCells = table.querySelectorAll('thead th, thead td, tr:first-child th, tr:first-child td');
      headerCells.forEach(cell => {
        const text = cell.textContent?.trim() || '';
        if (text) headers.push(text);
      });
      
      if (headers.length > 0) {
        textContent += headers.join('\t') + '\n';
        textContent += headers.map(() => '---').join('\t') + '\n';
      }
      
      // Extract data rows
      const dataRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
      dataRows.forEach(row => {
        const cells = row.querySelectorAll('td, th');
        const rowData: string[] = [];
        cells.forEach(cell => {
          const text = cell.textContent?.trim() || '';
          rowData.push(text);
        });
        if (rowData.length > 0) {
          textContent += rowData.join('\t') + '\n';
        }
      });
      
      // If no structured table found, get all text content
      if (headers.length === 0 && dataRows.length === 0) {
        textContent += table.textContent?.trim() || 'No data available';
      }
      // Copy to clipboard as plain text
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textContent);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = textContent;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      // Show success feedback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      toast({
        title: "Copied to Clipboard",
        description: `${tableName} has been copied as text`,
      });

    } catch (error) {
      console.error('Error copying table:', error);
      toast({
        title: "Copy Failed",
        description: `Unable to copy table to clipboard: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  const buttonSize = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10', 
    lg: 'h-12 w-12'
  }[size];

  const iconSize = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }[size];

  if (showDropdown) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={`${buttonSize} bg-white/90 hover:bg-gray-50 border-gray-200 shadow-sm transition-all duration-200 ${className}`}
            title={`Copy ${tableName} to clipboard`}
          >
            {copied ? (
              <Check className={`${iconSize} text-green-600`} />
            ) : (
              <Copy className={`${iconSize} text-gray-600`} />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={copyTableAsHTML} className="flex items-center gap-2">
            <Copy className="h-4 w-4" />
            <span>Copy with styling</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyTableAsText} className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Copy as text</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Simple button that copies with styling by default
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={copyTableAsHTML}
      className={`${buttonSize} bg-white/90 hover:bg-gray-50 border-gray-200 shadow-sm transition-all duration-200 ${className}`}
      title={`Copy ${tableName} with styling to clipboard`}
    >
      {copied ? (
        <Check className={`${iconSize} text-green-600`} />
      ) : (
        <Copy className={`${iconSize} text-gray-600`} />
      )}
    </Button>
  );
};

export default CopyTableButton;