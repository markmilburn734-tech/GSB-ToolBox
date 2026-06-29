import React, { useState, useMemo } from 'react';
import { Plus, Trash2, TrendingUp, DollarSign, GSB } from './Icons'; // Core application layout icons

export default function IHTCalculatorView({ symbol = "£", currency = "GBP", pricesData = {} }) {
    // --- State Management ---
    const [allowanceUsed, setAllowanceUsed] = useState(0); // Lifetime gifts or previously consumed NRB
    const [isJoint, setIsJoint] = useState(false);
    const [addMenuOpen, setAddMenuOpen] = useState(false);

    // Centralised Enterprise Tax Configuration Boundaries (2024/25 - 2026 Rules)
    const IHT_CONSTANTS = {
        IHT_RATE: 0.40,               // Standard Inheritance Tax Rate (40%)
        NIL_RATE_BAND: 325000,        // Core NRB Threshold Baseline
        RESIDENCE_NIL_RATE_BAND: 175000, // Main residence property relief top-up
        MARKET_BUFFER: 0.00           // Baseline calculation vector multiplier
    };
    
    // Initial Asset State Pool (Maximum 5 items matching your grid bounds)
    const [assets, setAssets] = useState([]);

    // --- Derived Boundaries ---
    const maxNRBPossible = isJoint ? (IHT_CONSTANTS.NIL_RATE_BAND * 2) : IHT_CONSTANTS.NIL_RATE_BAND;
    const maxRNRBPossible = isJoint ? (IHT_CONSTANTS.RESIDENCE_NIL_RATE_BAND * 2) : IHT_CONSTANTS.RESIDENCE_NIL_RATE_BAND;

    // --- Core Relational Calculation Engine ---
    const results = useMemo(() => {
        // Step 1: Flatten active asset parameters and resolve specific relief rates sequentially
        const breakdown = assets.map(a => {
            const rawValue = a.currentPrice * a.units;
            
            // Adjust calculations if asset is marked as Exempt or carries Business Relief vectors
            let reliefApplied = 0;
            if (a.ihtStatus === 'Exempt') {
                reliefApplied = rawValue;
            } else if (a.ihtStatus === 'Business Relief') {
                reliefApplied = rawValue * (a.reliefRate / 100);
            }
            
            const taxableValue = Math.max(0, rawValue - reliefApplied);
            return { ...a, rawValue, reliefApplied, taxableValue };
        });

        // Step 2: Scale thresholds dynamically using structural multiplier states
        const multiplier = isJoint ? 2 : 1;
        const activeNRB = IHT_CONSTANTS.NIL_RATE_BAND * multiplier;
        const activeRNRB = IHT_CONSTANTS.RESIDENCE_NIL_RATE_BAND * multiplier;

        // Step 3: Compute gross allocations vs. estate reliefs on the fly
        const totalGrossEstate = breakdown.reduce((sum, a) => sum + a.rawValue, 0);
        const totalReliefsClaimed = breakdown.reduce((sum, a) => sum + a.reliefApplied, 0);
        const netEstateBeforeBands = breakdown.reduce((sum, a) => sum + a.taxableValue, 0);

        // Step 4: Absorb allowances dynamically based on previous user slider consumption parameters
        const remainingNRB = Math.max(0, activeNRB - allowanceUsed);
        
        // Combine NRB & RNRB allowances to derive final chargeable metrics
        const totalAvailableBands = remainingNRB + activeRNRB;
        const netChargeableEstate = Math.max(0, netEstateBeforeBands - totalAvailableBands);

        // Step 5: Execute final tax application sweeps
        const taxOwed = netChargeableEstate * IHT_CONSTANTS.IHT_RATE;
        const effectiveRate = totalGrossEstate > 0 ? (taxOwed / totalGrossEstate) * 100 : 0;

        return { 
            breakdown, 
            totalGrossEstate, 
            totalReliefsClaimed,
            netChargeableEstate, 
            taxOwed,
            remainingAllowance: remainingNRB,
            activeRNRB,
            effectiveRate
        };
    }, [assets, allowanceUsed, isJoint]);

    // --- Multi-Currency Formatting Hook Wrapper ---
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-GB', { 
            style: 'currency', 
            currency: currency, 
            maximumFractionDigits: 0,
            minimumFractionDigits: 0
        }).format(val || 0);
    };

    // --- Action Lifecycle Handlers ---
    const handleUpdateAsset = (id, field, value) => {
        setAssets(prev => prev.map(a => {
            if (a.id !== id) return a;
            
            // Safe fallback evaluation filters protecting string parameters from numeric conversions
            if (field === 'name' || field === 'isin' || field === 'ihtStatus') {
                return { ...a, [field]: value };
            }
            return { ...a, [field]: parseFloat(value) || 0 };
        }));
    };

    const addBlankRow = () => {
        if (assets.length >= 5) return;
        setAssets(prev => [...prev, { 
            id: Date.now(), 
            name: "New Estate Asset", 
            isin: "", 
            units: 1, 
            currentPrice: 0,
            ihtStatus: "Subject to IHT",
            reliefRate: 0 
        }]);
        setAddMenuOpen(false);
    };

    const addExistingAsset = (asset) => {
        if (assets.length >= 5) return;
        
        // Auto-assign smart default exemption classifications based on common platform asset types
        let defaultStatus = "Subject to IHT";
        let defaultRelief = 0;
        
        if (asset.name?.toUpperCase().includes('SIPP') || asset.name?.toUpperCase().includes('PENSION')) {
            defaultStatus = "Exempt";
            defaultRelief = 100;
        } else if (asset.name?.toUpperCase().includes('AIM')) {
            defaultStatus = "Business Relief";
            defaultRelief = 100;
        }

        setAssets(prev => [...prev, { 
            id: Date.now(), 
            name: asset.name, 
            isin: asset.isin,
            units: 1, 
            currentPrice: asset.price,
            ihtStatus: defaultStatus,
            reliefRate: defaultRelief 
        }]);
        setAddMenuOpen(false);
    };

    const removeRow = (id) => setAssets(prev => prev.filter(a => a.id !== id));

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 relative animate-in fade-in">
            {/* Header Module Section */}
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="bg-brand p-2 rounded-lg">
                            <GSB className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">IHT Estimator</h1>
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider">UK · GBP</span>
                    </div>
                    <p className="text-gray-500 ml-1">2024/25 - 2026 Logic Center • 40% Estate Tax Bracket • UK rules, figures in GBP</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col min-w-[200px]">
                    <label className="text-xs font-bold uppercase text-gray-400 mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Estimated Estate Tax Owed
                    </label>
                    <span className="text-3xl font-mono font-bold text-brand3 tracking-tight">
                        {formatCurrency(results.taxOwed)}
                    </span>
                </div>
            </header>

            {/* Parameter Input Controls Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Personal Nil-Rate Band Allowance Used Slider */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 col-span-1 md:col-span-2">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">NRB Allowance Already Used</label>
                            <p className="text-xs text-gray-400">Lifetime gifts made within 7 years of death</p>
                        </div>
                        <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded text-sm">
                            {formatCurrency(allowanceUsed)}
                        </span>
                    </div>
                    <input 
                        type="range"
                        min="0"
                        max={maxNRBPossible}
                        step="1000"
                        value={allowanceUsed > maxNRBPossible ? maxNRBPossible : allowanceUsed}
                        onChange={(e) => setAllowanceUsed(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-3 font-bold uppercase tracking-wider">
                        <span>Min: {symbol}0</span>
                        <span>Max Avail: {formatCurrency(maxNRBPossible)}</span>
                    </div>
                </div>

                {/* Relational Joint Marital Filing Toggle State */}
                <div className="bg-brand p-6 rounded-2xl shadow-lg border border-brand2 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-sm font-medium text-white/90 block">Joint Marital Status</span>
                            <span className="text-[11px] text-white/60">Combines and transfers unused thresholds</span>
                        </div>
                        <button 
                            onClick={() => {
                                const next = !isJoint;
                                setIsJoint(next);
                                if(!next && allowanceUsed > IHT_CONSTANTS.NIL_RATE_BAND) {
                                    setAllowanceUsed(IHT_CONSTANTS.NIL_RATE_BAND);
                                }
                            }}
                            className={`w-12 h-6 rounded-full transition-all duration-300 relative ${isJoint ? 'bg-brand3' : 'bg-white/20'}`}
                        >
                            <div className={`absolute top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${isJoint ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                    <div className="mt-4 border-t border-white/10 pt-4 flex justify-between gap-2">
                        <div>
                            <p className="text-[10px] text-white/60 uppercase font-bold tracking-widest mb-1">Net Base NRB</p>
                            <p className="text-xl font-mono font-bold text-white leading-none">
                                {formatCurrency(results.remainingAllowance)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-white/60 uppercase font-bold tracking-widest mb-1">Active RNRB</p>
                            <p className="text-xl font-mono font-bold text-white leading-none">
                                {formatCurrency(results.activeRNRB)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Central Analytical Summary Dashboard Bar */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                <div className="grid grid-cols-2 md:flex md:gap-8 w-full md:w-auto gap-4">
                    <div>
                        <span className="block text-xs font-bold uppercase text-gray-400 mb-1">Total Gross Assets</span>
                        <span className="text-xl font-semibold text-gray-900">{formatCurrency(results.totalGrossEstate)}</span>
                    </div>
                    <div>
                        <span className="block text-xs font-bold uppercase text-gray-400 mb-1">Reliefs / Exemptions</span>
                        <span className="text-xl font-semibold text-emerald-600">-{formatCurrency(results.totalReliefsClaimed)}</span>
                    </div>
                    <div>
                        <span className="block text-xs font-bold uppercase text-gray-400 mb-1">Net Chargeable Estate</span>
                        <span className="text-xl font-semibold text-gray-900">{formatCurrency(results.netChargeableEstate)}</span>
                    </div>
                    <div>
                        <span className="block text-xs font-bold uppercase text-gray-400 mb-1">Effective Tax Rate</span>
                        <span className="text-xl font-semibold text-brand3">{results.effectiveRate.toFixed(1)}%</span>
                    </div>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto relative justify-end">
                    <div className="px-5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-500">Asset Rows: {assets.length}/5</span>
                    </div>
                    <div className="relative min-w-[160px]">
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
                                            <p className="text-sm font-bold text-gray-800">Blank Estate Asset</p>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-tight">Manual Asset Parameters</p>
                                        </div>
                                    </button>
                                    <div className="max-h-64 overflow-y-auto">
                                        <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase bg-gray-50/50 sticky top-0 backdrop-blur-sm">Sync Workbook Asset ({currency})</div>
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

            {/* Primary Interactive Table Workspace Grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">Asset Classification Details</th>
                                <th className="px-4 py-4 w-28">Units / Mult</th>
                                <th className="px-4 py-4 w-36">Asset Value ({symbol})</th>
                                <th className="px-4 py-4 w-48">IHT Status Classification</th>
                                <th className="px-4 py-4 w-28">Relief %</th>
                                <th className="px-6 py-4 text-right">Taxable Exposure</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.breakdown.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">
                                        Estate register footprint is empty. Append lines to evaluate aggregate IHT.
                                    </td>
                                </tr>
                            ) : (
                                results.breakdown.map((asset) => (
                                    <tr key={asset.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                        {/* Name / Identifier Fields */}
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <input 
                                                    type="text" 
                                                    value={asset.name} 
                                                    onChange={(e) => handleUpdateAsset(asset.id, 'name', e.target.value)} 
                                                    className="bg-transparent font-bold text-gray-800 outline-none w-full" 
                                                    placeholder="e.g., Main Residence Property"
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
                                                        placeholder="ISIN/TICKER REF"
                                                    />
                                                </div>
                                            </div>
                                        </td>

                                        {/* Multiplier / Volume Field */}
                                        <td className="px-4 py-4">
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                value={asset.units} 
                                                onChange={(e) => handleUpdateAsset(asset.id, 'units', e.target.value)} 
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono shadow-sm focus:border-brand/30 outline-none" 
                    />
                                        </td>

                                        {/* Unit Price Field */}
                                        <td className="px-4 py-4">
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                value={asset.currentPrice} 
                                                onChange={(e) => handleUpdateAsset(asset.id, 'currentPrice', e.target.value)} 
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono shadow-sm focus:border-brand/30 outline-none" 
                                            />
                                        </td>

                                        {/* Relational Dropdown Mapping for IHT Logic Switches */}
                                        <td className="px-4 py-4">
                                            <select
                                                value={asset.ihtStatus}
                                                onChange={(e) => {
                                                    const status = e.target.value;
                                                    handleUpdateAsset(asset.id, 'ihtStatus', status);
                                                    // Automatically inject default relief structures when switching status options
                                                    if (status === 'Exempt') handleUpdateAsset(asset.id, 'reliefRate', 100);
                                                    if (status === 'Subject to IHT') handleUpdateAsset(asset.id, 'reliefRate', 0);
                                                    if (status === 'Business Relief') handleUpdateAsset(asset.id, 'reliefRate', 100);
                                                }}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 outline-none focus:border-brand/30 transition-colors"
                                            >
                                                <option value="Subject to IHT">Subject to IHT (Full)</option>
                                                <option value="Business Relief">Business Relief (BR)</option>
                                                <option value="Exempt">Exempt (Pensions/Spouse)</option>
                                            </select>
                                        </td>

                                        {/* Variable Relief Scaling Input Field */}
                                        <td className="px-4 py-4">
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    max="100"
                                                    disabled={asset.ihtStatus === 'Subject to IHT' || asset.ihtStatus === 'Exempt'}
                                                    value={asset.reliefRate} 
                                                    onChange={(e) => handleUpdateAsset(asset.id, 'reliefRate', e.target.value)} 
                                                    className="w-full bg-white border border-gray-200 rounded-lg pl-2 pr-6 py-1.5 text-sm font-mono shadow-sm focus:border-brand/30 outline-none disabled:bg-gray-100 disabled:text-gray-400" 
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                                            </div>
                                        </td>

                                        {/* Row Output Exposure Evaluation Result */}
                                        <td className="px-6 py-4 text-right">
                                            <span className={`block font-bold text-lg ${asset.taxableValue > 0 ? 'text-brand3' : 'text-gray-400'}`}>
                                                {formatCurrency(asset.taxableValue)}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                Gross: {formatCurrency(asset.rawValue)}
                                            </span>
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