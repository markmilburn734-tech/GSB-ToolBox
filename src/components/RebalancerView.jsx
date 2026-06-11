import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, Plus, DollarSign, TrendingUp, Trash2, ChevronRight, ArrowLeft, Check, X } from './Icons';
import { resolveRate } from '../constants';
import { GSB } from './Icons';

export default function RebalancerView({ presets, symbol, currency, setActiveCurrency, pricesData, liveRates }) {
    const [cashFlow, setCashFlow] = useState(0);
    const [presetModalOpen, setPresetModalOpen] = useState(false);
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [selectionPath, setSelectionPath] = useState({ category: null, currency: null });
    
    // Initial State
    const [assets, setAssets] = useState([
        { id: 1, name: "iShares Treasury Bond 1-3yr UCITS ETF", isin: "IE00B14X4S71", price: 0, units: 0, target: 20.00 },
        { id: 2, name: "BlackRock ICS US Dollar Liquidity Fund", isin: "IE0004809582", price: 0, units: 0, target: 19.50 },
        { id: 3, name: "iShares VII plc Core S&P 500 UCITS ETF Acc USD", isin: "IE00B5BMR087", price: 0, units: 0, target: 34.50 },
    ]);

    // Single source of truth for Price + Currency Conversion
    const getLivePrice = (isin, targetCurrency) => {
        if (!isin || isin === "N/A") return 0;

        let foundAsset = null;

        // Search through the flat pricesData structure across all available records
        const match = Object.values(pricesData || {}).find(p => p.isin === isin);
        if (match) {
            foundAsset = match;
        }

        if (foundAsset) {
            const sourceCurrency = foundAsset.currency || 'USD';
            if (sourceCurrency === targetCurrency) return foundAsset.price;
            
            // Safe live dynamic evaluation fallback
            const conversionRate = resolveRate(sourceCurrency, targetCurrency, liveRates);
            return parseFloat((foundAsset.price * conversionRate).toFixed(2));
        }
        return 0;
    };

    // Row Handlers
    const addBlankRow = () => {
        setAssets(prev => [...prev, { id: Date.now(), name: "New Asset", isin: "", price: 0, units: 0, target: 0 }]);
    };

    const addAssetFromPreset = (asset) => {
        const livePrice = getLivePrice(asset.isin, currency);
        setAssets(prev => [...prev, { 
            id: Date.now(), 
            name: asset.name, 
            isin: asset.isin, 
            price: livePrice, 
            units: 0, 
            target: 0 
        }]);
        setAddMenuOpen(false);
    };

    const removeRow = (id) => setAssets(prev => prev.filter(a => a.id !== id));

    const handleUpdateAsset = (id, field, value) => {
        setAssets(prev => prev.map(asset => {
            if (asset.id === id) {
                const updated = { ...asset, [field]: value };
                if (field === 'isin' && value) {
                    const livePrice = getLivePrice(value, currency);
                    if (livePrice > 0) updated.price = livePrice;
                }
                return updated;
            }
            return asset;
        }));
    };

    // Calculations
    const totalCurrentValue = useMemo(() => assets.reduce((sum, asset) => sum + (Number(asset.price || 0) * Number(asset.units || 0)), 0), [assets]);
    const totalWeight = useMemo(() => assets.reduce((sum, asset) => sum + Number(asset.target || 0), 0), [assets]);
    const totalNewValue = totalCurrentValue + (parseFloat(cashFlow) || 0);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-GB', { 
            style: 'currency', 
            currency: currency, 
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        }).format(val);
    };

    // Recalculate component pricing hooks when the target currency or backend prices refresh
    useEffect(() => {
        setAssets(prev => prev.map(asset => ({
            ...asset,
            price: getLivePrice(asset.isin, currency) || asset.price
        })));
    }, [currency, pricesData, liveRates]);

    const renderModalContent = () => {
        const { category, currency: selectedCurrency } = selectionPath;
        if (!category) {
            return (
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Select Strategy</h4>
                    {Object.keys(presets).map(cat => (
                        <button key={cat} onClick={() => setSelectionPath(p => ({...p, category: cat}))} className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-brand5 hover:bg-brand6 transition-all group text-left">
                            <span className="font-medium text-gray-700 group-hover:text-brand2">{cat}</span>
                            <ChevronRight size={18} className="text-gray-400 group-hover:text-brand2 transition-transform group-hover:translate-x-1" />
                        </button>
                    ))}
                </div>
            );
        }

        if (!selectedCurrency) {
            return (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                        <button onClick={() => setSelectionPath(p => ({...p, category: null}))} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                            <ArrowLeft size={16} />
                        </button>
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Select Currency</h4>
                    </div>
                    {Object.keys(presets[category]).map(curr => (
                        <button key={curr} onClick={() => setSelectionPath(p => ({...p, currency: curr}))} className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-brand5 hover:bg-brand6 transition-all group text-left">
                            <span className="font-medium text-gray-700 group-hover:text-brand2">{curr}</span>
                            <ChevronRight size={18} className="text-gray-400 group-hover:text-brand2 transition-transform group-hover:translate-x-1" />
                        </button>
                    ))}
                </div>
            );
        }

        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setSelectionPath(p => ({...p, currency: null}))} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                        <ArrowLeft size={16} />
                    </button>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{category} ({selectedCurrency})</h4>
                </div>
                <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
                    {Object.entries(presets[category][selectedCurrency]).map(([profileName, items]) => (
                        <button key={profileName} onClick={() => {
                            const newAssets = items.map(a => ({
                                id: Math.random(),
                                name: a.name,
                                isin: a.isin,
                                price: getLivePrice(a.isin, selectedCurrency),
                                units: 0,
                                target: a.target
                            }));
                            setAssets(newAssets);
                            setPresetModalOpen(false);
                            if (setActiveCurrency) setActiveCurrency(selectedCurrency);
                        }} className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 hover:border-brand3 hover:ring-1 hover:ring-brand3 rounded-xl text-left transition-all group">
                            <div>
                                <span className="block font-medium text-gray-800 group-hover:text-brand3">{profileName}</span>
                                <span className="text-xs text-gray-400">{items.length} assets</span>
                            </div>
                            <ChevronRight size={18} className="text-gray-400 group-hover:text-brand3" />
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-4">
            {/* Top Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 mb-6 shadow-sm">
                <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-brand6 rounded-xl flex items-center justify-center text-brand">
                        <DollarSign size={24} />
                    </div>
                    <div className="flex-1 max-w-xs">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Cash Flow Injection</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">{symbol}</span>
                            <input 
                                type="number" 
                                value={cashFlow || ''} 
                                onChange={(e) => setCashFlow(parseFloat(e.target.value) || 0)}
                                placeholder="0.00" 
                                className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-brand"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => { setSelectionPath({ category: null, currency: null }); setPresetModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all shadow-sm">
                        <BookOpen size={16} /> Load Preset Strategy
                    </button>
                    <div className="relative">
                        <button onClick={() => setAddMenuOpen(!addMenuOpen)} className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand2 transition-all shadow-sm shadow-brand/10">
                            <Plus size={16} /> Add Asset
                        </button>
                        {addMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
                                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-xl p-2 z-20 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                                    <button onClick={() => { addBlankRow(); setAddMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-gray-50 rounded-lg flex items-center gap-2 text-gray-700">
                                        <Plus size={14} /> Blank Manual Entry
                                    </button>
                                    <div className="border-t border-gray-100 my-1" />
                                    <div className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">Quick Add From Data Pool</div>
                                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                                        {Object.entries(pricesData || {}).map(([ticker, asset]) => (
                                            <button key={ticker} onClick={() => addAssetFromPreset({ name: asset.name, isin: asset.isin })} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 rounded-md flex flex-col truncate">
                                                <span className="font-semibold text-gray-700 truncate">{asset.name}</span>
                                                <span className="text-[10px] text-gray-400 font-mono">{ticker} · {asset.isin}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Asset Allocation Matrix */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/70 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                <th className="py-4 px-6 w-1/3">Asset Profile</th>
                                <th className="py-4 px-4">ISIN Identity</th>
                                <th className="py-4 px-4 text-right">Unit Price</th>
                                <th className="py-4 px-4 text-right">Current Units</th>
                                <th className="py-4 px-4 text-right">Current Value</th>
                                <th className="py-4 px-4 text-center w-32">Target %</th>
                                <th className="py-4 px-6 w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {assets.map((asset) => {
                                const currentValue = Number(asset.price || 0) * Number(asset.units || 0);
                                return (
                                    <tr key={asset.id} className="hover:bg-gray-50/40 transition-colors group">
                                        <td className="py-4 px-6">
                                            <input 
                                                type="text" 
                                                value={asset.name} 
                                                onChange={(e) => handleUpdateAsset(asset.id, 'name', e.target.value)}
                                                className="w-full font-semibold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand focus:outline-none py-0.5"
                                            />
                                        </td>
                                        <td className="py-4 px-4">
                                            <input 
                                                type="text" 
                                                value={asset.isin} 
                                                placeholder="Enter ISIN Code"
                                                onChange={(e) => handleUpdateAsset(asset.id, 'isin', e.target.value.toUpperCase())}
                                                className="w-full font-mono text-xs text-gray-500 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand focus:outline-none py-0.5 uppercase"
                                            />
                                        </td>
                                        <td className="py-4 px-4 text-right font-medium text-gray-600">
                                            {formatCurrency(asset.price)}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <input 
                                                type="number" 
                                                value={asset.units || ''} 
                                                placeholder="0"
                                                onChange={(e) => handleUpdateAsset(asset.id, 'units', parseFloat(e.target.value) || 0)}
                                                className="w-24 text-right font-semibold bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand focus:outline-none py-0.5"
                                            />
                                        </td>
                                        <td className="py-4 px-4 text-right font-bold text-gray-800">
                                            {formatCurrency(currentValue)}
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center justify-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-100">
                                                <input 
                                                    type="number" 
                                                    value={asset.target || ''} 
                                                    placeholder="0.00"
                                                    onChange={(e) => handleUpdateAsset(asset.id, 'target', parseFloat(e.target.value) || 0)}
                                                    className="w-14 text-center font-bold bg-transparent text-gray-700 focus:outline-none text-xs"
                                                />
                                                <span className="text-xs font-bold text-gray-400">%</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <button onClick={() => removeRow(asset.id)} className="p-1 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                                                <Trash2 size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer Summary Rows */}
                <div className="bg-gray-50/50 border-t border-gray-100 px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-sm font-semibold">
                    <div className="flex items-center gap-6">
                        <div className="text-gray-500">
                            Portfolio Value: <span className="text-gray-900 font-bold ml-1">{formatCurrency(totalCurrentValue)}</span>
                        </div>
                        <div className="text-gray-500">
                            Post Cash Flow Total: <span className="text-brand font-extrabold ml-1">{formatCurrency(totalNewValue)}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs uppercase tracking-wider font-bold">Target Weight Integrity:</span>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 ${Math.abs(totalWeight - 100) < 0.01 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {totalWeight.toFixed(2)}% {Math.abs(totalWeight - 100) < 0.01 ? <Check size={12} /> : <X size={12} />}
                        </span>
                    </div>
                </div>
            </div>

            {/* Rebalancing Strategy Engine */}
            {totalWeight > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-in fade-in slide-in-from-bottom-3 duration-200">
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-4">
                        <TrendingUp size={18} className="text-brand" />
                        <h3 className="font-bold text-gray-900 text-base">Actionable Rebalance Directives</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {assets.map((asset) => {
                            const targetPct = (asset.target || 0) / 100;
                            const idealAllocation = totalNewValue * targetPct;
                            const currentAllocation = Number(asset.price || 0) * Number(asset.units || 0);
                            const deltaValue = idealAllocation - currentAllocation;
                            const deltaUnits = asset.price > 0 ? deltaValue / asset.price : 0;

                            if (Math.abs(deltaValue) < 0.01) return null;

                            const isBuy = deltaValue > 0;

                            return (
                                <div key={asset.id} className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${isBuy ? 'bg-emerald-50/30 border-emerald-100' : 'bg-rose-50/20 border-rose-100'}`}>
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="font-bold text-sm text-gray-800 truncate block max-w-[70%]">{asset.name}</span>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${isBuy ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {isBuy ? 'BUY / INJECT' : 'SELL / TRIM'}
                                            </span>
                                        </div>
                                        <span className="block font-mono text-[10px] text-gray-400 mb-3">{asset.isin || 'MANUAL ASSET'}</span>
                                    </div>
                                    <div className="space-y-1 border-t border-gray-100/60 pt-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400">Target Weight Action:</span>
                                            <span className="font-bold text-gray-700">{formatCurrency(Math.abs(deltaValue))}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400">Estimated Shares:</span>
                                            <span className={`font-mono font-bold ${isBuy ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {isBuy ? '+' : ''}{deltaUnits.toFixed(4)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Strategic Prescription Selection Modal */}
            {presetModalOpen && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-brand rounded-lg flex items-center justify-center text-white">
                                    <GSB size={14} color="white" />
                                </div>
                                <h3 className="font-bold text-gray-900 text-sm">GSB Asset Presets</h3>
                            </div>
                            <button onClick={() => setPresetModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-6">
                            {renderModalContent()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}