import React from 'react';

export const TabButton = ({ active, onClick, icon, label }) => (
    <button 
        onClick={onClick} 
        className={`flex items-center gap-2 px-3 text-sm font-medium transition-all border-b-2 h-16 ${
            active ? 'border-brand3 text-white' : 'border-transparent text-white/55 hover:text-white'
        }`}
    >
        {icon} {label}
    </button>
);