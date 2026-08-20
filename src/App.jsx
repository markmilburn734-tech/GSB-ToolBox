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
 
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
 
// Code-split: each view is its own chunk — only the visited tab's bundle loads.
const RebalancerView            = lazy(() => import('./components/RebalancerView'));
const PrivateBankRebalancerView = lazy(() => import('./components/PrivateBankRebalancerView'));
const MarketPulseView           = lazy(() => import('./components/MarketPulseView'));
const PerformanceAnalyticsView  = lazy(() => import('./components/PerformanceAnalyticsView'));
const PortfoliosView            = lazy(() => import('./components/PortfoliosView'));
const TaxCalculatorView         = lazy(() => import('./components/TaxCalculatorView'));
const IHTCalculatorView         = lazy(() => import('./components/IHTCalculatorView'));
const CashCalView               = lazy(() => import('./components/CashCalView'));
const FactFindView              = lazy(() => import('./components/FactFindView'));
const DocumentFormView          = lazy(() => import('./components/DocumentFormView'));
import { TabButton }            from './components/TabButton';
import { GSB, RefreshCw, TrendingUp, PieChart, PoundSign, Check, AlertCircle, Briefcase, DollarSign, ChevronRight, FileText } from './components/Icons';

import { CURRENCY_SYMBOLS } from './constants';
import { DOCUMENT_SCHEMAS, DOCUMENT_TABS, DOCUMENT_TAB_IDS } from './documents';
 
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
    const [curOpen,         setCurOpen]         = useState(false);
    // Tabs visited this session stay mounted (hidden) so their inputs persist
    // across tab switches. A full page refresh clears this (in-memory only).
    const [visited,         setVisited]         = useState({ rebalancer: true });
    // Fact Find data + a "seed token" bumped when the user loads it into the tools.
    const [factFind,        setFactFind]        = useState(null);
    const [factSeed,        setFactSeed]        = useState(0);
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
    const [lastDocTab,       setLastDocTab]       = useState(DOCUMENT_TAB_IDS[0]);

    const REBAL_TABS     = ['rebalancer', 'pbrebalancer'];
    const ANALYTICS_TABS = ['analytics', 'portfolios', 'market'];
    const CALC_TABS      = ['tax', 'IHT', 'cashcal'];
    const activeGroup =
        ANALYTICS_TABS.includes(activeTab)     ? 'analytics'
        : CALC_TABS.includes(activeTab)        ? 'calculators'
        : DOCUMENT_TAB_IDS.includes(activeTab) ? 'documents'
        : activeTab === 'factfind'             ? 'factfind'
        : 'rebalancer';

    const goTo = (tab) => {
        setActiveTab(tab);
        setVisited((v) => (v[tab] ? v : { ...v, [tab]: true }));
        if (REBAL_TABS.includes(tab))         setLastRebalTab(tab);
        if (ANALYTICS_TABS.includes(tab))     setLastAnalyticsTab(tab);
        if (CALC_TABS.includes(tab))          setLastCalcTab(tab);
        if (DOCUMENT_TAB_IDS.includes(tab))   setLastDocTab(tab);
    };

    // Fact Find → seed the tools and jump to Cash Planner so it's visibly populated.
    const applyFactFind = (data) => {
        setFactFind(data);
        setFactSeed((s) => s + 1);
        goTo('cashcal');
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
            { id: 'cashcal', label: 'Cash Planner', icon: <DollarSign size={14} /> },
        ],
        documents: DOCUMENT_TABS.map((t) => ({ ...t, icon: <FileText size={14} /> })),
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
        <div className="min-h-screen bg-brand-tint/40">
            {/* ── GSB brand watermark (fixed, centred behind everything) ─── */}
            <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden flex items-center justify-center">
                <div
                    className="opacity-[0.11]"
                    style={{ filter: 'drop-shadow(0 16px 34px rgba(26,15,31,0.6))' }}
                >
                    <GSB size={720} color="#1f1226" strokeWidth={0.7} />
                </div>
            </div>

            {/* ── Navigation Header (dark purple banner) ─────────────────── */}
            <nav className="sticky top-0 z-40 bg-[#2e1c34]">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">

                        {/* Left: Logo + Tabs */}
                        <div className="flex items-center gap-8">
                            <div className="font-bold text-xl text-white flex items-center gap-2">
                                <GSB size={28} color="#ff3154" />
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
                                <TabButton
                                    active={activeGroup === 'factfind'}
                                    onClick={() => goTo('factfind')}
                                    icon={null}
                                    label="Fact Find"
                                />
                                <TabButton
                                    active={activeGroup === 'documents'}
                                    onClick={() => goTo(lastDocTab)}
                                    icon={<FileText size={16} />}
                                    label="Documents"
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
                                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                    <Check size={14} /> Live
                                </span>
                            )}

                            <div className="relative">
                                <button
                                    onClick={() => setCurOpen((o) => !o)}
                                    aria-label="Display currency"
                                    className="flex items-center gap-2 cursor-pointer bg-transparent border border-white text-white font-bold text-xs rounded-md pl-3 pr-2 py-1.5 outline-none hover:bg-white/5 transition-colors"
                                >
                                    <span>{CURRENCY_SYMBOLS[activeCurrency]}</span> {activeCurrency}
                                    <ChevronRight size={14} className={`text-white/70 transition-transform ${curOpen ? '-rotate-90' : 'rotate-90'}`} />
                                </button>
                                {curOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setCurOpen(false)} />
                                        <div className="absolute right-0 mt-2 w-32 bg-brand-tint rounded-lg border border-brand6/30 shadow-xl p-1 z-20 animate-in fade-in slide-in-from-top-1 duration-150">
                                            {Object.keys(CURRENCY_SYMBOLS).map((curr) => (
                                                <button
                                                    key={curr}
                                                    onClick={() => { setActiveCurrency(curr); setCurOpen(false); }}
                                                    className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-colors ${
                                                        activeCurrency === curr
                                                            ? 'bg-brand6/40 text-brand'
                                                            : 'text-brand/70 hover:bg-brand6/25 hover:text-brand'
                                                    }`}
                                                >
                                                    <span className="w-5 inline-block">{CURRENCY_SYMBOLS[curr]}</span> {curr}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* ── Sub-tab bar (Analytics / Calculators groups) ───────────── */}
            {(activeGroup === 'rebalancer' || activeGroup === 'analytics' || activeGroup === 'calculators' || activeGroup === 'documents') && (
                <div className="bg-white border-b border-gray-200 sticky top-16 z-30 shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 flex items-stretch gap-1 h-12">
                        {SUBTABS[activeGroup].map((st) => (
                            <button
                                key={st.id}
                                onClick={() => goTo(st.id)}
                                className={`flex items-center text-xs font-bold transition-all ${
                                    activeTab === st.id
                                        ? 'bg-[#2e1c34] text-brand3 rounded-b-lg px-4 shadow-md'
                                        : 'my-1.5 rounded-lg px-3.5 text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                                }`}
                            >
                                {st.label}
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
            <main className="relative z-10 py-6">
                {/* Rebalancer stays mounted so entries persist across tab switches */}
                <div className={activeTab === 'rebalancer' ? '' : 'hidden'}>
                    {visited.rebalancer && (
                        <Suspense fallback={<div className="text-center py-24 text-sm text-gray-400">Loading…</div>}>
                            <RebalancerView
                                presets={presets}
                                symbol={symbol}
                                currency={activeCurrency}
                                setActiveCurrency={setActiveCurrency}
                                pricesData={pricesData}
                                liveRates={liveRates}
                            />
                        </Suspense>
                    )}
                </div>

                <div className={activeTab === 'pbrebalancer' ? '' : 'hidden'}>
                    {visited.pbrebalancer && (
                        <Suspense fallback={<div className="text-center py-24 text-sm text-gray-400">Loading…</div>}>
                            <PrivateBankRebalancerView
                                presets={presets}
                                pricesData={pricesData}
                                liveRates={liveRates}
                                charges={charges}
                                currency={activeCurrency}
                            />
                        </Suspense>
                    )}
                </div>
 
                <div className={activeTab === 'market' ? '' : 'hidden'}>
                    {visited.market && (
                        <Suspense fallback={<div className="text-center py-24 text-sm text-gray-400">Loading…</div>}>
                            <MarketPulseView
                                data={marketPulseData}
                                historicalData={historicalData}
                                symbol={symbol}
                                currency={activeCurrency}
                            />
                        </Suspense>
                    )}
                </div>

                <div className={activeTab === 'analytics' ? '' : 'hidden'}>
                    {visited.analytics && (
                        <Suspense fallback={<div className="text-center py-24 text-sm text-gray-400">Loading…</div>}>
                            <PerformanceAnalyticsView
                                presets={presets}
                                historicalData={historicalData}
                                symbol={symbol}
                                pricesData={pricesData}
                                liveRates={liveRates}
                                currency={activeCurrency}
                            />
                        </Suspense>
                    )}
                </div>

                <div className={activeTab === 'portfolios' ? '' : 'hidden'}>
                    {visited.portfolios && (
                        <Suspense fallback={<div className="text-center py-24 text-sm text-gray-400">Loading…</div>}>
                            <PortfoliosView
                                presets={presets}
                                pricesData={pricesData}
                                liveRates={liveRates}
                                currency={activeCurrency}
                                symbol={symbol}
                            />
                        </Suspense>
                    )}
                </div>

                <div className={activeTab === 'tax' ? '' : 'hidden'}>
                    {visited.tax && (
                        <Suspense fallback={<div className="text-center py-24 text-sm text-gray-400">Loading…</div>}>
                            <TaxCalculatorView symbol="£" currency="GBP" pricesData={gbpMarketData} />
                        </Suspense>
                    )}
                </div>

                <div className={activeTab === 'IHT' ? '' : 'hidden'}>
                    {visited.IHT && (
                        <Suspense fallback={<div className="text-center py-24 text-sm text-gray-400">Loading…</div>}>
                            <IHTCalculatorView symbol="£" currency="GBP" pricesData={gbpMarketData} factFind={factFind} factSeed={factSeed} />
                        </Suspense>
                    )}
                </div>

                <div className={activeTab === 'cashcal' ? '' : 'hidden'}>
                    {visited.cashcal && (
                        <Suspense fallback={<div className="text-center py-24 text-sm text-gray-400">Loading…</div>}>
                            <CashCalView symbol={symbol} currency={activeCurrency} factFind={factFind} factSeed={factSeed} />
                        </Suspense>
                    )}
                </div>

                <div className={activeTab === 'factfind' ? '' : 'hidden'}>
                    {visited.factfind && (
                        <Suspense fallback={<div className="text-center py-24 text-sm text-gray-400">Loading…</div>}>
                            <FactFindView symbol={symbol} onApply={applyFactFind} />
                        </Suspense>
                    )}
                </div>

                {/* Completable documents — each writes into its own source PDF and
                    auto-saves to localStorage (the one persistence exception). */}
                {DOCUMENT_TABS.map((tab) => (
                    <div key={tab.id} className={activeTab === tab.id ? '' : 'hidden'}>
                        {visited[tab.id] && (
                            <Suspense fallback={<div className="text-center py-24 text-sm text-gray-400">Loading…</div>}>
                                <DocumentFormView schema={DOCUMENT_SCHEMAS[tab.id]} />
                            </Suspense>
                        )}
                    </div>
                ))}
            </main>
        </div>
    );
}