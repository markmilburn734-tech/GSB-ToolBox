import React, { useState, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceArea
} from 'recharts';
import { TrendingUp, Plus, X, MousePointer2 } from 'lucide-react';

const COLORS = ['#f43f5e', '#3b82f6', '#f59e0b', '#10b981']; // Rose, Blue, Amber, Emerald

export default function PerformanceAnalyticsView({ presets, historicalData, pricesData = {}, symbol = "$" }) {
  
  // Calculate dynamic YTD trading days (roughly 252 trading days per 365 calendar days)
  const getYTDDays = () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const calendarDays = Math.max(1, Math.floor((now - start) / (24 * 60 * 60 * 1000)));
      return Math.floor(calendarDays * (252 / 365)); 
  };

  const TIMEFRAMES = {
    '3m':  { label: '3M',  source: 'Daily_1Y',   points: 63 },  // ~63 trading days
    '6m':  { label: '6M',  source: 'Daily_1Y',   points: 126 }, // ~126 trading days
    'ytd': { label: 'YTD', source: 'Daily_1Y',   points: getYTDDays() },
    '1y':  { label: '1Y',  source: 'Daily_1Y',   points: 252 }, // ~252 trading days
    '3y':  { label: '3Y',  source: 'Weekly_3Y',  points: 156 }, // ~156 weekly data points
    '5y':  { label: '5Y',  source: 'Monthly_5Y', points: 60 }   // 60 monthly data points
  };

  const [timeframe, setTimeframe] = useState('1y');
  const [selections, setSelections] = useState([
    { id: Date.now(), type: 'preset', strategy: '', currency: '', profile: '', assetIsin: '' }
  ]);

  // --- Drag & Highlight State ---
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [customStats, setCustomStats] = useState(null);

  // --- Handlers ---
  const addSelection = () => {
    if (selections.length >= 4) return;
    setSelections([...selections, { id: Date.now(), type: 'preset', strategy: '', currency: '', profile: '', assetIsin: '' }]);
  };

  const removeSelection = (id) => {
    setSelections(selections.filter(s => s.id !== id));
  };

  const updateSelection = (id, field, value) => {
    setSelections(selections.map(s => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: value };
        // Reset dependent fields
        if (field === 'type') {
            updated.strategy = ''; updated.profile = ''; updated.assetIsin = '';
        }
        if (field === 'strategy' || field === 'currency') updated.profile = '';
        if (field === 'currency' && updated.type === 'asset') updated.assetIsin = '';
        return updated;
    }));
  };

  // --- Data Engine ---
  const calculateSeries = (sel, timeframeConfig) => {
    let portfolio = [];
    
    if (sel.type === 'preset') {
        if (!sel.strategy || !sel.currency || !sel.profile || !presets[sel.strategy]?.[sel.currency]?.[sel.profile]) return null;
        portfolio = presets[sel.strategy][sel.currency][sel.profile];
    } else {
        if (!sel.currency || !sel.assetIsin) return null;
        portfolio = [{ isin: sel.assetIsin, target: 100 }];
    }

    const { source, points } = timeframeConfig;
    
    const parsedHistories = portfolio.map(asset => {
        const hString = historicalData[asset.isin]?.[source];
        if (!hString || hString === "N/A") return [];
        return hString.split(';').map(v => parseFloat(v) || 0);
    });

    if (parsedHistories.every(h => h.length === 0)) return null;

    // Safety check: Find the shortest history tracking length across selections to prevent clipping array out-of-bounds
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
        // Make sure indexing doesn't head south past zero if history array size is small
        const startIndex = Math.max(0, history.length - finalPointsCount);
        initialTotal += (history[startIndex] * (asset.target / 100));
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
                currentTotal += (history[historyIndex] * (asset.target / 100));
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
    // Reset custom selection if timeframe changes
    setRefAreaLeft(null); setRefAreaRight(null); setCustomStats(null);

    const config = TIMEFRAMES[timeframe];
    const seriesResults = selections.map(sel => calculateSeries(sel, config));
    
    // Dynamically lock chart bounds to data payload lengths
    const actualPointsRendered = seriesResults.reduce((max, s) => (s && s.length > max ? s.length : max), 0) || config.points;

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
            const dataPoint = seriesResults[idx] ? seriesResults[idx][i] : null;
            point[`series_${idx}`] = dataPoint ? dataPoint.growth : null;
            point[`raw_${idx}`] = dataPoint ? dataPoint.raw : null;
        });
        data.push(point);
    }
    return data;
  }, [selections, timeframe, presets, historicalData]);

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
           // Adjusted lookup structure to properly locate names within currency submaps using Object.values
           const assetName = sel.currency && pricesData[sel.currency]
             ? (Object.values(pricesData[sel.currency]).find(a => a.isin === sel.assetIsin)?.name || 'Asset')
             : 'Asset';

           return {
              id: sel.id,
              name: sel.type === 'preset' ? (sel.profile || 'Preset') : assetName,
              return: percentChange
           };
        }
        return null;
      }).filter(Boolean);

      setCustomStats({ 
          start: chartData[startIndex].name, 
          end: chartData[endIndex].name, 
          stats 
      });
    } else {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      setCustomStats(null);
    }
  };

  const clearSelection = () => {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      setCustomStats(null);
  };

  // Generate Default End-of-Period Stats
  const finalStats = useMemo(() => {
    if (chartData.length === 0) return [];
    const lastData = chartData[chartData.length - 1];
    return selections.map((sel, idx) => {
      const assetName = sel.currency && pricesData[sel.currency]
        ? (Object.values(pricesData[sel.currency]).find(a => a.isin === sel.assetIsin)?.name || 'Asset')
        : 'Asset';

      return {
         id: sel.id,
         name: sel.type === 'preset' ? (sel.profile || 'Preset') : assetName,
         return: lastData[`series_${idx}`]
      };
    });
  }, [chartData, selections, pricesData]);

  const displayStats = customStats ? customStats.stats : finalStats;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in">
      {/* Header & Controls Panel */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h3 className="text-3xl font-bold text-slate-800 tracking-tight">Performance Analytics</h3>
            <p className="text-slate-500 font-medium flex items-center gap-2">
                Compare growth across portfolios. <span className="hidden md:inline text-slate-300">•</span>
                <span className="text-brand3 font-bold flex items-center gap-1"><MousePointer2 size={14}/> Drag on chart to isolate timeframes.</span>
            </p>
          </div>
          <button 
            onClick={addSelection}
            disabled={selections.length >= 4}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-brand text-white hover:bg-brand3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand/20"
          >
            <Plus size={18}/> Add Comparison ({selections.length}/4)
          </button>
        </div>

        {/* Dynamic Selection Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {selections.map((sel, idx) => (
            <div key={sel.id} className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 shadow-sm relative group">
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[idx] }}></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Series {idx + 1}</span>
                 </div>
                 {selections.length > 1 && (
                    <button onClick={() => removeSelection(sel.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                        <X size={16} />
                    </button>
                 )}
              </div>

              <div className="space-y-3">
                  <div className="flex gap-2">
                      <select
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-brand/30 transition-colors"
                          value={sel.type}
                          onChange={(e) => updateSelection(sel.id, 'type', e.target.value)}
                      >
                          <option value="preset">Preset Strategy</option>
                          <option value="asset">Individual Asset</option>
                      </select>
                      
                      <select
                          className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-brand/30 transition-colors"
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
                      <div className="flex gap-2">
                          <select
                              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-brand/30"
                              value={sel.strategy}
                              onChange={(e) => updateSelection(sel.id, 'strategy', e.target.value)}
                          >
                              <option value="">Select Strategy</option>
                              {Object.keys(presets).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <select
                              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-brand/30 disabled:opacity-50"
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
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-brand/30 disabled:opacity-50"
                          disabled={!sel.currency}
                          value={sel.assetIsin}
                          onChange={(e) => updateSelection(sel.id, 'assetIsin', e.target.value)}
                      >
                          <option value="">Select an Asset...</option>
                          {sel.currency && pricesData[sel.currency] && 
                              Object.values(pricesData[sel.currency]).map(a => (
                                  <option key={a.isin} value={a.isin}>{a.name}</option>
                              ))
                          }
                      </select>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeframe Selector */}
      <div className="flex justify-center">
        <div className="inline-flex p-1.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
          {Object.entries(TIMEFRAMES).map(([key, opt]) => (
            <button
              key={key}
              onClick={() => {
                  setTimeframe(key);
                  clearSelection();
              }}
              className={`px-5 py-2 text-xs font-black rounded-xl transition-all ${
                timeframe === key
                  ? 'bg-brand text-white shadow-md'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative transition-all">
        {chartData.length > 0 && chartData[0]?.name ? (
          <div className="space-y-8">
            {/* Stat Row */}
            <div className={`flex flex-wrap items-center gap-8 border-b pb-6 transition-all ${customStats ? 'border-brand/20 bg-brand/5 -mx-6 md:-mx-10 px-6 md:px-10 -mt-6 pt-6 rounded-t-[2.5rem]' : 'border-slate-100'}`}>
               <div className="w-full flex justify-between items-center mb-2 md:mb-0">
                   <p className={`text-xs font-black uppercase tracking-widest ${customStats ? 'text-brand' : 'text-slate-400'}`}>
                      {customStats ? `Custom Return: ${customStats.start} → ${customStats.end}` : `Total Return (${TIMEFRAMES[timeframe].label})`}
                   </p>
                   {customStats && (
                       <button onClick={clearSelection} className="text-xs font-bold text-brand3 hover:text-rose-700 bg-brand3/10 px-3 py-1 rounded-lg transition-colors">
                           ✕ Clear Selection
                       </button>
                   )}
               </div>

               {displayStats.map((stat, idx) => stat.return !== undefined && stat.return !== null && (
                 <div key={stat.id} className={`flex-1 min-w-[120px] ${idx > 0 ? 'md:border-l border-slate-200/50 md:pl-8' : ''}`}>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx] }}></span>
                        {stat.name}
                    </p>
                    <p className={`text-3xl font-black tracking-tight ${stat.return >= 0 ? 'text-emerald-500' : 'text-brand3'}`}>
                      {stat.return >= 0 ? '+' : ''}{stat.return.toFixed(2)}%
                    </p>
                 </div>
               ))}
            </div>

            <div className="h-[450px] w-full select-none cursor-crosshair">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                    data={chartData} 
                    margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                  <defs>
                    {selections.map((sel, idx) => (
                        <linearGradient key={`grad_${idx}`} id={`color_${idx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS[idx]} stopOpacity={idx === 0 ? 0.2 : 0.05}/>
                            <stop offset="95%" stopColor={COLORS[idx]} stopOpacity={0}/>
                        </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                    dy={15}
                    interval={
                        timeframe === '5y' ? 11 : 
                        timeframe === '3y' ? 25 : 
                        timeframe === '1y' ? 21 : 
                        timeframe === '6m' ? 10 : 
                        timeframe === '3m' ? 5  : 
                        Math.max(1, Math.floor(chartData.length / 10))
                    }
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(val) => `${val}%`}
                    width={50}
                  />
                  <Tooltip 
                    cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length && !isSelecting) {
                        return (
                          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-2xl border border-slate-800 min-w-[200px] pointer-events-none">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-800 pb-2">
                                {payload[0].payload.name}
                            </p>
                            <div className="space-y-3">
                                {payload.map((entry, idx) => (
                                    <div key={idx} className="flex justify-between items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx] }}></div>
                                            <span className="text-xs font-medium text-slate-300 truncate max-w-[120px]">
                                                {finalStats[idx]?.name || `Series ${idx + 1}`}
                                            </span>
                                        </div>
                                        <span className={`text-sm font-bold ${entry.value >= 0 ? 'text-emerald-400' : 'text-brand3'}`}>
                                            {entry.value}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  
                  {selections.map((sel, idx) => (
                     <Area 
                        key={sel.id}
                        type="monotone" 
                        dataKey={`series_${idx}`} 
                        stroke={COLORS[idx]} 
                        fill={`url(#color_${idx})`} 
                        strokeWidth={idx === 0 ? 3 : 2.5}
                        strokeDasharray={idx > 0 ? "4 4" : "0"}
                        animationDuration={800}
                     />
                  ))}

                  {refAreaLeft && refAreaRight && (
                    <ReferenceArea 
                        x1={refAreaLeft} 
                        x2={refAreaRight} 
                        strokeOpacity={0.3} 
                        fill="#573960" 
                        fillOpacity={0.1} 
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="h-[400px] flex flex-col items-center justify-center text-slate-400">
             <div className="p-6 bg-slate-50 rounded-full mb-4">
                <TrendingUp size={40} className="text-slate-300" />
             </div>
             <p className="text-sm font-bold uppercase tracking-widest">Awaiting Selection</p>
             <p className="text-xs mt-2 text-slate-500">Configure your series above to visualize performance.</p>
          </div>
        )}
      </div>
    </div>
  );
}