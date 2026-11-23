import React from 'react';
import { Compass, Eye, ScrollText, Users } from 'lucide-react';

const TABS = [
  { id: 'helm', label: '조타실', icon: Compass },
  { id: 'quadrant', label: '사분의', icon: Eye },
  { id: 'log', label: '교역·일지', icon: ScrollText },
  { id: 'fleet', label: '선단 현황', icon: Users },
];

export default function BottomNav({ activeTab, onSelectTab }) {
  return (
    <nav className="sticky bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-4 gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-bold transition cursor-pointer ${
                active
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
