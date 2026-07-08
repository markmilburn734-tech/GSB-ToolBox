import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, Plus, DollarSign, TrendingUp, Trash2, ChevronRight, ArrowLeft, Check, X } from './Icons';
import { resolveRate, isCash } from '../constants';
import { GSB } from './Icons';

// Inline SVGs for the new Export/Print actions to ensure they work without modifying your external Icons file
const Download = ({ size = 16, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
);
const Printer = ({ size = 16, className = "" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
);

export default function RebalancerView({ presets, symbol, currency, setActiveCurrency, pricesData, liveRates }) {
    const [cashFlow, setCashFlow] = useState('');
    const [presetModalOpen, setPresetModalOpen] = useState(false);
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [selectionPath, setSelectionPath] = useState({ category: null, currency: null });
    
    // New Engine Controls
    const [directiveFilter, setDirectiveFilter] = useState('ALL'); // 'ALL', 'BUY', 'SELL'
    const [roundingMode, setRoundingMode] = useState('FRACTIONAL'); // 'FRACTIONAL', 'WHOLE'
    
    // Initial State
    const [assets, setAssets] = useState([
        { id: crypto.randomUUID(), name: "iShares Treasury Bond 1-3yr UCITS ETF", isin: "IE00B14X4S71", price: 0, units: 0, target: 20.00, priceOverridden: false },
        { id: crypto.randomUUID(), name: "BlackRock ICS US Dollar Liquidity Fund", isin: "IE0004809582", price: 0, units: 0, target: 19.50, priceOverridden: false },
        { id: crypto.randomUUID(), name: "iShares VII plc Core S&P 500 UCITS ETF Acc USD", isin: "IE00B5BMR087", price: 0, units: 0, target: 34.50, priceOverridden: false },
    ]);

    // Single source of truth for Price + Currency Conversion
    const getLivePrice = (isin, targetCurrency) => {
        // Synthetic cash is valued at par: 1 unit of the displayed currency.
        if (isCash(isin)) return 1;
        if (!isin || isin === "N/A") return 0;
        let foundAsset = null;

        const match = Object.values(pricesData || {}).find(p => p.isin === isin);
        if (match) {
            foundAsset = match;
        }

        if (foundAsset) {
            const sourceCurrency = foundAsset.currency || 'USD';
            if (sourceCurrency === targetCurrency) return foundAsset.price;
            
            const conversionRate = resolveRate(sourceCurrency, targetCurrency, liveRates);
            return parseFloat((foundAsset.price * conversionRate).toFixed(2));
        }
        return 0;
    };

    // Merge a preset's holdings into the current table, preserving any units the
    // user has already entered (matched by ISIN) and their manual price overrides.
    // Holdings the user populated that the new model drops are kept with a 0%
    // target so they still surface as "sell" directives — nothing entered is lost.
    const buildPresetAssets = (items, cur) => {
        const priorByIsin = {};
        assets.forEach(a => {
            const k = (a.isin || '').toUpperCase();
            if (k && k !== 'N/A') priorByIsin[k] = a;
        });
        const used = new Set();

        const merged = items.map(a => {
            const k = (a.isin || '').toUpperCase();
            const prior = (k && k !== 'N/A') ? priorByIsin[k] : null;
            if (prior) used.add(k);
            return {
                id:              prior ? prior.id : crypto.randomUUID(),
                name:            a.name,
                isin:            a.isin,
                price:           (prior && prior.priceOverridden) ? prior.price : getLivePrice(a.isin, cur),
                units:           prior ? prior.units : '',
                target:          a.target,
                priceOverridden: prior ? prior.priceOverridden : false,
            };
        });

        // Carry over holdings the user populated that the new model doesn't include.
        assets.forEach(a => {
            const k = (a.isin || '').toUpperCase();
            const populated = (parseFloat(a.units) || 0) !== 0;
            if (populated && !(k && used.has(k))) merged.push({ ...a, target: 0 });
        });

        return merged;
    };

    // Row Handlers
    const addBlankRow = () => {
        setAssets(prev => [...prev, { id: crypto.randomUUID(), name: "New Asset", isin: "", price: '', units: '', target: '', priceOverridden: false }]);
    };

    const addAssetFromPreset = (asset) => {
        const livePrice = getLivePrice(asset.isin, currency);
        setAssets(prev => [...prev, { 
            id: crypto.randomUUID(), 
            name: asset.name, 
            isin: asset.isin, 
            price: livePrice, 
            units: '', 
            target: '',
            priceOverridden: false
        }]);
        setAddMenuOpen(false);
    };

    const removeRow = (id) => setAssets(prev => prev.filter(a => a.id !== id));

    const handleUpdateAsset = (id, field, value) => {
        setAssets(prev => prev.map(asset => {
            if (asset.id === id) {
                const updated = { ...asset, [field]: value };
                
                // Set price flag if user manually updates the price so useEffect doesn't overwrite it
                if (field === 'price') {
                    updated.priceOverridden = true;
                }
                
                // Attempt to auto-fetch price if a new ISIN is entered
                if (field === 'isin' && value) {
                    const livePrice = getLivePrice(value, currency);
                    if (livePrice > 0 && !asset.priceOverridden) updated.price = livePrice;
                }
                return updated;
            }
            return asset;
        }));
    };

    // Calculations (Safely handling empty string states)
    const totalCurrentValue = useMemo(() => assets.reduce((sum, asset) => sum + ((parseFloat(asset.price) || 0) * (parseFloat(asset.units) || 0)), 0), [assets]);
    const totalWeight = useMemo(() => assets.reduce((sum, asset) => sum + (parseFloat(asset.target) || 0), 0), [assets]);
    const totalNewValue = totalCurrentValue + (parseFloat(cashFlow) || 0);

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-GB', { 
            style: 'currency', 
            currency: currency, 
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        }).format(val || 0);
    };

    // Reverse-lookup a ticker from the price pool by ISIN (rows only store ISIN).
    const tickerForIsin = (isin) => {
        const key = (isin || '').toUpperCase();
        if (!key || key === 'N/A' || isCash(key)) return '';
        const hit = Object.entries(pricesData || {}).find(([, a]) => (a.isin || '').toUpperCase() === key);
        return hit ? hit[0] : '';
    };

    // Margin rounding (ported from the Private Bank rebalancer): buys round DOWN,
    // sells round UP, with a price-banded step (>100 → 1 unit, 50–100 → 2, <50 → 5)
    // so a cash margin is left rather than an overspend.
    const marginIncrement = (price) => {
        const p = parseFloat(price) || 0;
        if (p > 100) return 1;
        if (p >= 50) return 2;
        return 5;
    };
    const marginRound = (raw, price) => {
        if (!isFinite(raw)) return 0;
        const inc = marginIncrement(price);
        return raw >= 0 ? Math.floor(raw / inc) * inc : -Math.ceil(Math.abs(raw) / inc) * inc;
    };

    // Single source of truth for the actionable trade list — used by the on-screen
    // cards, the CSV export and the print receipt so they can never diverge.
    const directives = useMemo(() => {
        return assets.map(asset => {
            const targetPct = (parseFloat(asset.target) || 0) / 100;
            const idealAllocation = totalNewValue * targetPct;
            const currentAllocation = (parseFloat(asset.price) || 0) * (parseFloat(asset.units) || 0);
            const deltaValue = idealAllocation - currentAllocation;
            const assetPrice = parseFloat(asset.price) || 0;
            const deltaUnits = assetPrice > 0 ? deltaValue / assetPrice : 0;
            const isBuy = deltaValue > 0;
            const displayUnits = roundingMode === 'WHOLE'  ? Math.round(deltaUnits)
                               : roundingMode === 'MARGIN' ? marginRound(deltaUnits, assetPrice)
                               : parseFloat(deltaUnits.toFixed(4));
            return { asset, deltaValue, deltaUnits, assetPrice, isBuy, displayUnits };
        }).filter(d => {
            if (Math.abs(d.deltaValue) < 0.01) return false;
            if (directiveFilter === 'BUY' && !d.isBuy) return false;
            if (directiveFilter === 'SELL' && d.isBuy) return false;
            if ((roundingMode === 'WHOLE' || roundingMode === 'MARGIN') && d.displayUnits === 0) return false;
            return true;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assets, totalNewValue, directiveFilter, roundingMode]);

    // Export CSV logic — Fund Name, ISIN, Ticker, BUY/SELL, Units, Amount
    const exportCSV = () => {
        const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
        const rows = [["Fund Name", "ISIN", "Ticker", "BUY/SELL", "Units", `Amount (${currency})`]];
        directives.forEach(d => {
            rows.push([
                esc(d.asset.name),
                d.asset.isin || "MANUAL",
                tickerForIsin(d.asset.isin),
                d.isBuy ? "BUY" : "SELL",
                d.displayUnits,
                Math.abs(d.deltaValue).toFixed(2),
            ]);
        });
        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `rebalance_directives_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Clean, trades-only print receipt (opens a print/PDF window) — mirrors the
    // Private Bank receipt so advisers can record just the actions, not the page.
    const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const printReceipt = () => {
        const when = new Date().toLocaleString('en-GB');
        const buys  = directives.filter(d => d.isBuy).reduce((s, d) => s + Math.abs(d.deltaValue), 0);
        const sells = directives.filter(d => !d.isBuy).reduce((s, d) => s + Math.abs(d.deltaValue), 0);
        const body = directives.map(d => `<tr>
            <td>${escHtml(d.asset.name)}</td>
            <td class="mono">${escHtml(tickerForIsin(d.asset.isin) || d.asset.isin || 'MANUAL')}</td>
            <td class="${d.isBuy ? 'buy' : 'sell'}">${d.isBuy ? 'BUY' : 'SELL'}</td>
            <td class="r mono">${d.isBuy ? '+' : '−'}${Math.abs(d.displayUnits)}</td>
            <td class="r b">${formatCurrency(Math.abs(d.deltaValue))}</td></tr>`).join('');
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rebalance Trades</title><style>
            body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;font-size:12px}
            h1{font-size:18px;margin:0 0 2px} .meta{color:#666;font-size:11px;margin-bottom:16px}
            .sum{display:flex;gap:26px;margin:12px 0 18px} .sum div{font-size:11px;color:#666} .sum b{display:block;color:#111;font-size:14px}
            table{width:100%;border-collapse:collapse} th,td{padding:7px 8px;border-bottom:1px solid #e5e5e5;text-align:left;vertical-align:top}
            th{font-size:9px;text-transform:uppercase;color:#888;letter-spacing:.05em}
            td.r,th.r{text-align:right;font-variant-numeric:tabular-nums} td.b{font-weight:bold} .mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px}
            .buy{color:#059669;font-weight:bold} .sell{color:#dc2626;font-weight:bold}
            .note{color:#999;font-size:10px;margin-top:16px}
            @media print{body{margin:12px}}</style></head><body>
            <h1>Rebalance — Trade Instructions</h1>
            <div class="meta">Base ${escHtml(currency)} &middot; ${when}</div>
            <div class="sum">
              <div>Portfolio value<b>${formatCurrency(totalCurrentValue)}</b></div>
              <div>Post cash flow<b>${formatCurrency(totalNewValue)}</b></div>
              <div>Total buys<b>${formatCurrency(buys)}</b></div>
              <div>Total sells<b>${formatCurrency(sells)}</b></div>
            </div>
            <table><thead><tr><th>Fund Name</th><th>Ticker</th><th>Action</th><th class="r">Units</th><th class="r">Amount</th></tr></thead>
            <tbody>${body || '<tr><td colspan="5">No trades required.</td></tr>'}</tbody></table>
            <div class="note">Estimated instructions for guidance only — verify before dealing.</div>
            </body></html>`;
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 300);
    };

    // Recalculate component pricing hooks when target currency or backend prices refresh (Respecting local overrides)
    useEffect(() => {
        setAssets(prev => prev.map(asset => ({
            ...asset,
            price: asset.priceOverridden ? asset.price : (getLivePrice(asset.isin, currency) || asset.price)
        })));
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                            setAssets(buildPresetAssets(items, selectedCurrency));
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
        <div className="max-w-7xl mx-auto px-4 print:max-w-full print:px-0">
            {/* Page heading */}
            <div className="mb-6 print:hidden">
                <h2 className="font-serif text-2xl font-bold text-gray-900 tracking-tight">Standard Rebalancer</h2>
                <p className="text-sm text-gray-500">Multi-asset rebalance in a single display currency</p>
            </div>
            {/* Top Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/75 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 mb-6 shadow-sm print:hidden">
                <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1 max-w-xs">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Cash Flow Injection</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">{symbol}</span>
                            <input 
                                type="number" 
                                value={cashFlow} 
                                onChange={(e) => setCashFlow(e.target.value)}
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
            <div className="bg-white/75 backdrop-blur-sm rounded-2xl border border-brand shadow-sm overflow-hidden mb-6 print:bg-white print:shadow-none print:border-gray-300">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/70 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider print:bg-transparent">
                                <th className="py-4 px-6 w-1/3">Asset Profile</th>
                                <th className="py-4 px-4">ISIN Identity</th>
                                <th className="py-4 px-4 text-right">Unit Price</th>
                                <th className="py-4 px-4 text-right">Current Units</th>
                                <th className="py-4 px-4 text-right">Current Value</th>
                                <th className="py-4 px-4 text-right w-28">Current %</th>
                                <th className="py-4 px-4 text-center w-32">Target %</th>
                                <th className="py-4 px-6 w-16 print:hidden"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {assets.map((asset) => {
                                const currentValue = (parseFloat(asset.price) || 0) * (parseFloat(asset.units) || 0);
                                const currentWeight = totalCurrentValue > 0 ? (currentValue / totalCurrentValue) * 100 : 0;
                                const targetWeight = parseFloat(asset.target) || 0;
                                const weightDrift = currentWeight - targetWeight;
                                return (
                                    <tr key={asset.id} className="hover:bg-gray-50/40 transition-colors group">
                                        <td className="py-4 px-6">
                                            <input 
                                                type="text" 
                                                value={asset.name} 
                                                onChange={(e) => handleUpdateAsset(asset.id, 'name', e.target.value)}
                                                className="w-full font-semibold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand focus:outline-none py-0.5 print:border-none"
                                            />
                                        </td>
                                        <td className="py-4 px-4">
                                            <input 
                                                type="text" 
                                                value={asset.isin} 
                                                placeholder="Enter ISIN Code"
                                                onChange={(e) => handleUpdateAsset(asset.id, 'isin', e.target.value.toUpperCase())}
                                                className="w-full font-mono text-xs text-gray-500 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand focus:outline-none py-0.5 uppercase print:border-none"
                                            />
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <span className="text-gray-400 font-medium">{symbol}</span>
                                                <input 
                                                    type="number" 
                                                    value={asset.price} 
                                                    placeholder="0.00"
                                                    onChange={(e) => handleUpdateAsset(asset.id, 'price', e.target.value)}
                                                    className={`w-20 text-right font-medium bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand focus:outline-none py-0.5 print:border-none ${asset.priceOverridden ? 'text-brand3' : 'text-gray-600'}`}
                                                />
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <input 
                                                type="number" 
                                                value={asset.units} 
                                                placeholder="0"
                                                onChange={(e) => handleUpdateAsset(asset.id, 'units', e.target.value)}
                                                className="w-24 text-right font-semibold bg-transparent border-b border-transparent hover:border-gray-200 focus:border-brand focus:outline-none py-0.5 print:border-none"
                                            />
                                        </td>
                                        <td className="py-4 px-4 text-right font-bold text-gray-800">
                                            {formatCurrency(currentValue)}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <div className="font-semibold text-gray-700">{currentWeight.toFixed(2)}%</div>
                                            {targetWeight > 0 && (
                                                <div className={`text-[10px] font-bold ${Math.abs(weightDrift) < 0.1 ? 'text-gray-300' : 'text-brand3'}`}>
                                                    {weightDrift >= 0 ? '+' : ''}{weightDrift.toFixed(2)} vs tgt
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center justify-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-100 print:border-none print:bg-transparent">
                                                <input 
                                                    type="number" 
                                                    value={asset.target} 
                                                    placeholder="0.00"
                                                    onChange={(e) => handleUpdateAsset(asset.id, 'target', e.target.value)}
                                                    className="w-14 text-center font-bold bg-transparent text-gray-700 focus:outline-none text-xs print:border-none"
                                                />
                                                <span className="text-xs font-bold text-gray-400">%</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right print:hidden">
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
                <div className="bg-gray-50/50 border-t border-gray-100 px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-sm font-semibold print:bg-transparent print:border-gray-300">
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
                <div className="bg-white/75 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm p-6 animate-in fade-in slide-in-from-bottom-3 duration-200 print:bg-white print:shadow-none print:border-gray-300">
                    
                    {/* Header & Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={18} className="text-brand print:text-gray-800" />
                            <h3 className="font-bold text-gray-900 text-base">Actionable Rebalance Directives</h3>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-3 print:hidden">
                            {/* Directional Filter */}
                            <div className="flex items-center bg-gray-50 p-1 rounded-lg border border-gray-200">
                                {['ALL', 'BUY', 'SELL'].map(mode => (
                                    <button 
                                        key={mode}
                                        onClick={() => setDirectiveFilter(mode)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${directiveFilter === mode ? 'bg-white shadow-sm text-brand border border-gray-200/60' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>

                            {/* Rounding Toggle */}
                            <div className="flex items-center bg-gray-50 p-1 rounded-lg border border-gray-200">
                                <button
                                    onClick={() => setRoundingMode('FRACTIONAL')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${roundingMode === 'FRACTIONAL' ? 'bg-white shadow-sm text-brand border border-gray-200/60' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Fractional
                                </button>
                                <button
                                    onClick={() => setRoundingMode('WHOLE')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${roundingMode === 'WHOLE' ? 'bg-white shadow-sm text-brand border border-gray-200/60' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Whole Units
                                </button>
                                <button
                                    onClick={() => setRoundingMode('MARGIN')}
                                    title="Buys round down, sells round up (leaves a cash margin) — step scales with unit price"
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${roundingMode === 'MARGIN' ? 'bg-white shadow-sm text-brand border border-gray-200/60' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Margin
                                </button>
                            </div>

                            {/* Export / Print Actions */}
                            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                                <button onClick={exportCSV} className="p-2 text-gray-500 hover:text-brand hover:bg-brand6 rounded-lg transition-all" title="Export CSV">
                                    <Download size={18} />
                                </button>
                                <button onClick={printReceipt} className="p-2 text-gray-500 hover:text-brand hover:bg-brand6 rounded-lg transition-all" title="Print / PDF Trades">
                                    <Printer size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {directives.map(({ asset, deltaValue, isBuy, displayUnits }) => {
                            return (
                                <div key={asset.id} className={`p-4 rounded-xl border flex flex-col justify-between transition-all print:break-inside-avoid ${isBuy ? 'bg-emerald-50/30 border-emerald-100 print:border-gray-300' : 'bg-rose-50/20 border-rose-100 print:border-gray-300'}`}>
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="font-bold text-sm text-gray-800 truncate block max-w-[70%]">{asset.name}</span>
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide print:border ${isBuy ? 'bg-emerald-100 text-emerald-700 print:border-emerald-300' : 'bg-rose-100 text-rose-700 print:border-rose-300'}`}>
                                                {isBuy ? 'BUY / INJECT' : 'SELL / TRIM'}
                                            </span>
                                        </div>
                                        <span className="block font-mono text-[10px] text-gray-400 mb-3">{asset.isin || 'MANUAL ASSET'}</span>
                                    </div>
                                    <div className="space-y-1 border-t border-gray-100/60 pt-2 print:border-gray-200">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400 print:text-gray-600">Target Weight Action:</span>
                                            <span className="font-bold text-gray-700">{formatCurrency(Math.abs(deltaValue))}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400 print:text-gray-600">Estimated Shares:</span>
                                            <span className={`font-mono font-bold ${isBuy ? 'text-emerald-600 print:text-gray-900' : 'text-rose-600 print:text-gray-900'}`}>
                                                {isBuy ? '+' : ''}{displayUnits}
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
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 print:hidden">
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