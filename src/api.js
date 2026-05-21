import Papa from 'papaparse';
import { GOOGLE_SHEETS_CSV_URLS, EXCHANGE_RATES } from './constants';

/**
 * Helper to convert Papa.parse into a modern Promise wrapper
 * Includes custom recovery logic for unpunctuated, mashed historical strings.
 */
const parseSheetPromise = (url) => {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            beforeFirstParse: (rawString) => {
                if (!rawString) return rawString;

                // Check if the file is mashed together without standard CSV commas/tabs
                if (!rawString.includes(',') && !rawString.includes('\t')) {
                    console.log("[GSB Tracker] Mashed raw history format detected. Re-formatting grid layout...");

                    // Matches: 
                    // 1. Ticker: 0P followed by alphanumeric characters, optionally ending with an exchange suffix like .L
                    // 2. Date: MM/DD/YYYY or M/D/YYYY
                    // 3. Price: digits with 4 decimals
                    const regex = /(0P[A-Z0-9]+(?:\.[A-Z])?)(\d{1,2}\/\d{1,2}\/\d{4})(\d+\.\d{4})/g;
                    let match;
                    const cleanRows = ['Ticker,Date,Price']; // Inject valid headers

                    while ((match = regex.exec(rawString)) !== null) {
                        // Normalize ticker by stripping out trailing exchange suffixes (e.g., '.L')
                        // This guarantees perfect structural synchronization with frontend component state
                        const normalizedTicker = match[1].split('.')[0];
                        cleanRows.push(`${normalizedTicker},${match[2]},${match[3]}`);
                    }

                    return cleanRows.join('\n');
                }
                return rawString;
            },
            complete: (results) => resolve(results.data),
            error: (error) => reject(error)
        });
    });
};

export const fetchPortfolioData = async (onComplete) => {
    try {
        // 1. Fetch all 4 sheets in parallel
        const [stocksData, dailyHistData, monthlyHistData, currenciesData] = await Promise.all([
            parseSheetPromise(GOOGLE_SHEETS_CSV_URLS.STOCKS),
            parseSheetPromise(GOOGLE_SHEETS_CSV_URLS.DAILY_HIST),
            parseSheetPromise(GOOGLE_SHEETS_CSV_URLS.MONTHLY_HIST),
            parseSheetPromise(GOOGLE_SHEETS_CSV_URLS.CURRENCIES)
        ]);

        const newPrices = {};
        const historyMap = {};

        // 2. Process Stocks Sheet (Keyed directly off Base Tickers)
        stocksData.forEach(row => {
            if (!row.Currency || !row.Ticker) return;
            
            // Strip suffixes like .L here as well to maintain uniformity
            const tickerKey = String(row.Ticker).trim().split('.')[0];

            // Map Live Prices for Rebalancer & Market Explorer
            if (!newPrices[row.Currency]) newPrices[row.Currency] = {};
            newPrices[row.Currency][tickerKey] = {
                price: row.Price,
                isin: row.ISIN || 'N/A',
                name: row.Name,
                date: row.Date,
                high_52: row['52W High'],
                low_52: row['52W Low'],
                pct_off_high: parseFloat(row['% Off High']) || 0
            };
        });

        // 3. Process Daily History (5Y) -> Generates 'Daily_1Y' and 'Weekly_3Y'
        const dailyGroup = {};
        dailyHistData.forEach(row => {
            if (!row.Ticker || row.Price === undefined || row.Price === null) return;
            
            const tickerKey = String(row.Ticker).trim().split('.')[0];
            if (!dailyGroup[tickerKey]) dailyGroup[tickerKey] = [];
            dailyGroup[tickerKey].push(row);
        });

        Object.keys(dailyGroup).forEach(ticker => {
            // Ensure chronological order (oldest to newest)
            dailyGroup[ticker].sort((a, b) => new Date(a.Date) - new Date(b.Date));

            const dailyPrices = dailyGroup[ticker].map(r => r.Price);

            if (!historyMap[ticker]) historyMap[ticker] = {};
            historyMap[ticker]['Daily_1Y'] = dailyPrices.join(';');

            // Generate Weekly_3Y dynamically by downsampling every 5th trading session
            const weeklyPrices = dailyPrices.filter((_, index) => index % 5 === 0);
            historyMap[ticker]['Weekly_3Y'] = weeklyPrices.join(';');
        });

        // 4. Process Monthly History (Max) -> Generates 'Monthly_5Y'
        const monthlyGroup = {};
        monthlyHistData.forEach(row => {
            if (!row.Ticker || row.Price === undefined || row.Price === null) return;
            
            const tickerKey = String(row.Ticker).trim().split('.')[0];
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

        // 5. Process Currencies Sheet
        currenciesData.forEach(row => {
            const base = row['Base Currency'];
            const target = row['Target Currency'];
            const rate = parseFloat(row['Exchange Rate']);
            
            if (!base || !target || isNaN(rate)) return;
            
            if (!EXCHANGE_RATES[base]) EXCHANGE_RATES[base] = {};
            EXCHANGE_RATES[base][target] = rate;
        });

        // 6. Callback execution matching App.jsx expects
        onComplete({ newPrices, historyMap });

    } catch (error) {
        console.error("Critical error synchronizing multi-sheet portfolio data:", error);
    }
};