import React, { useState, useMemo, useEffect } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  ReferenceArea,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, Plus, X, MousePointer2 } from 'lucide-react';

const COLORS = ['#f43f5e', '#3b82f6', '#f59e0b', '#10b981']; // Rose, Blue, Amber, Emerald

export default function PerformanceAnalyticsView({ presets = {}, historicalData = {}, pricesData = {}, symbol = "$" }) {
  
  const getYTDDays = () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const calendarDays = Math.max(1, Math.floor((now - start) / (24 * 60 * 60 * 1000)));
      return Math.floor(calendarDays * (252 / 365)); 
  };

  const TIMEFRAMES = useMemo(() => ({
    '3m':  { label: '3M',  source: 'Daily_1Y',   points: 63 },
    '6m':  { label: '6M',  source: 'Daily_1Y',   points: 126 },
    'ytd': { label: 'YTD', source: 'Daily_1Y',   points: getYTDDays() },
    '1y':  { label: '1Y',  source: 'Daily_1Y',   points: 252 },
    '3y':  { label: '3Y',  source: 'Weekly_3Y',  points: 156 },
    '5y':  { label: '5Y',  source: 'Monthly_5Y', points: 60 }
  }), []);

  const [timeframe, setTimeframe] = useState('1y');
  
  // Clean initialization state matching expected drop fields
  const [selections, setSelections] = useState([
    { id: 'init-0', type: 'preset', strategy: 'World Allocation', currency: 'USD', profile: 'Risk Averse (20/80)', assetTicker: '' }
  ]);

  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [customStats, setCustomStats] = useState(null);

  useEffect(() => {
    clearSelection();
  }, [timeframe]);

  const addSelection = () => {
    if (selections.length >= 4) return;
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setSelections([...selections, { id: uniqueId, type: 'preset', strategy: '', currency: '', profile: '', assetTicker: '' }]);
  };

  const removeSelection = (id) => {
    setSelections(selections.filter(s => s.id !== id));
  };

  const updateSelection = (id, field, value) => {
    setSelections(selections.map(s => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: value };
        if (field === 'type') {
            updated.strategy = ''; updated.profile = ''; updated.assetTicker = '';
        }
        if (field === 'strategy' || field === 'currency') updated.profile = '';
        if (field === 'currency' && updated.type === 'asset') updated.assetTicker = '';
        return updated;
    }));
  };

  // --- Fixed Data Engine ---
  const calculateSeries = (sel, timeframeConfig) => {
    let portfolio = [];
    
    if (sel.type === 'preset') {
        if (!sel.strategy || !sel.currency || !sel.profile || !presets[sel.strategy]?.[sel.currency]?.[sel.profile]) {
            return null;
        }
        portfolio = presets[sel.strategy][sel.currency][sel.profile];
    } else {
        if (!sel.currency || !sel.assetTicker) return null;
        portfolio = [{ ticker: sel.assetTicker, target: 100 }];
    }

    const { source, points } = timeframeConfig;
    
    const parsedHistories = portfolio.map(asset => {
        let rawTicker = (asset.ticker || asset.isin || "").trim();
        
        // CRITICAL FIX: Always split off suffix (.L) to match clean keys constructed by api.js
        let targetTicker = rawTicker.split('.')[0];
        
        let actualDataKey = Object.keys(historicalData).find(
            key => key.toLowerCase() === targetTicker.toLowerCase()
        );

        const hString = actualDataKey ? historicalData[actualDataKey]?.[source] : null;
        
        if (!hString || hString === "N/A") {
            console.warn(`[GSB Tracker] Missing historical data for: "${targetTicker}" ("${rawTicker}") under: "${source}"`);
            return [];
        }
        return hString.split(';').map(v => parseFloat(v) || 0);
    });

    if (parsedHistories.every(h => h.length === 0)) return null;

    let maxAvailablePoints = points;
    parsedHistories.forEach(h => {
       if (h.length > 0 && h.length < maxAvailablePoints) {
          maxAvailablePoints = h.length;
       }
    });

    const finalPointsCount = Math.max(1, maxAvailablePoints);
    const alignedData = new Array(finalPointsCount).fill(null);
    let initialTotal = 0;
    
    portfolio.forEach((asset, i) => {
        const history = parsedHistories[i];
        if (!history || history.length === 0) return;
        const startIndex = Math.max(0, history.length - finalPointsCount);
        const weight = asset.target || asset.weight || 100;
        initialTotal += (history[startIndex] * (weight / 100));
    });

    if (initialTotal === 0) return null;

    for (let p = 0; p < finalPointsCount; p++) {
        let currentTotal = 0;
        let hasData = false;

        portfolio.forEach((asset, i) => {
            const history = parsedHistories[i];
            if (!history || history.length === 0) return;
            const historyIndex = history.length - finalPointsCount + p;
            
            if (historyIndex >= 0 && historyIndex < history.length) {
                const weight = asset.target || asset.weight || 100;
                currentTotal += (history[historyIndex] * (weight / 100));
                hasData = true;
            }
        });

        if (hasData) {
            const pctGrowth = ((currentTotal - initialTotal) / initialTotal) * 100;
            alignedData[p] = {
                growth: parseFloat(pctGrowth.toFixed(2)),
                raw: currentTotal
            };
        }
    }

    return alignedData;
  };

  const chartData = useMemo(() => {
    const config = TIMEFRAMES[timeframe];
    const seriesResults = selections.map(sel => calculateSeries(sel, config));
    
    const validSeriesLengths = seriesResults.filter(s => s !== null).map(s => s.length);
    const actualPointsRendered = validSeriesLengths.length > 0 
      ? Math.max(...validSeriesLengths) 
      : config.points;

    const labels = [];
    const now = new Date();
    const isWeekly = config.source.includes('Weekly');
    const isDaily = config.source.includes('Daily');
    
    for (let i = 0; i < actualPointsRendered; i++) {
        const d = new Date(now);
        if (isDaily) {
            d.setDate(d.getDate() - Math.floor((actualPointsRendered - 1 - i) * (365/252)));
        } else if (isWeekly) {
            d.setDate(d.getDate() - (actualPointsRendered - 1 - i) * 7);
        } else {
            d.setMonth(d.getMonth() - (actualPointsRendered - 1 - i));
        }
        
        if (isDaily && actualPointsRendered <= 126) {
            labels.push(d.toLocaleString('default', { month: 'short', day: 'numeric' }));
        } else {
            labels.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
        }
    }

    const data = [];
    for (let i = 0; i < actualPointsRendered; i++) {
        const point = { name: labels[i] };
        selections.forEach((sel, idx) => {
            const dataPoint = seriesResults[idx] && seriesResults[idx][i] ? seriesResults[idx][i] : null;
            point[`series_${idx}`] = dataPoint ? dataPoint.growth : null;
            point[`raw_${idx}`] = dataPoint ? dataPoint.raw : null;
        });
        data.push(point);
    }
    
    return data;
  }, [selections, timeframe, presets, historicalData, pricesData, TIMEFRAMES]);

  // --- Chart Drag Handlers ---
  const handleMouseDown = (e) => {
    if (e?.activeLabel) {
      setRefAreaLeft(e.activeLabel);
      setRefAreaRight(e.activeLabel);
      setIsSelecting(true);
      setCustomStats(null);
    }
  };

  const handleMouseMove = (e) => {
    if (isSelecting && e?.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    
    if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
      let startIndex = chartData.findIndex(d => d.name === refAreaLeft);
      let endIndex = chartData.findIndex(d => d.name === refAreaRight);
      
      if (startIndex > endIndex) {
        [startIndex, endIndex] = [endIndex, startIndex];
        setRefAreaLeft(chartData[startIndex].name);
        setRefAreaRight(chartData[endIndex].name);
      }

      const stats = selections.map((sel, idx) => {
        const startRaw = chartData[startIndex]?.[`raw_${idx}`];
        const endRaw = chartData[endIndex]?.[`raw_${idx}`];
        
        if (startRaw && endRaw) {
           const percentChange = ((endRaw - startRaw) / startRaw) * 100;
           
           // Handle asset labels cleanly if checking individual tickers
           const baseTicker = sel.assetTicker ? sel.assetTicker.split('.')[0] : '';
           const assetName = sel.currency && pricesData[sel.currency] && pricesData[sel.currency][baseTicker]
             ? pricesData[sel.currency][baseTicker].name
             : 'Asset';

           return {
              id: sel.id,
              name: sel.type === 'preset' ? (sel.profile || 'Preset') : assetName,
              return: percentChange
           };
        }
        return null;
      }).filter(Boolean);

      setCustomStats({ start: chartData[startIndex].name, end: chartData[endIndex].name, stats });
    } else {
      setRefAreaLeft(null); setRefAreaRight(null); setCustomStats(null);
    }
  };

  const clearSelection = () => {
      setRefAreaLeft(null); setRefAreaRight(null); setCustomStats(null);
  };

  const finalStats = useMemo(() => {
    if (chartData.length === 0) return [];
    const lastData = chartData[chartData.length - 1];
    return selections.map((sel, idx) => {
      const baseTicker = sel.assetTicker ? sel.assetTicker.split('.')[0] : '';
      const assetName = sel.currency && pricesData[sel.currency] && pricesData[sel.currency][baseTicker]
        ? pricesData[sel.currency][baseTicker].name
        : 'Asset';

      return {
         id: sel.id,
         name: sel.type === 'preset' ? (sel.profile || 'Preset') : assetName,
         return: lastData ? lastData[`series_${idx}`] : 0
      };
    });
  }, [chartData, selections, pricesData]);

  const displayStats = customStats ? customStats.stats : finalStats;
  
  const isChartPopulated = useMemo(() => {
    return chartData.some(d => Object.keys(d).some(k => k.startsWith('series_') && d[k] !== null && d[k] !== undefined));
  }, [chartData]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">GSB Analytics</h3>
          <p className="text-slate-500 text-xs font-medium mt-0.5 flex items-center gap-2">
              Compare strategic portfolio variance models. 
              <span className="text-amber-600 font-bold flex items-center gap-1">
                <MousePointer2 size={12}/> Drag chart canvas to cross-slice return frames.
              </span>
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="inline-flex p-0.5 bg-slate-100 rounded-xl">
            {Object.entries(TIMEFRAMES).map(([key, opt]) => (
              <button
                key={key}
                onClick={() => setTimeframe(key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  timeframe === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button 
            onClick={addSelection}
            disabled={selections.length >= 4}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 transition-all shadow-xs"
          >
            <Plus size={14}/> Compare ({selections.length}/4)
          </button>
        </div>
      </div>

      {/* Input Target Configuration Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {selections.map((sel, idx) => (
          <div key={sel.id} className="p-3.5 rounded-2xl border border-slate-100 bg-white shadow-xs relative flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shadow-xs" style={{ backgroundColor: COLORS[idx] }}></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Series {idx + 1}</span>
               </div>
               {selections.length > 1 && (
                  <button onClick={() => removeSelection(sel.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                      <X size={14} />
                  </button>
               )}
            </div>

            <div className="space-y-1.5">
                <div className="flex gap-1.5">
                    <select
                        className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                        value={sel.type}
                        onChange={(e) => updateSelection(sel.id, 'type', e.target.value)}
                    >
                        <option value="preset">Preset Strategy</option>
                        <option value="asset">Individual Asset</option>
                    </select>
                    <select
                        className="w-20 px-1.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                        value={sel.currency}
                        onChange={(e) => updateSelection(sel.id, 'currency', e.target.value)}
                    >
                        <option value="">Curr</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="EUR">EUR</option>
                        <option value="AUD">AUD</option>
                    </select>
                </div>

                {sel.type === 'preset' ? (
                    <div className="flex gap-1.5">
                        <select
                            className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                            value={sel.strategy}
                            onChange={(e) => updateSelection(sel.id, 'strategy', e.target.value)}
                        >
                            <option value="">Select Strategy</option>
                            {Object.keys(presets).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select
                            className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none disabled:opacity-40"
                            disabled={!sel.strategy || !sel.currency}
                            value={sel.profile}
                            onChange={(e) => updateSelection(sel.id, 'profile', e.target.value)}
                        >
                            <option value="">Risk Profile</option>
                            {sel.strategy && sel.currency && presets[sel.strategy]?.[sel.currency] && 
                                Object.keys(presets[sel.strategy][sel.currency]).map(p => <option key={p} value={p}>{p}</option>)
                            }
                        </select>
                    </div>
                ) : (
                    <select
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-semibold text-slate-700 outline-none disabled:opacity-40"
                        disabled={!sel.currency}
                        value={sel.assetTicker}
                        onChange={(e) => updateSelection(sel.id, 'assetTicker', e.target.value)}
                    >
                        <option value="">Select Ticker...</option>
                        {sel.currency && pricesData[sel.currency] && 
                            Object.keys(pricesData[sel.currency]).map(ticker => (
                                <option key={ticker} value={ticker}>{ticker} - {pricesData[sel.currency][ticker].name}</option>
                            ))
                        }
                    </select>
                )}
            </div>
          </div>
        ))}
      </div>

      {/* Chart Display Window */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs relative">
        {isChartPopulated ? (
          <div className="space-y-4">
            {/* Realtime Stats Bar */}
            <div className={`flex flex-wrap items-center gap-4 border-b pb-4 transition-all ${customStats ? 'border-amber-100 bg-amber-50/40 -mx-5 px-5 -mt-5 pt-5 rounded-t-2xl' : 'border-slate-100'}`}>
               <div className="w-full flex justify-between items-center">
                   <p className={`text-[10px] font-bold uppercase tracking-wider ${customStats ? 'text-amber-700' : 'text-slate-400'}`}>
                      {customStats ? `Custom Return Frame: ${customStats.start} → ${customStats.end}` : `Total Performance Return Overview (${TIMEFRAMES[timeframe].label})`}
                   </p>
                   {customStats && (
                       <button onClick={clearSelection} className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border shadow-2xs px-2 py-0.5 rounded-md transition-colors">
                           ✕ Clear Delta
                       </button>
                   )}
               </div>

               {displayStats.map((stat, idx) => stat && stat.return !== undefined && stat.return !== null && (
                 <div key={stat.id} className={`flex-1 min-w-[100px] ${idx > 0 ? 'border-l border-slate-100 pl-4' : ''}`}>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx] }}></span>
                        {stat.name}
                    </p>
                    <p className={`text-xl font-bold tracking-tight ${stat.return >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {stat.return >= 0 ? '+' : ''}{stat.return.toFixed(2)}%
                    </p>
                 </div>
               ))}
            </div>

            {/* Fluid Multi-Viewport Layout Box Container */}
            <div className="w-full h-[380px] min-w-0 select-none cursor-crosshair">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                    data={chartData} 
                    margin={{ top: 10, right: 5, left: -20, bottom: 0 }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                  <defs>
                    {selections.map((sel, idx) => (
                        <linearGradient key={`grad_${idx}`} id={`color_${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS[idx]} stopOpacity={0.12}/>
                            <stop offset="95%" stopColor={COLORS[idx]} stopOpacity={0}/>
                        </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    dy={10}
                    interval={Math.max(1, Math.floor(chartData.length / 7))}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(val) => `${val}%`}
                  />
                  
                  {!isSelecting && (
                    <Tooltip 
                      cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-800 min-w-[180px] pointer-events-none text-xs">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 border-b border-slate-800 pb-1.5">
                                  {payload[0].payload.name}
                              </p>
                              <div className="space-y-2">
                                  {payload.map((entry, idx) => {
                                      if (!entry || entry.value === null || entry.value === undefined) return null;
                                      return (
                                          <div key={idx} className="flex justify-between items-center gap-4">
                                              <div className="flex items-center gap-1.5 min-w-0">
                                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx] }}></div>
                                                  <span className="text-slate-300 truncate max-w-[100px]">
                                                      {finalStats[idx]?.name || `Series ${idx + 1}`}
                                                  </span>
                                              </div>
                                              <span className={`font-bold ${entry.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                  {entry.value}%
                                              </span>
                                          </div>
                                      );
                                  })}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  )}
                  
                  {selections.map((sel, idx) => {
                     const identityKey = `series_${idx}`;
                     return (
                       <Area 
                          key={sel.id}
                          type="monotone" 
                          dataKey={identityKey} 
                          stroke={COLORS[idx]} 
                          fill={`url(#color_${idx})`} 
                          strokeWidth={idx === 0 ? 2.5 : 2}
                          strokeDasharray={idx > 0 ? "4 4" : "0"}
                          animationDuration={150}
                          connectNulls={true}
                       />
                     );
                  })}

                  {refAreaLeft && refAreaRight && (
                    <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#0f172a" fillOpacity={0.07} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="h-[320px] flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
             <TrendingUp size={32} className="text-slate-300 mb-2 animate-pulse" />
             <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Awaiting Valid Series Alignment</p>
             <p className="text-[11px] text-slate-400 mt-1 text-center max-w-md">
                If selecting a strategy, confirm that its tickers match the parsed headers inside your historical mapping matrices.
             </p>
          </div>
        )}
      </div>
    </div>
  );
}