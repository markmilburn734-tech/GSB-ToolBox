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
 
import RebalancerView            from './components/RebalancerView';
import PrivateBankRebalancerView from './components/PrivateBankRebalancerView';
import MarketPulseView          from './components/MarketPulseView';
import PerformanceAnalyticsView from './components/PerformanceAnalyticsView';
import PortfoliosView           from './components/PortfoliosView';
import TaxCalculatorView        from './components/TaxCalculatorView';
import IHTCalculatorView        from './components/IHTCalculatorView';
import CashCalView              from './components/CashCalView';
import { TabButton }            from './components/TabButton';
import { GSB, RefreshCw, TrendingUp, PieChart, PoundSign, Check, AlertCircle, Briefcase, DollarSign } from './components/Icons';
 
import { CURRENCY_SYMBOLS } from './constants';
 
import { fetchPortfolioData } from './api';
 
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
    /** @type {[import('./constants').InitialPresets, Function]} */
    const [presets,         setPresets]         = useState({});
    const [charges,         setCharges]         = useState(null);
    /** @type {[import('./constants').ExchangeRateMap, Function]} */
    const [liveRates,       setLiveRates]       = useState({});
    const [isFetchingData,  setIsFetchingData]  = useState(false);
    /** @type {[string[], Function]} */
    const [syncErrors,      setSyncErrors]      = useState([]);
 
    const symbol = CURRENCY_SYMBOLS[activeCurrency] || '$';

    // ── Grouped navigation ─────────────────────────────────────────────────
    // Primary tabs: Rebalancer · Analytics · Calculators. The Analytics and
    // Calculators groups expose sub-tabs and each remembers its last sub-tab.
    const [lastAnalyticsTab, setLastAnalyticsTab] = useState('analytics');
    const [lastCalcTab,      setLastCalcTab]      = useState('tax');
    const [lastRebalTab,     setLastRebalTab]     = useState('rebalancer');

    const REBAL_TABS     = ['rebalancer', 'pbrebalancer'];
    const ANALYTICS_TABS = ['analytics', 'portfolios', 'market'];
    const CALC_TABS      = ['tax', 'IHT', 'cashcal'];
    const activeGroup =
        ANALYTICS_TABS.includes(activeTab) ? 'analytics'
        : CALC_TABS.includes(activeTab)    ? 'calculators'
        : 'rebalancer';

    const goTo = (tab) => {
        setActiveTab(tab);
        if (REBAL_TABS.includes(tab))     setLastRebalTab(tab);
        if (ANALYTICS_TABS.includes(tab)) setLastAnalyticsTab(tab);
        if (CALC_TABS.includes(tab))      setLastCalcTab(tab);
    };

    const SUBTABS = {
        rebalancer: [
            { id: 'rebalancer',   label: 'Standard',     icon: <RefreshCw size={14} /> },
            { id: 'pbrebalancer', label: 'Private Bank', icon: <Briefcase size={14} /> },
        ],
        analytics: [
            { id: 'analytics',  label: 'Analytics',  icon: <PieChart size={14} /> },
            { id: 'portfolios', label: 'Portfolios', icon: <Briefcase size={14} /> },
            { id: 'market',     label: 'Pulse',      icon: <TrendingUp size={14} /> },
        ],
        calculators: [
            { id: 'tax',     label: 'CGT',     icon: <PoundSign size={14} /> },
            { id: 'IHT',     label: 'IHT',     icon: <PoundSign size={14} /> },
            { id: 'cashcal', label: 'CashCal', icon: <DollarSign size={14} /> },
        ],
    };
 
    // ── Data fetch ───────────────────────────────────────────────────────────
    useEffect(() => {
        setIsFetchingData(true);
 
        fetchPortfolioData(({ newPrices, historyMap, liveRates: fetchedRates, presets: fetchedPresets, charges: fetchedCharges, errors }) => {
            setPricesData(newPrices);
            setHistoricalData(historyMap);
            setLiveRates(fetchedRates);
            setPresets(fetchedPresets);
            setCharges(fetchedCharges);
            setSyncErrors(errors);
            setIsFetchingData(false);
        });
    }, []);
 
    // ── Derived / memoised data slices ────────────────────────────────────────
    //
    // Memoised so the currency-keyed slice is only rebuilt when `pricesData`
    // or `activeCurrency` actually change — not on tab switches.
    //
 
    /**
     * Currency-keyed price map: { [currency]: { [ticker]: AssetPrice } }.
     * Consumed by MarketPulseView, TaxCalculatorView and IHTCalculatorView,
     * all of which look up `data[currency]`.
     */
 
    const marketPulseData = useMemo(
        () => selectMarketData(pricesData, activeCurrency),
        [pricesData, activeCurrency],
    );

    // CGT & IHT are UK statutory tools — always GBP, independent of the toggle.
    const gbpMarketData = useMemo(
        () => selectMarketData(pricesData, 'GBP'),
        [pricesData],
    );
 
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
                                    active={activeGroup === 'rebalancer'}
                                    onClick={() => goTo(lastRebalTab)}
                                    icon={<RefreshCw size={16} />}
                                    label="Rebalancer"
                                />
                                <TabButton
                                    active={activeGroup === 'analytics'}
                                    onClick={() => goTo(lastAnalyticsTab)}
                                    icon={<PieChart size={16} />}
                                    label="Analytics"
                                />
                                <TabButton
                                    active={activeGroup === 'calculators'}
                                    onClick={() => goTo(lastCalcTab)}
                                    icon={<DollarSign size={16} />}
                                    label="Calculators"
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

            {/* ── Sub-tab bar (Analytics / Calculators groups) ───────────── */}
            {(activeGroup === 'rebalancer' || activeGroup === 'analytics' || activeGroup === 'calculators') && (
                <div className="bg-white border-b border-gray-200 sticky top-16 z-30 shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-12">
                        {SUBTABS[activeGroup].map((st) => (
                            <button
                                key={st.id}
                                onClick={() => goTo(st.id)}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    activeTab === st.id
                                        ? 'bg-brand6 text-brand'
                                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                                }`}
                            >
                                {st.icon} {st.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
 
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
                {/* Rebalancer stays mounted so entries persist across tab switches */}
                <div className={activeTab === 'rebalancer' ? '' : 'hidden'}>
                    <RebalancerView
                        presets={presets}
                        symbol={symbol}
                        currency={activeCurrency}
                        setActiveCurrency={setActiveCurrency}
                        pricesData={pricesData}
                        liveRates={liveRates}
                    />
                </div>

                {activeTab === 'pbrebalancer' && (
                    <PrivateBankRebalancerView
                        pricesData={pricesData}
                        liveRates={liveRates}
                        charges={charges}
                        currency={activeCurrency}
                    />
                )}
 
                {activeTab === 'market' && (
                    <MarketPulseView
                        data={marketPulseData}
                        historicalData={historicalData}
                        symbol={symbol}
                        currency={activeCurrency}
                    />
                )}
 
                {activeTab === 'analytics' && (
                    <PerformanceAnalyticsView
                        presets={presets}
                        historicalData={historicalData} 
                        symbol={symbol}
                        pricesData={pricesData}         
                        liveRates={liveRates}           
                        currency={activeCurrency}
                    />
                )}
                {activeTab === 'portfolios' && (
                    <PortfoliosView
                        presets={presets}
                        pricesData={pricesData}
                        liveRates={liveRates}
                        currency={activeCurrency}
                        symbol={symbol}
                    />
                )}

                {activeTab === 'tax' && (
                    <TaxCalculatorView
                        symbol="£"
                        currency="GBP"
                        pricesData={gbpMarketData}
                    />
                )}
                {activeTab === 'IHT' && (
                    <IHTCalculatorView
                        symbol="£"
                        currency="GBP"
                        pricesData={gbpMarketData}
                    />
                )}
                {activeTab === 'cashcal' && (
                    <CashCalView
                        symbol={symbol}
                        currency={activeCurrency}
                    />
                )}
            </main>
        </div>
    );
}