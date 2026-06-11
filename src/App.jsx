// ─────────────────────────────────────────────────────────────────────────────
// App.jsx
//
// KEY CHANGES vs. original:
//   1. BUG FIX: `Missing pricesData={pricesData}` → `pricesData={pricesData}`
//   2. `liveRates` is now App-level state, returned by fetchPortfolioData and
//      passed down (or exposed via context) — constants.js is never mutated.
//   3. `useMemo` selectors isolate per-currency data slices so child views
//      (RebalancerView, PerformanceAnalyticsView) only recalculate when
//      `pricesData` or `activeCurrency` actually change, not on tab switches.
//   4. Partial-failure banner surfaces API errors without blocking the UI.
//   5. Removed unused `Papa` import (parsing lives entirely in api.js).
// ─────────────────────────────────────────────────────────────────────────────
 
import React, { useState, useEffect, useMemo } from 'react';
 
import RebalancerView           from './components/RebalancerView';
import MarketPulseView          from './components/MarketPulseView';
import PerformanceAnalyticsView from './components/PerformanceAnalyticsView';
import TaxCalculatorView        from './components/TaxCalculatorView';
import IHTCalculatorView        from './components/IHTCalculatorView';
import { TabButton }            from './components/TabButton';
import { GSB, RefreshCw, TrendingUp, PieChart, PoundSign, Check, AlertCircle } from './components/Icons';
 
import {
    INITIAL_PRESETS,
    CURRENCY_SYMBOLS,
} from './constants';
 
import { fetchPortfolioData } from './api';
import IHTCalculatorView from './components/IHTCalculatorView';
 
// ─── Currency-aware data selector ────────────────────────────────────────────
//
// Filters the flat `pricesData` map down to only the assets denominated in
// `currency`, then re-keys them under that currency for MarketPulseView's
// expected shape: { [currency]: { [ticker]: AssetPrice } }.
//
// Because this is inside a `useMemo`, it only re-runs when pricesData or
// activeCurrency changes — NOT when the user switches tabs.
//
/**
 * @param {import('./constants').PricesData} pricesData
 * @param {string} currency
 * @returns {{ [currency: string]: { [ticker: string]: import('./constants').AssetPrice } }}
 */
function selectMarketData(pricesData, currency) {
    const filtered = {};
    Object.entries(pricesData).forEach(([ticker, asset]) => {
        if (asset.currency === currency) {
            filtered[ticker] = asset;
        }
    });
    return { [currency]: filtered };
}
 
// ─── Component ───────────────────────────────────────────────────────────────
 
