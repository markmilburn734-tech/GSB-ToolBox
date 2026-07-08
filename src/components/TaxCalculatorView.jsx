import React, { useState, useMemo } from 'react';
import { Plus, Trash2, TrendingUp, DollarSign, GSB } from './Icons'; // Assuming these are standard across your app

export default function TaxCalculatorView({ symbol = "£", currency = "GBP", pricesData = {} }) {
    // --- State Management ---
    const [income, setIncome] = useState(30000);
    const [allowanceUsed, setAllowanceUsed] = useState(0);
    const [isJoint, setIsJoint] = useState(false);
    const [addMenuOpen, setAddMenuOpen] = useState(false);

    const TAX_CONSTANTS = {
        LR_TAX: 0.18,
        HR_TAX: 0.24,
        BASE_ALLOWANCE: 3000,
        BASIC_RATE_LMT: 50270,
        PERS_ALLOW: 12570,
        MARKET_BUFFER: 0.005 
    };
    
    // Initial Asset State
    const [assets, setAssets] = useState([]);

    // --- Derived Values ---
    const maxAllowancePossible = isJoint ? (TAX_CONSTANTS.BASE_ALLOWANCE * 2) : TAX_CONSTANTS.BASE_ALLOWANCE;

    // --- Calculation Engine ---
    const results = useMemo(() => {
        const breakdown = assets.map(a => {
            const bufferedSellPrice = a.currentPrice * (1 + TAX_CONSTANTS.MARKET_BUFFER);
            const totalGain = (bufferedSellPrice - a.ogPrice) * a.units;
            return { ...a, totalGain, bufferedSellPrice };
        });

        // Joint Filing doubles Personal Allowance and Basic Rate Limits
        const multiplier = isJoint ? 2 : 1;
        const activePersAllow = TAX_CONSTANTS.PERS_ALLOW * multiplier;
        const activeBasicRateLmt = TAX_CONSTANTS.BASIC_RATE_LMT * multiplier;
        const activeBaseAllowance = TAX_CONSTANTS.BASE_ALLOWANCE * multiplier;

        const remainingAllowance = Math.max(0, activeBaseAllowance - allowanceUsed);
        const totalGain = breakdown.reduce((sum, a) => sum + a.totalGain, 0);
        const taxableGain = Math.max(0, totalGain - remainingAllowance);

        const taxableIncome = Math.max(0, income - activePersAllow);
        const unusedBasicBand = Math.max(0, activeBasicRateLmt - taxableIncome);

        const gainsAtLR = Math.min(taxableGain, unusedBasicBand);
        const gainsAtHR = Math.max(0, taxableGain - gainsAtLR);

        const taxOwed = (gainsAtLR * TAX_CONSTANTS.LR_TAX) + (gainsAtHR * TAX_CONSTANTS.HR_TAX);
        const avgtax = taxableGain > 0 ? (taxOwed / taxableGain) * 100 : 0;

        return { 
            breakdown, 
            totalGain, 
            taxableAmount: taxableGain, 
            taxOwed,
            remainingAllowance,
            avgtax
        };
    }, [assets, income, allowanceUsed, isJoint]);

    // --- Formatters ---
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-GB', { 
            style: 'currency', 
            currency: currency, 
            maximumFractionDigits: 0,
            minimumFractionDigits: 0
        }).format(val || 0);
    };

    // --- Handlers ---
    const handleUpdateAsset = (id, field, value) => {
        setAssets(prev => prev.map(a => 
            a.id === id ? { ...a, [field]: field === 'name' || field === 'isin' ? value : (parseFloat(value) || 0) } : a
        ));
    };

    const addBlankRow = () => {
        if (assets.length >= 5) return;
        setAssets(prev => [...prev, { id: Date.now(), name: "New Asset", isin: "", units: 0, ogPrice: 0, currentPrice: 0 }]);
        setAddMenuOpen(false);
    };

    const addExistingAsset = (asset) => {
        if (assets.length >= 5) return;
        setAssets(prev => [...prev, { 
            id: Date.now(), 
            name: asset.name, 
            isin: asset.isin,
            units: 0, 
            ogPrice: asset.price, 
            currentPrice: asset.price 
        }]);
        setAddMenuOpen(false);
    };

    const removeRow = (id) => setAssets(prev => prev.filter(a => a.id !== id));

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 relative animate-in fade-in">
            {/* Header Section */}
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="font-serif text-2xl font-bold text-gray-900 tracking-tight">CGT Estimator</h1>
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider">UK · GBP</span>
                    </div>
                    <p className="text-gray-500 ml-1">2024/25 Logic • 0.5% Market Volatility Buffer • UK rules, figures in GBP</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col min-w-[200px]">
                    <label className="text-xs font-bold uppercase text-gray-400 mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Estimated Tax Owed
                    </label>
                    <span className="text-3xl font-mono font-bold text-brand3 tracking-tight">
                        {formatCurrency(results.taxOwed)}
                    </span>
                </div>
            </header>

            {/* Inputs & Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Income Input */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Gross Annual Income</label>
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <span className="font-bold text-lg">{symbol}</span>
                        </div>
                        <input 
                            type="number" 
                            value={income} 
                            onChange={(e) => setIncome(e.target.value)}
                            className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-lg outline-none focus:border-brand/30 transition-colors"
                        />
                    </div>
                </div>

                {/* Allowance Slider */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <label className="block text-sm font-medium text-gray-700">Allowance Used</label>
                        <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded text-sm">
                            {formatCurrency(allowanceUsed)}
                        </span>
                    </div>
                    <input 
                        type="range"
                        min="0"
                        max={maxAllowancePossible}
                        step="50"
                        value={allowanceUsed > maxAllowancePossible ? maxAllowancePossible : allowanceUsed}
                        onChange={(e) => setAllowanceUsed(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-3 font-bold uppercase tracking-wider">
                        <span>Min: 0</span>
                        <span>Max: {formatCurrency(maxAllowancePossible)}</span>
                    </div>
                </div>

                {/* Joint Filing Toggle */}
                <div className="bg-brand p-6 rounded-2xl shadow-lg border border-brand2 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white/90">Joint Filing Status</span>
                        <button 
                            onClick={() => {
                                const next = !isJoint;
                                setIsJoint(next);
                                if(!next && allowanceUsed > 3000) setAllowanceUsed(3000);
                            }}
                            className={`w-12 h-6 rounded-full transition-all duration-300 relative ${isJoint ? 'bg-brand3' : 'bg-white/20'}`}
                        >
                            <div className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${isJoint ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                    <div className="mt-4 border-t border-white/10 pt-4">
                        <p className="text-[10px] text-white/60 uppercase font-bold tracking-widest mb-1">Net CGT Allowance</p>
                        <p className="text-2xl font-mono font-bold text-white leading-none">
                            {formatCurrency(results.remainingAllowance)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Middle Control Bar */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                <div className="flex gap-8 w-full md:w-auto">
                    <div>
                        <span className="block text-xs font-bold uppercase text-gray-400 mb-1">Total Buffered Gain</span>
                        <span className="text-xl font-semibold text-gray-900">{formatCurrency(results.totalGain)}</span>
                    </div>
                    <div>
                        <span className="block text-xs font-bold uppercase text-gray-400 mb-1">Taxable Portion</span>
                        <span className="text-xl font-semibold text-gray-900">{formatCurrency(results.taxableAmount)}</span>
                    </div>
                    <div>
                        <span className="block text-xs font-bold uppercase text-gray-400 mb-1">Effective Rate</span>
                        <span className="text-xl font-semibold text-brand3">{results.avgtax.toFixed(1)}%</span>
                    </div>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto relative">
                    <div className="px-5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-500">Assets: {assets.length}/5</span>
                    </div>
                    <div className="relative flex-1 min-w-[160px]">
                        <button 
                            onClick={() => setAddMenuOpen(!addMenuOpen)} 
                            disabled={assets.length >= 5}
                            className="w-full justify-center bg-brand hover:bg-brand2 text-white px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4" /> Add Asset
                        </button>

                        {addMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
                                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden animate-in zoom-in-95 duration-100 origin-top-right">
                                    <button onClick={addBlankRow} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100">
                                        <div className="bg-gray-100 p-1.5 rounded-lg text-gray-500"><Plus className="w-4 h-4" /></div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">Blank Asset</p>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-tight">Manual Entry</p>
                                        </div>
                                    </button>
                                    <div className="max-h-64 overflow-y-auto">
                                        <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase bg-gray-50/50 sticky top-0 backdrop-blur-sm">Quick Add ({currency})</div>
                                        {Object.values(pricesData[currency] || {}).map((asset) => (
                                            <button 
                                                key={asset.isin} 
                                                onClick={() => addExistingAsset(asset)}
                                                className="w-full text-left px-4 py-2.5 hover:bg-brand6/10 transition-colors group flex flex-col"
                                            >
                                                <span className="text-xs font-bold text-gray-700 group-hover:text-brand truncate">{asset.name}</span>
                                                <span className="flex justify-between w-full mt-1">
                                                    <span className="text-[10px] text-gray-400 font-mono">{asset.isin}</span>
                                                    <span className="text-[10px] text-brand3 font-mono">{symbol}{asset.price.toFixed(2)}</span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Table Workspace */}
            <div className="bg-white rounded-2xl shadow-sm border border-brand overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">Asset / ISIN</th>
                                <th className="px-4 py-4 w-32">Units</th>
                                <th className="px-4 py-4 w-32">Buy Price ({symbol})</th>
                                <th className="px-4 py-4 w-32">Current ({symbol})</th>
                                <th className="px-6 py-4 text-right">Estimated Gain</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.breakdown.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                                        Portfolio is empty. Add an asset to estimate CGT.
                                    </td>
                                </tr>
                            ) : (
                                results.breakdown.map((asset) => (
                                    <tr key={asset.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <input 
                                                    type="text" 
                                                    value={asset.name} 
                                                    onChange={(e) => handleUpdateAsset(asset.id, 'name', e.target.value)} 
                                                    className="bg-transparent font-bold text-gray-800 outline-none w-full" 
                                                    placeholder="Asset Name"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => removeRow(asset.id)} className="text-gray-300 hover:text-brand3 transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <input 
                                                        type="text" 
                                                        value={asset.isin} 
                                                        onChange={(e) => handleUpdateAsset(asset.id, 'isin', e.target.value)} 
                                                        className="bg-transparent text-[10px] text-gray-400 uppercase tracking-widest outline-none w-full" 
                                                        placeholder="ISIN/TICKER"
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <input 
                                                type="number" 
                                                step="0.0001" 
                                                value={asset.units} 
                                                onChange={(e) => handleUpdateAsset(asset.id, 'units', e.target.value)} 
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono shadow-sm focus:border-brand/30 outline-none" 
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                value={asset.ogPrice} 
                                                onChange={(e) => handleUpdateAsset(asset.id, 'ogPrice', e.target.value)} 
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono shadow-sm focus:border-brand/30 outline-none" 
                                            />
                                        </td>
                                        <td className="px-4 py-4">
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                value={asset.currentPrice} 
                                                onChange={(e) => handleUpdateAsset(asset.id, 'currentPrice', e.target.value)} 
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono shadow-sm focus:border-brand/30 outline-none" 
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`block font-bold text-lg ${asset.totalGain >= 0 ? 'text-emerald-600' : 'text-brand3'}`}>
                                                {formatCurrency(asset.totalGain)}
                                            </span>
                                            <span className="text-[10px] text-gray-400">Net Return</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}