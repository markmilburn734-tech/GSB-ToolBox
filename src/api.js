import Papa from 'papaparse';
import { GOOGLE_SHEETS_CSV_URLS, EXCHANGE_RATES } from './constants';

/**
 * Helper to convert Papa.parse into a modern Promise wrapper.
 * Preserves full tickers (including suffixes like .L, .F) exactly as they are.
 */
const parseSheetPromise = (url) => {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                resolve(results.data);
            },
            error: (error) => {
                console.error(`[GSB Tracker] Error fetching sheet: ${url}`, error);
                reject(error);
            }
        });
    });
};

/**
 * Main cross-referencing orchestration engine.
 */
export function fetchPortfolioData(onComplete) {
    Promise.all([
        parseSheetPromise(GOOGLE_SHEETS_CSV_URLS.STOCKS),
        parseSheetPromise(GOOGLE_SHEETS_CSV_URLS.DAILY_HIST),
        parseSheetPromise(GOOGLE_SHEETS_CSV_URLS.MONTHLY_HIST),
        parseSheetPromise(GOOGLE_SHEETS_CSV_URLS.CURRENCIES)
    ])
    .then(([stocksData, dailyHistData, monthlyHistData, currenciesData]) => {
        
        const newPrices = {};
        const historyMap = {};

        // 1. Process Stocks Sheet
        stocksData.forEach(row => {
            if (!row.Ticker || row.Price === undefined) return;
            const tickerKey = String(row.Ticker).trim().toUpperCase();
            if (tickerKey === "N/A" || tickerKey === "") return;

            newPrices[tickerKey] = {
                price: parseFloat(row.Price),
                isin: row.ISIN ? String(row.ISIN).trim().toUpperCase() : 'N/A',
                name: row.Name ? String(row.Name).trim() : 'Unknown Asset',
                currency: row.Currency ? String(row.Currency).trim().toUpperCase() : 'USD',
                ytd: row['% Off High'] !== undefined ? parseFloat(row['% Off High']) : 0,
                ter: row['TER/OCR'] !== undefined ? parseFloat(row['TER/OCR']) : 0,
                volatility: row['Volatility Index'] ? String(row['Volatility Index']).trim() : 'Average'
            };
        });

        // 2. Process Daily History Sheet
        const dailyGroup = {};
        dailyHistData.forEach(row => {
            if (!row.Ticker || row.Price === undefined || row.Price === null) return;
            
            const tickerKey = String(row.Ticker).trim().toUpperCase();
            if (tickerKey === "N/A" || tickerKey === "") return;

            if (!dailyGroup[tickerKey]) dailyGroup[tickerKey] = [];
            dailyGroup[tickerKey].push(row);
        });

        Object.keys(dailyGroup).forEach(ticker => {
            // Sort chronologically
            dailyGroup[ticker].sort((a, b) => new Date(a.Date) - new Date(b.Date));
            const dailyPrices = dailyGroup[ticker].map(r => r.Price);

            if (!historyMap[ticker]) historyMap[ticker] = {};
            // Map to the frame format the chart component expects
            historyMap[ticker]['Daily_1Y'] = dailyPrices.join(';');
        });

        // 3. Process Monthly History Sheet
        const monthlyGroup = {};
        monthlyHistData.forEach(row => {
            if (!row.Ticker || row.Price === undefined || row.Price === null) return;
            
            const tickerKey = String(row.Ticker).trim().toUpperCase();
            if (tickerKey === "N/A" || tickerKey === "") return;

            if (!monthlyGroup[tickerKey]) monthlyGroup[tickerKey] = [];
            monthlyGroup[tickerKey].push(row);
        });

        Object.keys(monthlyGroup).forEach(ticker => {
            // Sort chronologically
            monthlyGroup[ticker].sort((a, b) => new Date(a.Date) - new Date(b.Date));
            const monthlyPrices = monthlyGroup[ticker].map(r => r.Price);

            if (!historyMap[ticker]) historyMap[ticker] = {};
            historyMap[ticker]['Monthly_5Y'] = monthlyPrices.join(';');
        });

        // 4. Process Currencies Sheet
        currenciesData.forEach(row => {
            const base = row['Base Currency'] ? String(row['Base Currency']).trim().toUpperCase() : null;
            const target = row['Target Currency'] ? String(row['Target Currency']).trim().toUpperCase() : null;
            const rate = parseFloat(row['Exchange Rate']);
            
            if (!base || !target || isNaN(rate)) return;
            
            if (!EXCHANGE_RATES[base]) EXCHANGE_RATES[base] = {};
            EXCHANGE_RATES[base][target] = rate;
        });

        console.log("[GSB Tracker] Successfully parsed all sheets. Registered keys:", Object.keys(historyMap));
        onComplete({ newPrices, historyMap });

    })
    .catch(err => {
        console.error("[GSB Tracker] Fatal error loading remote configuration assets:", err);
    });

// Inside your api.js where you parse the Daily History sheet
Papa.parse(csvData, {
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    // 1. Check if we actually got rows
    if (!results.data || results.data.length === 0) {
      console.error("[GSB Tracker] Critical: Papa.parse returned an empty array!");
      return;
    }

    // 2. Log the actual column headers found in your Google Sheet
    const actualHeaders = Object.keys(results.data[0]);
    console.log("[GSB Tracker] Detected CSV Headers:", actualHeaders);

    results.data.forEach((row, index) => {
      // 3. Match this logic to your exact header case
      // If your sheet uses lowercase 'ticker', change row.Ticker to row.ticker
      const tickerKey = row.Ticker || row.ticker || row['Ticker Code']; 
      
      if (tickerKey) {
        const cleanedKey = tickerKey.trim().toUpperCase();
        // ... rest of your historyMap grouping logic
      } else if (index === 0) {
        console.warn("[GSB Tracker] Could not find a ticker value in the first row. Row sample:", row);
      }
    });
  }
});

}