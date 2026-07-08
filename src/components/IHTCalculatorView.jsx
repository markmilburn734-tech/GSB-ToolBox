import React, { useState, useMemo } from 'react';
import { Plus, Trash2, TrendingUp, GSB } from './Icons';
import { IHT, giftTaperMultiplier } from '../constants';

export default function IHTCalculatorView({ symbol = '£', currency = 'GBP', pricesData = {} }) {
    const [assets, setAssets]     = useState([]);
    const [gifts, setGifts]       = useState([]);
    const [policies, setPolicies] = useState([]);
    const [charity, setCharity]   = useState(0);

    const [married, setMarried]         = useState(false);
    const [tnrbPct, setTnrbPct]         = useState(100);   // % of spouse's unused NRB transferred
    const [trnrbPct, setTrnrbPct]       = useState(100);   // % of spouse's unused RNRB transferred
    const [claimRNRB, setClaimRNRB]     = useState(true);
    const [pensionInEstate, setPension] = useState(false); // Apr-2027 rule
    const [addMenuOpen, setAddMenuOpen] = useState(false);

    // ── Calculation engine ────────────────────────────────────────────────────
    const results = useMemo(() => {
        const activeNRB = IHT.NRB  * (1 + (married ? (parseFloat(tnrbPct)  || 0) : 0) / 100);
        const baseRNRB  = claimRNRB ? IHT.RNRB * (1 + (married ? (parseFloat(trnrbPct) || 0) : 0) / 100) : 0;

        // Assets → reliefs / exemptions
        const breakdown = assets.map(a => {
            const rawValue = (parseFloat(a.currentPrice) || 0) * (parseFloat(a.units) || 0);
            let reliefApplied = 0;
            if (a.ihtStatus === 'Exempt') reliefApplied = rawValue;                                  // spouse etc.
            else if (a.ihtStatus === 'Pension') reliefApplied = pensionInEstate ? 0 : rawValue;      // exempt until Apr-2027
            else if (a.ihtStatus === 'Business Relief') reliefApplied = rawValue * ((parseFloat(a.reliefRate) || 0) / 100);
            return { ...a, rawValue, reliefApplied, taxableValue: Math.max(0, rawValue - reliefApplied) };
        });
        const totalGrossEstate      = breakdown.reduce((s, a) => s + a.rawValue, 0);
        const totalReliefsClaimed   = breakdown.reduce((s, a) => s + a.reliefApplied, 0);
        const netEstateAfterReliefs = breakdown.reduce((s, a) => s + a.taxableValue, 0);

        // Life assurance
        const inTrustCover  = policies.filter(p =>  p.inTrust).reduce((s, p) => s + (parseFloat(p.sumAssured) || 0), 0);
        const nonTrustCover = policies.filter(p => !p.inTrust).reduce((s, p) => s + (parseFloat(p.sumAssured) || 0), 0);
        const chargeablePreCharity = netEstateAfterReliefs + nonTrustCover;

        // RNRB with £2m taper
        const estateForTaper = totalGrossEstate + nonTrustCover;
        const effectiveRNRB  = Math.max(0, baseRNRB - Math.max(0, (estateForTaper - IHT.TAPER_THRESHOLD) / 2));
        const taperReduction = baseRNRB - effectiveRNRB;

        // Failed PETs (<7y): net of exemptions, oldest first consume NRB, taper relief on tax
        const activeGifts = gifts
            .map(g => ({ ...g, chargeable: Math.max(0, (parseFloat(g.amount) || 0) - (parseFloat(g.exempt) || 0)), yearsAgo: parseFloat(g.yearsAgo) || 0 }))
            .filter(g => g.yearsAgo < 7 && g.chargeable > 0)
            .sort((a, b) => b.yearsAgo - a.yearsAgo);
        let nrbRemaining = activeNRB;
        let giftTax = 0;
        const giftRows = activeGifts.map(g => {
            const useNRB = Math.min(nrbRemaining, g.chargeable);
            nrbRemaining -= useNRB;
            const taxable = g.chargeable - useNRB;
            const tm = giftTaperMultiplier(g.yearsAgo);
            const tax = taxable * IHT.RATE * tm;
            giftTax += tax;
            return { id: g.id, taxable, taperReliefPct: (1 - tm) * 100, tax };
        });
        const estateNRB = nrbRemaining;
        const bands = estateNRB + effectiveRNRB;

        // Charitable legacy (exempt) + 36% reduced-rate test (≥10% of the baseline)
        const charityAmt = Math.min(parseFloat(charity) || 0, chargeablePreCharity);
        const baseline = Math.max(0, chargeablePreCharity - bands);
        const charityQualifies = charityAmt > 0 && charityAmt >= 0.10 * baseline;
        const estateRate = charityQualifies ? 0.36 : IHT.RATE;

        const netChargeableEstate = Math.max(0, chargeablePreCharity - charityAmt - bands);
        const estateTax = netChargeableEstate * estateRate;

        const taxOwed = estateTax + giftTax;
        const coverSurplus = Math.max(0, inTrustCover - taxOwed);
        const shortfall    = Math.max(0, taxOwed - inTrustCover);
        const effectiveRate = totalGrossEstate > 0 ? (taxOwed / totalGrossEstate) * 100 : 0;

        return {
            breakdown, totalGrossEstate, totalReliefsClaimed, netChargeableEstate,
            taxOwed, estateTax, giftTax, giftRows, effectiveRate, estateRate, charityQualifies, baseline, charityAmt,
            activeNRB, estateNRB, baseRNRB, effectiveRNRB, taperReduction,
            inTrustCover, nonTrustCover, shortfall, coverSurplus,
        };
    }, [assets, gifts, policies, charity, married, tnrbPct, trnrbPct, claimRNRB, pensionInEstate]);

    const fmt = (v) => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v || 0);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const updateAsset = (id, field, value) => setAssets(prev => prev.map(a => a.id !== id ? a
        : { ...a, [field]: (field === 'name' || field === 'isin' || field === 'ihtStatus') ? value : (parseFloat(value) || 0) }));
    const addBlankRow = () => { if (assets.length < 10) setAssets(p => [...p, { id: Date.now(), name: 'New Estate Asset', isin: '', units: 1, currentPrice: 0, ihtStatus: 'Subject to IHT', reliefRate: 0 }]); setAddMenuOpen(false); };
    const addExistingAsset = (asset) => {
        if (assets.length >= 10) return;
        let status = 'Subject to IHT', relief = 0;
        const nm = asset.name?.toUpperCase() || '';
        if (nm.includes('SIPP') || nm.includes('PENSION')) status = 'Pension';
        else if (nm.includes('AIM')) { status = 'Business Relief'; relief = 100; }
        setAssets(p => [...p, { id: Date.now(), name: asset.name, isin: asset.isin, units: 1, currentPrice: asset.price, ihtStatus: status, reliefRate: relief }]);
        setAddMenuOpen(false);
    };
    const removeRow = (id) => setAssets(p => p.filter(a => a.id !== id));

    const addGift = () => setGifts(p => [...p, { id: Date.now(), desc: 'Gift', amount: 0, exempt: 0, yearsAgo: 0 }]);
    const updGift = (id, f, v) => setGifts(p => p.map(g => g.id === id ? { ...g, [f]: f === 'desc' ? v : (parseFloat(v) || 0) } : g));
    const delGift = (id) => setGifts(p => p.filter(g => g.id !== id));

    const addPolicy = () => setPolicies(p => [...p, { id: Date.now(), provider: 'Life policy', sumAssured: 0, type: 'Whole of Life', termYears: 20, inTrust: true }]);
    const updPolicy = (id, f, v) => setPolicies(p => p.map(pl => pl.id === id ? { ...pl, [f]: v } : pl));
    const delPolicy = (id) => setPolicies(p => p.filter(pl => pl.id !== id));

    const Toggle = ({ on, onClick }) => (
        <button onClick={onClick} className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${on ? 'bg-brand3' : 'bg-gray-200'}`}>
            <div className={`absolute top-1 bg-white/75 backdrop-blur-smw-4 h-4 rounded-full transition-transform shadow-sm ${on ? 'left-6' : 'left-1'}`} />
        </button>
    );

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 relative animate-in fade-in">
            {/* Header */}
            <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="font-serif text-2xl font-bold text-gray-900 tracking-tight">IHT Estimator</h1>
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider">UK · GBP</span>
                    </div>
                    <p className="text-gray-500 ml-1">£2m RNRB taper · 7-yr gift taper · transferable bands · charity 36% · pension (2027) · life cover</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-white/75 backdrop-blur-smp-5 rounded-xl shadow-sm border border-gray-200 flex flex-col min-w-[170px]">
                        <label className="text-xs font-bold uppercase text-gray-400 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Estimated IHT</label>
                        <span className="text-3xl font-mono font-bold text-brand3 tracking-tight">{fmt(results.taxOwed)}</span>
                        {results.charityQualifies && <span className="text-[10px] text-emerald-600 font-bold mt-1">36% charity rate applied</span>}
                    </div>
                    <div className={`p-5 rounded-xl shadow-sm border flex flex-col min-w-[170px] ${results.shortfall > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                        <label className="text-xs font-bold uppercase text-gray-400 mb-1">After life cover</label>
                        <span className={`text-3xl font-mono font-bold tracking-tight ${results.shortfall > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{results.shortfall > 0 ? fmt(results.shortfall) : 'Covered ✓'}</span>
                        {results.inTrustCover > 0 && <span className="text-[10px] text-gray-400 mt-1">In-trust cover {fmt(results.inTrustCover)}</span>}
                    </div>
                </div>
            </header>

            {/* Assumptions & allowances */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="bg-white/75 backdrop-blur-smp-6 rounded-2xl shadow-sm border border-gray-200 lg:col-span-2 space-y-4">
                    <h3 className="text-sm font-bold text-gray-800">Reliefs & assumptions</h3>
                    <div className="flex items-center justify-between">
                        <div><span className="text-sm font-semibold text-gray-700">Married / transferable bands</span><p className="text-[11px] text-gray-400">Include a deceased spouse's unused allowances (second death)</p></div>
                        <Toggle on={married} onClick={() => setMarried(v => !v)} />
                    </div>
                    {married && (
                        <div className="grid grid-cols-2 gap-3 pl-1">
                            <label className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-600">Transfer NRB
                                <span className="relative w-20"><input type="number" min="0" max="100" value={tnrbPct} onChange={(e) => setTnrbPct(parseFloat(e.target.value) || 0)} className="w-full pl-2 pr-5 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span></span></label>
                            <label className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-600">Transfer RNRB
                                <span className="relative w-20"><input type="number" min="0" max="100" value={trnrbPct} onChange={(e) => setTrnrbPct(parseFloat(e.target.value) || 0)} className="w-full pl-2 pr-5 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span></span></label>
                        </div>
                    )}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                        <div><span className="text-sm font-semibold text-gray-700">Residence to direct descendants</span><p className="text-[11px] text-gray-400">Required to claim the residence nil-rate band</p></div>
                        <Toggle on={claimRNRB} onClick={() => setClaimRNRB(v => !v)} />
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                        <div><span className="text-sm font-semibold text-gray-700">Pensions in estate (from Apr 2027)</span><p className="text-[11px] text-gray-400">Treats “Pension” assets as chargeable, not exempt</p></div>
                        <Toggle on={pensionInEstate} onClick={() => setPension(v => !v)} />
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                        <div><span className="text-sm font-semibold text-gray-700">Charitable legacy</span><p className="text-[11px] text-gray-400">≥10% of the estate cuts the rate to 36%{results.charityAmt > 0 && ` · needs ${fmt(0.10 * results.baseline)}`}</p></div>
                        <div className="relative w-36"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{symbol}</span><input type="number" value={charity} onChange={(e) => setCharity(parseFloat(e.target.value) || 0)} className="w-full pl-6 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none" /></div>
                    </div>
                </div>

                <div className="bg-white/75 backdrop-blur-smp-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800 mb-4">Allowances & tax</h3>
                    <div className="space-y-3">
                        {[['Nil-rate band', fmt(results.activeNRB)], ['Residence NRB', fmt(results.effectiveRNRB)], ['Tax on gifts', fmt(results.giftTax)], ['Tax on estate', fmt(results.estateTax)], [`Rate applied`, `${(results.estateRate * 100).toFixed(0)}%`]].map(([k, v]) => (
                            <div key={k} className="flex justify-between items-center"><span className="text-xs text-gray-500">{k}</span><span className="font-mono font-bold text-gray-900 text-sm">{v}</span></div>
                        ))}
                        {results.taperReduction > 0 && <div className="flex justify-between items-center"><span className="text-xs text-rose-500">RNRB tapered away</span><span className="font-mono font-bold text-rose-500 text-sm">−{fmt(results.taperReduction)}</span></div>}
                    </div>
                </div>
            </div>

            {/* Summary bar + add */}
            <div className="bg-white/75 backdrop-blur-smp-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
                <div className="grid grid-cols-2 md:flex md:gap-8 w-full md:w-auto gap-4">
                    <div><span className="block text-xs font-bold uppercase text-gray-400 mb-1">Gross estate</span><span className="text-xl font-semibold text-gray-900">{fmt(results.totalGrossEstate)}</span></div>
                    <div><span className="block text-xs font-bold uppercase text-gray-400 mb-1">Reliefs / exempt</span><span className="text-xl font-semibold text-emerald-600">-{fmt(results.totalReliefsClaimed)}</span></div>
                    <div><span className="block text-xs font-bold uppercase text-gray-400 mb-1">Chargeable estate</span><span className="text-xl font-semibold text-gray-900">{fmt(results.netChargeableEstate)}</span></div>
                    <div><span className="block text-xs font-bold uppercase text-gray-400 mb-1">Effective rate</span><span className="text-xl font-semibold text-brand3">{results.effectiveRate.toFixed(1)}%</span></div>
                </div>
                <div className="relative min-w-[150px]">
                    <button onClick={() => setAddMenuOpen(!addMenuOpen)} disabled={assets.length >= 10} className="w-full justify-center bg-brand hover:bg-brand2 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 disabled:opacity-50"><Plus className="w-4 h-4" /> Add Asset</button>
                    {addMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
                            <div className="absolute right-0 mt-2 w-72 bg-white/75 backdrop-blur-smborder border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                                <button onClick={addBlankRow} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100"><div className="bg-gray-100 p-1.5 rounded-lg text-gray-500"><Plus className="w-4 h-4" /></div><p className="text-sm font-bold text-gray-800">Blank Estate Asset</p></button>
                                <div className="max-h-64 overflow-y-auto">
                                    <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase bg-gray-50/50 sticky top-0">Workbook asset ({currency})</div>
                                    {Object.values(pricesData[currency] || {}).map((asset) => (
                                        <button key={asset.isin} onClick={() => addExistingAsset(asset)} className="w-full text-left px-4 py-2.5 hover:bg-brand6/10 group flex flex-col">
                                            <span className="text-xs font-bold text-gray-700 group-hover:text-brand truncate">{asset.name}</span>
                                            <span className="flex justify-between w-full mt-1"><span className="text-[10px] text-gray-400 font-mono">{asset.isin}</span><span className="text-[10px] text-brand3 font-mono">{symbol}{asset.price.toFixed(2)}</span></span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Estate assets */}
            <div className="bg-white/75 backdrop-blur-sm rounded-2xl shadow-sm border border-brand overflow-hidden mb-6">
                <div className="px-6 py-3 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-800">Estate assets</h3></div>
                <div className="overflow-x-auto"><table className="w-full text-left border-collapse min-w-[900px]">
                    <thead><tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-wider"><th className="px-6 py-4">Asset</th><th className="px-4 py-4 w-24">Units</th><th className="px-4 py-4 w-36">Value ({symbol})</th><th className="px-4 py-4 w-52">IHT status</th><th className="px-4 py-4 w-24">Relief %</th><th className="px-6 py-4 text-right">Taxable</th></tr></thead>
                    <tbody>
                        {results.breakdown.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400 italic">No assets yet — add estate assets to estimate IHT.</td></tr>
                        ) : results.breakdown.map((a) => (
                            <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                                <td className="px-6 py-4"><div className="flex flex-col gap-1">
                                    <input value={a.name} onChange={(e) => updateAsset(a.id, 'name', e.target.value)} className="bg-transparent font-bold text-gray-800 outline-none w-full" placeholder="e.g. Main residence" />
                                    <div className="flex items-center gap-2"><button onClick={() => removeRow(a.id)} className="text-gray-300 hover:text-brand3"><Trash2 className="w-3.5 h-3.5" /></button>
                                        <input value={a.isin} onChange={(e) => updateAsset(a.id, 'isin', e.target.value)} className="bg-transparent text-[10px] text-gray-400 uppercase tracking-widest outline-none w-full" placeholder="ISIN/REF" /></div>
                                </div></td>
                                <td className="px-4 py-4"><input type="number" step="0.01" value={a.units} onChange={(e) => updateAsset(a.id, 'units', e.target.value)} className="w-full bg-white/75 backdrop-blur-smborder border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono outline-none" /></td>
                                <td className="px-4 py-4"><input type="number" step="0.01" value={a.currentPrice} onChange={(e) => updateAsset(a.id, 'currentPrice', e.target.value)} className="w-full bg-white/75 backdrop-blur-smborder border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono outline-none" /></td>
                                <td className="px-4 py-4"><select value={a.ihtStatus} onChange={(e) => { const s = e.target.value; updateAsset(a.id, 'ihtStatus', s); if (s !== 'Business Relief') updateAsset(a.id, 'reliefRate', s === 'Subject to IHT' ? 0 : 100); }} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-700 outline-none">
                                    <option value="Subject to IHT">Subject to IHT</option><option value="Business Relief">Business Relief</option><option value="Pension">Pension</option><option value="Exempt">Exempt (spouse/charity)</option></select></td>
                                <td className="px-4 py-4"><div className="relative"><input type="number" min="0" max="100" disabled={a.ihtStatus !== 'Business Relief'} value={a.reliefRate} onChange={(e) => updateAsset(a.id, 'reliefRate', e.target.value)} className="w-full bg-white/75 backdrop-blur-smborder border-gray-200 rounded-lg pl-2 pr-6 py-1.5 text-sm font-mono outline-none disabled:bg-gray-100 disabled:text-gray-400" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span></div></td>
                                <td className="px-6 py-4 text-right"><span className={`block font-bold text-lg ${a.taxableValue > 0 ? 'text-brand3' : 'text-gray-400'}`}>{fmt(a.taxableValue)}</span><span className="text-[10px] text-gray-400">Gross {fmt(a.rawValue)}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
            </div>

            {/* Gifts */}
            <div className="bg-white/75 backdrop-blur-sm rounded-2xl shadow-sm border border-brand p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                    <div><h3 className="text-sm font-bold text-gray-800">Lifetime gifts (last 7 years)</h3><p className="text-xs text-gray-400">Net of exemptions (£3k annual, wedding, small gifts). Tax tapers 3–7 yrs, then falls out at 7.</p></div>
                    <button onClick={addGift} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200"><Plus size={13} /> Add gift</button>
                </div>
                {gifts.length === 0 ? <p className="text-xs text-gray-400 italic">No gifts recorded.</p> : (
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm min-w-[720px]">
                        <thead><tr className="text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100"><th className="py-2 px-2">Description</th><th className="py-2 px-2 w-32">Amount</th><th className="py-2 px-2 w-32">Exemption</th><th className="py-2 px-2 w-24">Years ago</th><th className="py-2 px-2 w-24 text-right">Taper</th><th className="py-2 px-2 w-28 text-right">IHT</th><th className="py-2 px-2"></th></tr></thead>
                        <tbody>
                            {gifts.map((g) => {
                                const row = results.giftRows.find(r => r.id === g.id);
                                const exempt = (parseFloat(g.yearsAgo) || 0) >= 7;
                                return (
                                    <tr key={g.id} className="border-b border-gray-50">
                                        <td className="py-1.5 px-2"><input value={g.desc} onChange={(e) => updGift(g.id, 'desc', e.target.value)} className="w-full bg-transparent outline-none font-semibold text-gray-700" /></td>
                                        <td className="py-1.5 px-2"><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{symbol}</span><input type="number" value={g.amount} onChange={(e) => updGift(g.id, 'amount', e.target.value)} className="w-full pl-6 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none" /></div></td>
                                        <td className="py-1.5 px-2"><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{symbol}</span><input type="number" value={g.exempt} onChange={(e) => updGift(g.id, 'exempt', e.target.value)} className="w-full pl-6 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none" /></div></td>
                                        <td className="py-1.5 px-2"><input type="number" min="0" max="10" value={g.yearsAgo} onChange={(e) => updGift(g.id, 'yearsAgo', e.target.value)} className="w-20 py-1 px-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none" /></td>
                                        <td className="py-1.5 px-2 text-right font-mono text-xs text-gray-600">{exempt ? '—' : `${(row?.taperReliefPct || 0).toFixed(0)}%`}</td>
                                        <td className="py-1.5 px-2 text-right font-mono font-bold text-sm">{exempt ? <span className="text-emerald-600">Falls out</span> : fmt(row?.tax || 0)}</td>
                                        <td className="py-1.5 px-2 text-right"><button onClick={() => delGift(g.id)} className="p-1 text-gray-300 hover:text-rose-500"><Trash2 size={13} /></button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table></div>
                )}
            </div>

            {/* Life assurance */}
            <div className="bg-white/75 backdrop-blur-sm rounded-2xl shadow-sm border border-brand p-6">
                <div className="flex items-center justify-between mb-3">
                    <div><h3 className="text-sm font-bold text-gray-800">Life assurance (cover the liability)</h3><p className="text-xs text-gray-400">Policies <b>in trust</b> pay outside the estate and offset the IHT; <b>not in trust</b> adds to the estate.</p></div>
                    <button onClick={addPolicy} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200"><Plus size={13} /> Add policy</button>
                </div>
                {policies.length === 0 ? <p className="text-xs text-gray-400 italic">No policies. Add cover to see the net position.</p> : (
                    <div className="overflow-x-auto"><table className="w-full text-left text-sm min-w-[720px]">
                        <thead><tr className="text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100"><th className="py-2 px-2">Provider</th><th className="py-2 px-2 w-36">Sum assured</th><th className="py-2 px-2 w-40">Type</th><th className="py-2 px-2 w-24">Term</th><th className="py-2 px-2 w-24 text-center">In trust</th><th className="py-2 px-2"></th></tr></thead>
                        <tbody>
                            {policies.map((p) => (
                                <tr key={p.id} className="border-b border-gray-50">
                                    <td className="py-1.5 px-2"><input value={p.provider} onChange={(e) => updPolicy(p.id, 'provider', e.target.value)} className="w-full bg-transparent outline-none font-semibold text-gray-700" /></td>
                                    <td className="py-1.5 px-2"><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{symbol}</span><input type="number" value={p.sumAssured} onChange={(e) => updPolicy(p.id, 'sumAssured', parseFloat(e.target.value) || 0)} className="w-full pl-6 pr-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none" /></div></td>
                                    <td className="py-1.5 px-2"><select value={p.type} onChange={(e) => updPolicy(p.id, 'type', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-medium outline-none"><option>Whole of Life</option><option>Level Term</option><option>Decreasing Term</option></select></td>
                                    <td className="py-1.5 px-2"><input type="number" disabled={p.type === 'Whole of Life'} value={p.termYears} onChange={(e) => updPolicy(p.id, 'termYears', parseFloat(e.target.value) || 0)} className="w-16 py-1 px-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm outline-none disabled:bg-gray-100 disabled:text-gray-300" /></td>
                                    <td className="py-1.5 px-2 text-center"><input type="checkbox" checked={p.inTrust} onChange={(e) => updPolicy(p.id, 'inTrust', e.target.checked)} /></td>
                                    <td className="py-1.5 px-2 text-right"><button onClick={() => delPolicy(p.id)} className="p-1 text-gray-300 hover:text-rose-500"><Trash2 size={13} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table></div>
                )}
                {(results.inTrustCover > 0 || results.nonTrustCover > 0) && (
                    <div className="mt-3 flex flex-wrap gap-4 text-xs border-t border-gray-100 pt-3">
                        <span className="text-gray-500">In-trust cover: <b className="text-emerald-600">{fmt(results.inTrustCover)}</b></span>
                        {results.nonTrustCover > 0 && <span className="text-gray-500">Added to estate: <b className="text-rose-600">{fmt(results.nonTrustCover)}</b></span>}
                        <span className="text-gray-500">Net: {results.shortfall > 0 ? <b className="text-rose-600">{fmt(results.shortfall)} shortfall</b> : <b className="text-emerald-600">covered{results.coverSurplus > 0 ? ` (+${fmt(results.coverSurplus)})` : ''}</b>}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
