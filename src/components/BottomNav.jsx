import React from 'react';
import { Compass, Eye, Settings, ShoppingBag } from 'lucide-react';

const TABS = [
  { id: 'helm', label: '조타실', icon: Compass },
  { id: 'quadrant', label: '사분의', icon: Eye },
  { id: 'log', label: '교역소', icon: ShoppingBag },
  { id: 'fleet', label: '설정', icon: Settings },
];

export default function BottomNav({ activeTab, onSelectTab, highlightTradeShop = false }) {
  return (
    <nav className="sticky bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-4 gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const isTradeHighlight = tab.id === 'log' && highlightTradeShop && !active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-bold transition cursor-pointer ${
                active
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                  : isTradeHighlight
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/70 shadow-[0_0_12px_rgba(16,185,129,0.35)] animate-pulse'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {isTradeHighlight && (
                <span className="absolute -top-1.5 right-1 rounded-full bg-emerald-400 px-1.5 py-[1px] text-[9px] font-black text-slate-950 shadow">
                  교역소
                </span>
              )}
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
