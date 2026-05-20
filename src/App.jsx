import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

// Component Imports
import RebalancerView from './components/RebalancerView';
import MarketPulseView from './components/MarketPulseView';
import PerformanceAnalyticsView from './components/PerformanceAnalyticsView';
import TaxCalculatorView from './components/TaxCalculatorView';
import { TabButton } from './components/TabButton'; // If you move the helper button
import { GSB, RefreshCw, TrendingUp, PieChart, PoundSign, Check } from './components/Icons';

// Constants Import
import { 
    INITIAL_PRESETS, 
    BAKED_PRICES, 
    CURRENCY_SYMBOLS, 
    GOOGLE_SHEETS_CSV_URL 
} from './constants';

import { fetchPortfolioData } from './api';

export default function App() {
    // 1. Core State Management
    const [activeTab, setActiveTab] = useState('rebalancer');
    const [activeCurrency, setActiveCurrency] = useState('USD');
    const [pricesData, setPricesData] = useState(BAKED_PRICES);
    const [isFetchingData, setIsFetchingData] = useState(false);
    const [historicalData, setHistoricalData] = useState({});
    
    const symbol = CURRENCY_SYMBOLS[activeCurrency] || '$';



// Inside App component:
useEffect(() => {
    setIsFetchingData(true);
    fetchPortfolioData(({ newPrices, historyMap }) => {
        setPricesData(newPrices);
        setHistoricalData(historyMap);
        setIsFetchingData(false);
    });
}, []);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation Header[cite: 1] */}
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-8">
                            <div className="font-bold text-xl text-gray-900 flex items-center gap-2">
                                <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white">
                                    <GSB size={20} color="white" />
                                </div>
                                GSB Toolbox
                            </div>
                            <div className="flex h-full gap-4">
                                <TabButton active={activeTab === 'rebalancer'} onClick={() => setActiveTab('rebalancer')} icon={<RefreshCw size={16}/>} label="Rebalance" />
                                <TabButton active={activeTab === 'market'} onClick={() => setActiveTab('market')} icon={<TrendingUp size={16}/>} label="Pulse" />
                                <TabButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} icon={<PieChart size={16}/>} label="Analytics" />
                                <TabButton active={activeTab === 'tax'} onClick={() => setActiveTab('tax')} icon={<PoundSign size={16}/>} label="Tax" />
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Sync Status Indicator[cite: 1] */}
                            {isFetchingData ? (
                                <span className="text-xs font-bold text-brand3 flex items-center gap-1 animate-pulse">
                                    <RefreshCw size={12} /> Syncing Data...
                                </span>
                            ) : (
                                <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                                    <Check size={14} /> Live
                                </span>
                            )}

                            {/* Currency Toggles[cite: 1] */}
                            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                                {Object.keys(CURRENCY_SYMBOLS).map(curr => (
                                    <button 
                                        key={curr}
                                        onClick={() => setActiveCurrency(curr)}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${activeCurrency === curr ? 'bg-white text-brand shadow-sm' : 'text-gray-400'}`}
                                    >
                                        {curr}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Viewport Routing[cite: 1] */}
            <main className="py-6">
                {activeTab === 'rebalancer' && (
                    <RebalancerView 
                        presets={INITIAL_PRESETS} 
                        symbol={symbol} 
                        currency={activeCurrency} 
                        setActiveCurrency={setActiveCurrency} 
                        pricesData={pricesData} 
                    />
                )}
                {activeTab === 'market' && (
                    <MarketPulseView 
                        data={pricesData} 
                        symbol={symbol} 
                        currency={activeCurrency} 
                    />
                )}
                {activeTab === 'analytics' && (
                    <PerformanceAnalyticsView 
                        presets={INITIAL_PRESETS} 
                        historicalData={historicalData} 
                        symbol={symbol} 
                    />
                )}
                {activeTab === 'tax' && (
                    <TaxCalculatorView symbol={symbol} />
                )} 
            </main>
        </div>
    );
}