import Papa from 'papaparse';
import { GOOGLE_SHEETS_CSV_URLS, EXCHANGE_RATES } from './constants';

/**
 * Helper to convert Papa.parse into a modern Promise wrapper
 */
const parseSheetPromise = (url) => {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
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
        const tickerToIsin = {}; // Bridge map since history sheets look up by Ticker, but analytics use ISIN

        // 2. Process Stocks Sheet
        stocksData.forEach(row => {
            if (!row.Currency || !row.Ticker || !row.ISIN) return;
            
            // Map Live Prices for Rebalancer & Market Explorer
            if (!newPrices[row.Currency]) newPrices[row.Currency] = {};
            newPrices[row.Currency][row.Ticker] = {
                price: row.Price,
                isin: row.ISIN,
                name: row.Name,
                date: row.Date,
                high_52: row['52W High'],
                low_52: row['52W Low'],
                pct_off_high: parseFloat(row['% Off High']) || 0
            };

            // Register Ticker to ISIN cross-reference
            tickerToIsin[row.Ticker] = row.ISIN;
        });

        // 3. Process Daily History (5Y) -> Generates 'Daily_1Y' and 'Weekly_3Y'
        const dailyGroup = {};
        dailyHistData.forEach(row => {
            if (!row.Ticker || row.Price === undefined || row.Price === null) return;
            if (!dailyGroup[row.Ticker]) dailyGroup[row.Ticker] = [];
            dailyGroup[row.Ticker].push(row);
        });

        Object.keys(dailyGroup).forEach(ticker => {
            const isin = tickerToIsin[ticker];
            if (!isin) return; // Skip if asset isn't tracked in the main stocks ledger

            // Ensure chronological order (oldest to newest)
            dailyGroup[ticker].sort((a, b) => new Date(a.Date) - new Date(b.Date));

            const dailyPrices = dailyGroup[ticker].map(r => r.Price);

            if (!historyMap[isin]) historyMap[isin] = {};
            
            // Feed full daily sequence into Daily_1Y (PerformanceAnalyticsView slices from the tail)
            historyMap[isin]['Daily_1Y'] = dailyPrices.join(';');

            // Generate Weekly_3Y dynamically by downsampling every 5th trading session (approx. weekly intervals)
            const weeklyPrices = dailyPrices.filter((_, index) => index % 5 === 0);
            historyMap[isin]['Weekly_3Y'] = weeklyPrices.join(';');
        });

        // 4. Process Monthly History (Max) -> Generates 'Monthly_5Y'
        const monthlyGroup = {};
        monthlyHistData.forEach(row => {
            if (!row.Ticker || row.Price === undefined || row.Price === null) return;
            if (!monthlyGroup[row.Ticker]) monthlyGroup[row.Ticker] = [];
            monthlyGroup[row.Ticker].push(row);
        });

        Object.keys(monthlyGroup).forEach(ticker => {
            const isin = tickerToIsin[ticker];
            if (!isin) return;

            // Sort chronologically
            monthlyGroup[ticker].sort((a, b) => new Date(a.Date) - new Date(b.Date));

            const monthlyPrices = monthlyGroup[ticker].map(r => r.Price);

            if (!historyMap[isin]) historyMap[isin] = {};
            historyMap[isin]['Monthly_5Y'] = monthlyPrices.join(';');
        });

        // 5. Process Currencies Sheet
        // Mutates the imported static EXCHANGE_RATES object directly. 
        // This instantly feeds fresh exchange rates to the Rebalancer calculations without breaking state contracts.
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
        console.error("Critical error syncronizing multi-sheet portfolio data:", error);
    }
};