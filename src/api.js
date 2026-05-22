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
            beforeFirstParse: (rawString) => {
                if (!rawString) return rawString;

                // Check if the file is mashed together without standard CSV commas/tabs
                if (!rawString.includes(',') && !rawString.includes('\t')) {
                    console.log("[GSB Tracker] Mashed raw history format detected. Re-formatting grid layout...");

                    const regex = /(0P[A-Z0-9]+(?:\.[A-Z0-9]+)?)(\d{1,2}\/\d{1,2}\/\d{4})(\d+\.\d{4})/gi;
                    let match;
                    const cleanRows = ['Ticker,Date,Price']; 

                    while ((match = regex.exec(rawString)) !== null) {
                        // Keep the full ticker suffix, clean whitespace, and cast uppercase
                        const fullTicker = match[1].trim().toUpperCase();
                        cleanRows.push(`${fullTicker},${match[2]},${match[3]}`);
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
        // 1. Fetch all sheets in parallel
        const [stocksData, dailyHistData, monthlyHistData, currenciesData] = await Promise.all([
            parseSheetPromise(GOOGLE_SHEETS_CSV_URLS.STOCKS),
            parseSheetPromise(GOOGLE_SHEETS_CSV_URLS.DAILY_HIST),
            parseSheetPromise(GOOGLE_SHEETS_CSV_URLS.MONTHLY_HIST),
            parseSheetPromise(GOOGLE_SHEETS_CSV_URLS.CURRENCIES)
        ]);

        const newPrices = {};
        const historyMap = {};

        // 2. Process Stocks Sheet (Using Full Tickers with Suffixes)
        stocksData.forEach(row => {
            if (!row.Currency || !row.Ticker) return;
            
            const tickerKey = String(row.Ticker).trim().toUpperCase();
            const cleanCurrency = String(row.Currency).trim().toUpperCase();

            if (!newPrices[cleanCurrency]) newPrices[cleanCurrency] = {};
            newPrices[cleanCurrency][tickerKey] = {
                price: row.Price,
                isin: row.ISIN ? String(row.ISIN).trim().toUpperCase() : 'N/A',
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
            
            const tickerKey = String(row.Ticker).trim().toUpperCase();
            if (tickerKey === "N/A" || tickerKey === "") return;

            if (!dailyGroup[tickerKey]) dailyGroup[tickerKey] = [];
            dailyGroup[tickerKey].push(row);
        });

        Object.keys(dailyGroup).forEach(ticker => {
            dailyGroup[ticker].sort((a, b) => new Date(a.Date) - new Date(b.Date));
            const dailyPrices = dailyGroup[ticker].map(r => r.Price);

            if (!historyMap[ticker]) historyMap[ticker] = {};
            historyMap[ticker]['Daily_1Y'] = dailyPrices.join(';');

            // Generate Weekly_3Y dynamically (every 5th trading session)
            const weeklyPrices = dailyPrices.filter((_, index) => index % 5 === 0);
            historyMap[ticker]['Weekly_3Y'] = weeklyPrices.join(';');
        });

        // 4. Process Monthly History (Max) -> Generates 'Monthly_5Y'
        const monthlyGroup = {};
        monthlyHistData.forEach(row => {
            if (!row.Ticker || row.Price === undefined || row.Price === null) return;
            
            const tickerKey = String(row.Ticker).trim().toUpperCase();
            if (tickerKey === "N/A" || tickerKey === "") return;

            if (!monthlyGroup[tickerKey]) monthlyGroup[tickerKey] = [];
            monthlyGroup[tickerKey].push(row);
        });

        Object.keys(monthlyGroup).forEach(ticker => {
            monthlyGroup[ticker].sort((a, b) => new Date(a.Date) - new Date(b.Date));
            const monthlyPrices = monthlyGroup[ticker].map(r => r.Price);

            if (!historyMap[ticker]) historyMap[ticker] = {};
            historyMap[ticker]['Monthly_5Y'] = monthlyPrices.join(';');
        });

        // 5. Process Currencies Sheet
        currenciesData.forEach(row => {
            const base = row['Base Currency'] ? String(row['Base Currency']).trim().toUpperCase() : null;
            const target = row['Target Currency'] ? String(row['Target Currency']).trim().toUpperCase() : null;
            const rate = parseFloat(row['Exchange Rate']);
            
            if (!base || !target || isNaN(rate)) return;
            
            if (!EXCHANGE_RATES[base]) EXCHANGE_RATES[base] = {};
            EXCHANGE_RATES[base][target] = rate;
        });

        onComplete({ newPrices, historyMap });

    } catch (error) {
        console.error("Critical error synchronizing multi-sheet portfolio data:", error);
    }
};