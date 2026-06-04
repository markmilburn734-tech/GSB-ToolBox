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
        parseSheetPromise(GOOGLE_SHEETS_URLS.CURRENCIES) // Fixed fallback object mapping reference if needed
    ])
    .then(([stocksData, dailyHistData, monthlyHistData, currenciesData]) => {
        
        const newPrices = {};
        const historyMap = {};

        // --- DIAGNOSTIC HEADER TRACKING ---
        // Let's output exactly what your sheet column headers look like to the console
        if (stocksData && stocksData[0]) console.log("[GSB Tracker] Stocks Sheet Headers Found:", Object.keys(stocksData[0]));
        if (dailyHistData && dailyHistData[0]) console.log("[GSB Tracker] Daily History Headers Found:", Object.keys(dailyHistData[0]));

        // 1. Process Stocks Sheet
        stocksData.forEach(row => {
            // Case-insensitive fallbacks for Ticker and Price
            const tickerVal = row.Ticker || row.ticker || row['Ticker Code'];
            const priceVal = row.Price !== undefined ? row.Price : row.price;
            
            if (!tickerVal || priceVal === undefined) return;
            const tickerKey = String(tickerVal).trim().toUpperCase();
            if (tickerKey === "N/A" || tickerKey === "") return;

            newPrices[tickerKey] = {
                price: parseFloat(priceVal),
                isin: row.ISIN ? String(row.ISIN).trim().toUpperCase() : (row.isin ? String(row.isin).trim().toUpperCase() : 'N/A'),
                name: row.Name ? String(row.Name).trim() : (row.name ? String(row.name).trim() : 'Unknown Asset'),
                currency: row.Currency ? String(row.Currency).trim().toUpperCase() : (row.currency ? String(row.currency).trim().toUpperCase() : 'USD'),
                ytd: row['% Off High'] !== undefined ? parseFloat(row['% Off High']) : (row['% off high'] !== undefined ? parseFloat(row['% off high']) : 0),
                ter: row['TER/OCR'] !== undefined ? parseFloat(row['TER/OCR']) : (row['ter'] !== undefined ? parseFloat(row['ter']) : 0),
                volatility: row['Volatility Index'] ? String(row['Volatility Index']).trim() : 'Average'
            };
        });

        // 2. Process Daily History Sheet
        const dailyGroup = {};
        dailyHistData.forEach(row => {
            const tickerVal = row.Ticker || row.ticker || row['Ticker Code'];
            const priceVal = row.Price !== undefined ? row.Price : row.price;

            if (!tickerVal || priceVal === undefined || priceVal === null) return;
            
            const tickerKey = String(tickerVal).trim().toUpperCase();
            if (tickerKey === "N/A" || tickerKey === "") return;

            if (!dailyGroup[tickerKey]) dailyGroup[tickerKey] = [];
            dailyGroup[tickerKey].push({
                Date: row.Date || row.date || row.Timestamp,
                Price: parseFloat(priceVal)
            });
        });

        Object.keys(dailyGroup).forEach(ticker => {
            // Sort chronologically
            dailyGroup[ticker].sort((a, b) => new Date(a.Date) - new Date(b.Date));
            const dailyPrices = dailyGroup[ticker].map(r => r.Price);

            if (!historyMap[ticker]) historyMap[ticker] = {};
            historyMap[ticker]['Daily_1Y'] = dailyPrices.join(';');
        });

        // 3. Process Monthly History Sheet
        const monthlyGroup = {};
        monthlyHistData.forEach(row => {
            const tickerVal = row.Ticker || row.ticker || row['Ticker Code'];
            const priceVal = row.Price !== undefined ? row.Price : row.price;

            if (!tickerVal || priceVal === undefined || priceVal === null) return;
            
            const tickerKey = String(tickerVal).trim().toUpperCase();
            if (tickerKey === "N/A" || tickerKey === "") return;

            if (!monthlyGroup[tickerKey]) monthlyGroup[tickerKey] = [];
            monthlyGroup[tickerKey].push({
                Date: row.Date || row.date || row.Timestamp,
                Price: parseFloat(priceVal)
            });
        });

        Object.keys(monthlyGroup).forEach(ticker => {
            // Sort chronologically
            monthlyGroup[ticker].sort((a, b) => new Date(a.Date) - new Date(b.Date));
            const monthlyPrices = monthlyGroup[ticker].map(r => r.Price);

            if (!historyMap[ticker]) historyMap[ticker] = {};
            historyMap[ticker]['Monthly_5Y'] = monthlyPrices.join(';');
        });

        // 4. Process Currencies Sheet
        if (currenciesData && Array.isArray(currenciesData)) {
            currenciesData.forEach(row => {
                const base = row['Base Currency'] || row['base currency'] || row['Base'];
                const target = row['Target Currency'] || row['target currency'] || row['Target'];
                const rateVal = row['Exchange Rate'] || row['exchange rate'] || row['Rate'];
                const rate = parseFloat(rateVal);
                
                if (!base || !target || isNaN(rate)) return;
                
                const baseKey = String(base).trim().toUpperCase();
                const targetKey = String(target).trim().toUpperCase();

                if (!EXCHANGE_RATES[baseKey]) EXCHANGE_RATES[baseKey] = {};
                EXCHANGE_RATES[baseKey][targetKey] = rate;
            });
        }

        console.log("[GSB Tracker] Successfully parsed all sheets. Registered keys:", Object.keys(historyMap));
        onComplete({ newPrices, historyMap });

    })
    .catch(err => {
        console.error("[GSB Tracker] Fatal error loading remote configuration assets:", err);
    });
}