// ─────────────────────────────────────────────────────────────────────────────
// MarketPulseView.jsx
//
// CHANGES vs. original:
//   1. Removed the stale trailing comment "// --- MAIN APP COMPONENT ---"
//      that was appended to the bottom of the file (cosmetic).
//   2. data prop shape { [currency]: { [ticker]: AssetPrice } } is unchanged
//      and matches App.jsx's `marketPulseData` memo exactly — no logic changes.
//   3. GSB import was unused in this view; removed to keep imports clean.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';

export default function MarketPulseView({ data, symbol, currency }) {
  const [selectedTicker, setSelectedTicker] = useState(null);

  const currencyData = data[currency] || {};
  const tickers      = Object.keys(currencyData);

  useEffect(() => {
    if (tickers.length > 0) {
      setSelectedTicker(tickers[0]);
    } else {
      setSelectedTicker(null);
    }
  }, [currency]);

  const activeAsset = currencyData[selectedTicker];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Market Explorer</h2>
        <p className="text-gray-500 text-sm">
          Select an asset for <span className="font-bold text-brand">{currency}</span> to view its 52-week performance pulse.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT: Ticker List */}
        <div className="lg:col-span-4 space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {tickers.length === 0 ? (
            <p className="text-gray-400 italic">No assets for {currency}</p>
          ) : (
            tickers.map((ticker) => {
              const info       = currencyData[ticker];
              const isSelected = selectedTicker === ticker;
              return (
                <button
                  key={ticker}
                  onClick={() => setSelectedTicker(ticker)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                    isSelected
                      ? 'border-brand3 bg-brand3/5 shadow-sm ring-1 ring-brand3'
                      : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="min-w-0">
                      <span className={`text-[10px] font-black uppercase tracking-tighter ${isSelected ? 'text-brand3' : 'text-brand6'}`}>
                        {ticker}
                      </span>
                      <h4 className="font-bold text-gray-800 truncate">{info.name}</h4>
                    </div>
                    <span className="font-mono font-bold text-gray-600 shrink-0 ml-2">
                      {symbol}{info.price.toFixed(2)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* RIGHT: Asset Detail Panel */}
        <div className="lg:col-span-8">
          {activeAsset ? (
            <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm sticky top-24">

              {/* Header */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-brand3/10 text-brand3 text-[10px] font-black uppercase mb-3">
                    Asset Overview
                  </span>
                  <h3 className="text-3xl font-bold text-gray-900 leading-tight">{activeAsset.name}</h3>
                  <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-brand3/5 border border-brand3/10">
                    <span className="text-[10px] font-bold text-brand6 uppercase tracking-widest">ISIN</span>
                    <span className="text-xs font-black text-brand3 font-mono">{activeAsset.isin}</span>
                  </div>
                </div>
                <div className="text-left md:text-right">
                  <div className="text-4xl font-mono font-bold text-brand tracking-tighter">
                    {symbol}{activeAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-gray-400 text-[10px] font-bold uppercase mt-1">Price as of {activeAsset.date}</p>
                </div>
              </div>

              <div className="h-px bg-gray-100 w-full mb-8" />

              {/* 52-Week Range */}
              <div className="space-y-8">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-brand6 uppercase tracking-widest mb-1">52-Week Range</p>
                    <p className="text-xl font-bold text-gray-800">
                      {symbol}{activeAsset.low_52}
                      <span className="text-gray-300 font-light mx-2">—</span>
                      {symbol}{activeAsset.high_52}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-brand6 uppercase tracking-widest mb-1">Off Yearly High</p>
                    <p className={`text-xl font-bold ${activeAsset.pct_off_high < 2 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {activeAsset.pct_off_high.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Pulse Bar */}
                <div className="relative">
                  <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-200/50">
                    <div
                      className="h-full bg-brand3 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,49,84,0.3)]"
                      style={{
                        width: `${Math.min(
                          Math.max(
                            ((activeAsset.price - activeAsset.low_52) / (activeAsset.high_52 - activeAsset.low_52)) * 100,
                            0
                          ),
                          100
                        )}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-3 text-[9px] font-black text-brand6 uppercase tracking-tighter">
                    <span>Yearly Low</span>
                    <span className="text-brand3">Current Position</span>
                    <span>Yearly High</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
              <p className="text-gray-400 font-medium">Select an asset from the list to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}