import { useState, useEffect } from 'react';
import { SalesData } from '@/types/dashboard';

const GOOGLE_CONFIG = {
  CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  CLIENT_SECRET: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
  REFRESH_TOKEN: import.meta.env.VITE_GOOGLE_REFRESH_TOKEN,
  TOKEN_URL: "https://oauth2.googleapis.com/token"
};

const SPREADSHEET_ID = import.meta.env.VITE_SALES_SPREADSHEET_ID;

export const useGoogleSheets = () => {
  const [data, setData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = async () => {
    try {
      const response = await fetch(GOOGLE_CONFIG.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CONFIG.CLIENT_ID,
          client_secret: GOOGLE_CONFIG.CLIENT_SECRET,
          refresh_token: GOOGLE_CONFIG.REFRESH_TOKEN,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  };

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      setError(null);

      const accessToken = await getAccessToken();
      
      const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1!A:Z`;
      
      const response = await fetch(sheetUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const result = await response.json();
      const rows = result.values || [];
      
      if (rows.length === 0) {
        setData([]);
        return;
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      const processedData: SalesData[] = dataRows.map((row: string[], index: number) => ({
        id: index + 1,
        date: row[0] || '',
        clientName: row[1] || '',
        packageType: row[2] || '',
        amount: parseFloat(row[3] || '0'),
        paymentMethod: row[4] || '',
        salesperson: row[5] || '',
        location: row[6] || '',
        clientType: row[7] || '',
        renewalDate: row[8] || '',
        discountApplied: parseFloat(row[9] || '0'),
        referralSource: row[10] || '',
        notes: row[11] || '',
      }));

      setData(processedData);
    } catch (error) {
      console.error('Error fetching sales data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchSalesData,
  };
};
