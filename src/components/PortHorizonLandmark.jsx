import React from 'react';

/**
 * Regional architectural silhouette rendered on the 1st-person sea horizon
 * so students can deduce their cultural region without revealing port names.
 */
export default function PortHorizonLandmark({ archStyle, x, scale }) {
  return (
    <g transform={`translate(${x.toFixed(1)}, 93) scale(${scale.toFixed(2)})`}>
      {/* Harbor Pier & Warm Lantern Lights */}
      <rect x="-26" y="-2" width="52" height="3" fill="#451a03" />
      <circle cx="-18" cy="-4" r="1.3" fill="#fde047" opacity="0.9" />
      <circle cx="18" cy="-4" r="1.3" fill="#fde047" opacity="0.9" />

      {archStyle === 'iberia' && (
        <g>
          {/* Stone Fortress Tower (Belém-style) */}
          <rect x="-22" y="-22" width="12" height="20" fill="#d6d3d1" stroke="#57534e" strokeWidth="0.8" />
          <rect x="-24" y="-25" width="16" height="3.5" fill="#a8a29e" />
          {/* Cathedral Spire & Cross */}
          <rect x="-5" y="-20" width="11" height="18" fill="#e7e5e4" stroke="#57534e" strokeWidth="0.7" />
          <polygon points="-5,-20 0.5,-34 6,-20" fill="#b91c1c" />
          <line x1="0.5" y1="-38" x2="0.5" y2="-33" stroke="#fef08a" strokeWidth="1.2" />
          <line x1="-1.5" y1="-36" x2="2.5" y2="-36" stroke="#fef08a" strokeWidth="1" />
          {/* Red Terracotta Port Warehouses */}
          <rect x="8" y="-12" width="15" height="10" fill="#e7e5e4" />
          <polygon points="6,-12 15.5,-18 25,-12" fill="#c2410c" />
        </g>
      )}

      {archStyle === 'africa_fort' && (
        <g>
          {/* Coastal Stone Bastion Fort */}
          <rect x="-22" y="-17" width="20" height="15" fill="#d6d3d1" stroke="#57534e" strokeWidth="0.8" />
          <path d="M -22 -17 L -22 -20 L -18 -20 L -18 -17 L -14 -17 L -14 -20 L -10 -20 L -10 -17 L -6 -17 L -6 -20 L -2 -20 L -2 -17" fill="#a8a29e" />
          {/* Traditional Conical Thatched Huts */}
          <rect x="2" y="-9" width="9" height="7" fill="#b45309" />
          <polygon points="0,-9 6.5,-17 13,-9" fill="#d97706" />
          <rect x="13" y="-8" width="8" height="6" fill="#b45309" />
          <polygon points="11,-8 17,-15 23,-8" fill="#d97706" />
          {/* Palm Tree */}
          <line x1="25" y1="-2" x2="24" y2="-16" stroke="#78350f" strokeWidth="1.5" />
          <path d="M 24 -16 Q 18 -19 16 -14 M 24 -16 Q 29 -19 31 -14 M 24 -16 Q 24 -22 27 -20" stroke="#15803d" strokeWidth="1.4" fill="none" />
        </g>
      )}

      {archStyle === 'swahili_arab' && (
        <g>
          {/* Whitewashed Coral-Stone Houses & Wind Towers */}
          <rect x="-23" y="-14" width="12" height="12" fill="#f5f5f4" stroke="#a8a29e" strokeWidth="0.6" />
          <rect x="10" y="-13" width="13" height="11" fill="#e7e5e4" stroke="#a8a29e" strokeWidth="0.6" />
          {/* Islamic Dome Mosque & Tall Minaret */}
          <rect x="-9" y="-16" width="16" height="14" fill="#fafaf9" stroke="#78716c" strokeWidth="0.7" />
          <path d="M -7 -16 Q -1 -28 5 -16 Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="0.7" />
          <rect x="7" y="-31" width="4" height="29" fill="#f5f5f4" stroke="#78716c" strokeWidth="0.6" />
          <polygon points="6.5,-31 9,-37 11.5,-31" fill="#fbbf24" />
          <circle cx="-1" cy="-24.5" r="1.1" fill="#fbbf24" />
        </g>
      )}

      {archStyle === 'india' && (
        <g>
          {/* Tiered Hindu Gopuram Temple Spire */}
          <polygon points="-14,-2 -10,-28 2,-28 6,-2" fill="#d97706" stroke="#78350f" strokeWidth="0.7" />
          <line x1="-12" y1="-9" x2="4" y2="-9" stroke="#fef3c7" strokeWidth="1" />
          <line x1="-11" y1="-16" x2="3" y2="-16" stroke="#fef3c7" strokeWidth="1" />
          <line x1="-10" y1="-22" x2="2" y2="-22" stroke="#fef3c7" strokeWidth="1" />
          <rect x="-9" y="-31" width="10" height="3" fill="#fbbf24" />
          {/* Arched Stone Trading Post */}
          <rect x="8" y="-13" width="15" height="11" fill="#fed7aa" stroke="#9a3412" strokeWidth="0.6" />
          {/* Coconut Palms */}
          <line x1="-20" y1="-2" x2="-19" y2="-18" stroke="#78350f" strokeWidth="1.4" />
          <path d="M -19 -18 Q -25 -20 -26 -15 M -19 -18 Q -13 -20 -12 -15" stroke="#16a34a" strokeWidth="1.5" fill="none" />
        </g>
      )}

      {archStyle === 'se_asia' && (
        <g>
          {/* Twin Tropical Volcanic Island Peaks */}
          <polygon points="-28,-2 -12,-28 4,-2" fill="#14532d" opacity="0.65" />
          <polygon points="-4,-2 14,-23 30,-2" fill="#166534" opacity="0.6" />
          {/* Multi-Tiered Nusantara Pagoda Roof Pavilion */}
          <rect x="-10" y="-10" width="18" height="8" fill="#78350f" />
          <polygon points="-14,-10 -1,-17 12,-10" fill="#b45309" stroke="#451a03" strokeWidth="0.6" />
          <polygon points="-11,-16 -1,-23 9,-16" fill="#d97706" stroke="#451a03" strokeWidth="0.6" />
          <polygon points="-7,-22 -1,-28 5,-22" fill="#f59e0b" />
          {/* Palms */}
          <line x1="16" y1="-2" x2="17" y2="-16" stroke="#78350f" strokeWidth="1.3" />
          <path d="M 17 -16 Q 11 -18 10 -13 M 17 -16 Q 23 -18 24 -13" stroke="#22c55e" strokeWidth="1.4" fill="none" />
        </g>
      )}

      {archStyle === 'east_asia' && (
        <g>
          {/* Stone Harbor Wall & Upturned Curved Tiled Roofs */}
          <rect x="-24" y="-8" width="48" height="6" fill="#64748b" />
          {/* Multi-Story Pagoda Tower */}
          <rect x="-18" y="-26" width="8" height="18" fill="#cbd5e1" stroke="#334155" strokeWidth="0.6" />
          <path d="M -22,-16 Q -14,-19 -6,-16" stroke="#1e293b" strokeWidth="2.2" fill="none" />
          <path d="M -21,-22 Q -14,-25 -7,-22" stroke="#1e293b" strokeWidth="2.2" fill="none" />
          <path d="M -20,-27 Q -14,-31 -8,-27" stroke="#0f172a" strokeWidth="2.2" fill="none" />
          {/* Curved Gate Pavilion (팔작 기와지붕) */}
          <rect x="-2" y="-16" width="22" height="8" fill="#991b1b" />
          <path d="M -6,-16 Q 9,-24 24,-16 L 20,-13 Q 9,-17 -2,-13 Z" fill="#1e293b" stroke="#94a3b8" strokeWidth="0.5" />
          <circle cx="9" cy="-11" r="1.4" fill="#f87171" />
        </g>
      )}

      {archStyle === 'americas' && (
        <g>
          {/* Stepped Mesoamerican Stone Pyramid Terrace */}
          <rect x="-24" y="-7" width="22" height="5" fill="#d6d3d1" stroke="#57534e" strokeWidth="0.6" />
          <rect x="-21" y="-12" width="16" height="5" fill="#e7e5e4" stroke="#57534e" strokeWidth="0.6" />
          <rect x="-18" y="-17" width="10" height="5" fill="#d6d3d1" stroke="#57534e" strokeWidth="0.6" />
          <rect x="-16" y="-21" width="6" height="4" fill="#a8a29e" />
          {/* Colonial Stucco Bell-Gable Mission */}
          <rect x="4" y="-14" width="16" height="12" fill="#fef3c7" stroke="#b45309" strokeWidth="0.6" />
          <path d="M 8,-14 Q 12,-24 16,-14 Z" fill="#fde68a" stroke="#b45309" strokeWidth="0.6" />
          <circle cx="12" cy="-17" r="1.3" fill="#78350f" />
        </g>
      )}

      {archStyle === 'strait' && (
        <g>
          {/* Snow-Capped Fjord Cliffs & Beacon Tower */}
          <polygon points="-28,-2 -14,-32 0,-2" fill="#334155" />
          <polygon points="-18,-22 -14,-32 -10,-22" fill="#f8fafc" />
          <polygon points="0,-2 14,-29 28,-2" fill="#475569" />
          <polygon points="10,-21 14,-29 18,-21" fill="#f8fafc" />
          <rect x="-3" y="-16" width="6" height="14" fill="#78350f" />
          <circle cx="0" cy="-18" r="2.2" fill="#fb923c" opacity="0.9" />
        </g>
      )}
    </g>
  );
}