export default function App() {
    // ── Core state ───────────────────────────────────────────────────────────
    const [activeTab,       setActiveTab]       = useState('rebalancer');
    const [activeCurrency,  setActiveCurrency]  = useState('USD');
    const [pricesData,      setPricesData]      = useState({});
    const [historicalData,  setHistoricalData]  = useState({});
    /** @type {[import('./constants').ExchangeRateMap, Function]} */
    const [liveRates,       setLiveRates]       = useState({});
    const [isFetchingData,  setIsFetchingData]  = useState(false);
    /** @type {[string[], Function]} */
    const [syncErrors,      setSyncErrors]      = useState([]);
 
    const symbol = CURRENCY_SYMBOLS[activeCurrency] || '$';
 
    // ── Data fetch ───────────────────────────────────────────────────────────
    useEffect(() => {
        setIsFetchingData(true);
 
        fetchPortfolioData(({ newPrices, historyMap, liveRates: fetchedRates, errors }) => {
            setPricesData(newPrices);
            setHistoricalData(historyMap);
            setLiveRates(fetchedRates);
            setSyncErrors(errors);
            setIsFetchingData(false);
        });
    }, []);
 
    // ── Derived / memoised data slices ────────────────────────────────────────
    //
    // These memos ensure that RebalancerView and PerformanceAnalyticsView do
    // not re-execute their heavy calculations when only `activeTab` changes.
    //
 
    /**
     * Flat list of prices for the active currency — used by RebalancerView.
     * Shape is the same as `pricesData` so the child doesn't need changes.
     */
    const pricesForCurrency = useMemo(() => {
        const out = {};
        Object.entries(pricesData).forEach(([ticker, asset]) => {
            if (asset.currency === activeCurrency) out[ticker] = asset;
        });
        return out;
    }, [pricesData, activeCurrency]);
 
    /**
     * MarketPulseView expects { [currency]: { [ticker]: AssetPrice } }.
     */
    const marketPulseData = useMemo(
        () => selectMarketData(pricesData, activeCurrency),
        [pricesData, activeCurrency],
    );
 
    /**
     * History slice — same shape as historicalData, but filtered to tickers
     * that exist in the active currency's price set (avoids passing the entire
     * history map down to analytics on every render).
     */
    const historyForCurrency = useMemo(() => {
        const relevantTickers = new Set(Object.keys(pricesForCurrency));
        const out = {};
        Object.entries(historicalData).forEach(([ticker, hist]) => {
            if (relevantTickers.has(ticker)) out[ticker] = hist;
        });
        return out;
    }, [historicalData, pricesForCurrency]);
 
    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50">
            {/* ── Navigation Header ──────────────────────────────────────── */}
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
 
                        {/* Left: Logo + Tabs */}
                        <div className="flex items-center gap-8">
                            <div className="font-bold text-xl text-gray-900 flex items-center gap-2">
                                <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white">
                                    <GSB size={20} color="white" />
                                </div>
                                GSB Toolbox
                            </div>
 
                            <div className="flex h-full gap-4">
                                <TabButton
                                    active={activeTab === 'rebalancer'}
                                    onClick={() => setActiveTab('rebalancer')}
                                    icon={<RefreshCw size={16} />}
                                    label="Rebalance"
                                />
                                <TabButton
                                    active={activeTab === 'market'}
                                    onClick={() => setActiveTab('market')}
                                    icon={<TrendingUp size={16} />}
                                    label="Pulse"
                                />
                                <TabButton
                                    active={activeTab === 'analytics'}
                                    onClick={() => setActiveTab('analytics')}
                                    icon={<PieChart size={16} />}
                                    label="Analytics"
                                />
                                <TabButton
                                    active={activeTab === 'tax'}
                                    onClick={() => setActiveTab('tax')}
                                    icon={<PoundSign size={16} />}
                                    label="Tax"
                                />
                                 <TabButton
                                    active={activeTab === 'IHT'}
                                    onClick={() => setActiveTab('IHT')}
                                    icon={<PoundSign size={16} />}
                                    label="IHT"
                                />
                            </div>
                        </div>
 
                        {/* Right: Sync status + Currency toggles */}
                        <div className="flex items-center gap-4">
                            {isFetchingData ? (
                                <span className="text-xs font-bold text-brand3 flex items-center gap-1 animate-pulse">
                                    <RefreshCw size={12} /> Syncing Data…
                                </span>
                            ) : (
                                <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                                    <Check size={14} /> Live
                                </span>
                            )}
 
                            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                                {Object.keys(CURRENCY_SYMBOLS).map((curr) => (
                                    <button
                                        key={curr}
                                        onClick={() => setActiveCurrency(curr)}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                            activeCurrency === curr
                                                ? 'bg-white text-brand shadow-sm'
                                                : 'text-gray-400'
                                        }`}
                                    >
                                        {curr}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
 
            {/* ── Partial-failure banner ─────────────────────────────────── */}
            {!isFetchingData && syncErrors.length > 0 && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
                    <div className="max-w-7xl mx-auto flex items-start gap-2 text-amber-700 text-xs">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>
                            <strong>Some data sources failed to load.</strong>{' '}
                            Displaying partial or cached data where available.{' '}
                            {syncErrors.join(' · ')}
                        </span>
                    </div>
                </div>
            )}
 
            {/* ── Main Viewport ──────────────────────────────────────────── */}
            <main className="py-6">
                {activeTab === 'rebalancer' && (
                    <RebalancerView
                        presets={INITIAL_PRESETS}
                        symbol={symbol}
                        currency={activeCurrency}
                        setActiveCurrency={setActiveCurrency}
                        pricesData={pricesData}
                        liveRates={liveRates}
                    />
                )}
 
                {activeTab === 'market' && (
                    <MarketPulseView
                        data={marketPulseData}
                        symbol={symbol}
                        currency={activeCurrency}
                    />
                )}
 
                {activeTab === 'analytics' && (
                    <PerformanceAnalyticsView
                        presets={INITIAL_PRESETS}
                        historicalData={historicalData} 
                        symbol={symbol}
                        pricesData={pricesData}         
                        liveRates={liveRates}           
                        currency={activeCurrency}
                    />
                )}
                {activeTab === 'tax' && (
                    <TaxCalculatorView symbol={symbol} />
                )}
                {activeTab === 'IHT' && (
                    <IHTCalculatorView symbol={symbol} />
                )}
            </main>
        </div>
    );
}