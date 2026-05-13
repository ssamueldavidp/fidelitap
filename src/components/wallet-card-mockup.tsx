'use client'

interface WalletCardMockupProps {
  mode: 'wallet' | 'scan' | 'success'
}

export function WalletCardMockup({ mode }: WalletCardMockupProps) {
  return (
    <div className="relative w-[248px] bg-[#1a1a1a] rounded-[44px] p-2.5 shadow-2xl ring-1 ring-white/10 mx-auto">
      {/* Inner screen */}
      <div className="bg-black rounded-[38px] overflow-hidden relative">
        {/* Status bar */}
        <div className="relative bg-black px-5 pt-3 pb-1 flex items-center justify-between">
          <div
            className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[90px] h-7 bg-black rounded-[20px] z-20"
            aria-hidden
          />
          <span className="text-white text-[11px] font-semibold z-10">9:41</span>
          <div className="flex items-center gap-1 z-10">
            {/* Signal bars */}
            <svg width="16" height="12" viewBox="0 0 16 12" fill="white">
              <rect x="0" y="6" width="3" height="6" rx="0.5"/>
              <rect x="4.5" y="4" width="3" height="8" rx="0.5"/>
              <rect x="9" y="2" width="3" height="10" rx="0.5"/>
              <rect x="13.5" y="0" width="2.5" height="12" rx="0.5"/>
            </svg>
            {/* Battery */}
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
              <rect x="0" y="1" width="20" height="10" rx="2.5" stroke="white" strokeWidth="1"/>
              <rect x="1" y="2" width="16" height="8" rx="1.5" fill="white"/>
              <path d="M21 4v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* Screen content */}
        <div className="min-h-[420px]">
          {mode === 'wallet' && <WalletScreen />}
          {mode === 'scan' && <ScanScreen />}
          {mode === 'success' && <SuccessScreen />}
        </div>
      </div>
    </div>
  )
}

function WalletScreen() {
  return (
    <div className="bg-[#f2f2f7] min-h-[420px] p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="font-bold text-black text-base">Wallet</span>
        <span className="text-[#007AFF] text-sm font-medium">+ Agregar</span>
      </div>
      {/* Main card */}
      <div className="rounded-2xl overflow-hidden shadow-lg mb-2" style={{ background: 'linear-gradient(145deg, #0f172a, #1a2e4a)' }}>
        <div className="p-3.5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-base">☕</div>
              <div>
                <div className="text-white text-[13px] font-bold">Café Luna</div>
                <div className="text-white/50 text-[10px]">Tarjeta de sellos</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white text-[11px] font-bold">3 / 5</div>
              <div className="text-white/40 text-[9px]">sellos</div>
            </div>
          </div>
          <div className="flex gap-1.5 mb-2.5">
            {['on','on','on','off','off'].map((s, i) => (
              <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${s === 'on' ? 'bg-[#00C896]' : 'bg-white/10 border border-white/20'}`}>
                {s === 'on' ? '☕' : ''}
              </div>
            ))}
          </div>
          <div className="bg-black/20 rounded-xl p-2.5 text-[11px]">
            <div className="text-white/40 text-[9px] uppercase tracking-wide mb-0.5">Premio</div>
            <div className="text-white font-semibold">🎁 1 café gratis al completar</div>
          </div>
        </div>
        <div className="bg-white/5 px-3.5 py-2.5 flex items-center justify-between">
          <div>
            <div className="text-white/80 font-mono text-[10px] font-bold tracking-wider">FDL-A2X9-K7M3</div>
            <div className="text-white/30 text-[9px] mt-0.5">FIDELITAP</div>
          </div>
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 21 21">
              <rect x="0" y="0" width="7" height="7" rx="1" fill="#0f172a"/><rect x="1" y="1" width="5" height="5" rx="0.3" fill="white"/><rect x="2" y="2" width="3" height="3" fill="#0f172a"/>
              <rect x="14" y="0" width="7" height="7" rx="1" fill="#0f172a"/><rect x="15" y="1" width="5" height="5" rx="0.3" fill="white"/><rect x="16" y="2" width="3" height="3" fill="#0f172a"/>
              <rect x="0" y="14" width="7" height="7" rx="1" fill="#0f172a"/><rect x="1" y="15" width="5" height="5" rx="0.3" fill="white"/><rect x="2" y="16" width="3" height="3" fill="#0f172a"/>
              <rect x="9" y="0" width="2" height="2" fill="#0f172a"/><rect x="9" y="3" width="2" height="2" fill="#0f172a"/>
              <rect x="9" y="9" width="2" height="2" fill="#0f172a"/><rect x="12" y="9" width="2" height="2" fill="#0f172a"/>
              <rect x="14" y="9" width="2" height="4" fill="#0f172a"/><rect x="17" y="9" width="4" height="2" fill="#0f172a"/>
            </svg>
          </div>
        </div>
      </div>
      {/* Peeking cards */}
      {[{ icon: '💇', name: 'Studio Hair', stamps: '2/5' }, { icon: '🍕', name: 'Don Pizzas', stamps: '3/5' }].map(c => (
        <div key={c.name} className="rounded-xl bg-slate-700/60 px-3 py-2 flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base">{c.icon}</span>
            <div>
              <div className="text-white text-[12px] font-semibold">{c.name}</div>
              <div className="text-white/40 text-[10px]">{c.stamps} sellos</div>
            </div>
          </div>
          <span className="text-white/30 text-sm">›</span>
        </div>
      ))}
    </div>
  )
}

function ScanScreen() {
  return (
    <div className="bg-black min-h-[420px] flex flex-col items-center justify-center gap-4 p-5">
      <div className="text-center">
        <div className="text-white/40 text-[10px] tracking-widest uppercase mb-1">Café Luna</div>
        <div className="text-white text-[15px] font-bold">Mi tarjeta de sellos</div>
      </div>
      <div className="relative w-[140px] h-[140px] border border-white/10 rounded-xl flex items-center justify-center">
        <div className="absolute top-[-2px] left-[-2px] w-5 h-5 border-t-[3px] border-l-[3px] border-[#00C896] rounded-tl" />
        <div className="absolute top-[-2px] right-[-2px] w-5 h-5 border-t-[3px] border-r-[3px] border-[#00C896] rounded-tr" />
        <div className="absolute bottom-[-2px] left-[-2px] w-5 h-5 border-b-[3px] border-l-[3px] border-[#00C896] rounded-bl" />
        <div className="absolute bottom-[-2px] right-[-2px] w-5 h-5 border-b-[3px] border-r-[3px] border-[#00C896] rounded-br" />
        <svg width="80" height="80" viewBox="0 0 21 21">
          <rect x="0" y="0" width="7" height="7" rx="1" fill="white"/><rect x="1" y="1" width="5" height="5" rx="0.3" fill="#000"/><rect x="2" y="2" width="3" height="3" fill="white"/>
          <rect x="14" y="0" width="7" height="7" rx="1" fill="white"/><rect x="15" y="1" width="5" height="5" rx="0.3" fill="#000"/><rect x="16" y="2" width="3" height="3" fill="white"/>
          <rect x="0" y="14" width="7" height="7" rx="1" fill="white"/><rect x="1" y="15" width="5" height="5" rx="0.3" fill="#000"/><rect x="2" y="16" width="3" height="3" fill="white"/>
          <rect x="9" y="9" width="5" height="2" fill="white"/><rect x="15" y="9" width="6" height="2" fill="white"/>
          <rect x="9" y="12" width="3" height="4" fill="white"/><rect x="13" y="14" width="8" height="7" fill="white"/>
        </svg>
      </div>
      <div className="bg-white/5 rounded-xl px-5 py-2 text-center">
        <div className="text-white/30 text-[9px] uppercase tracking-widest mb-1">Código único</div>
        <div className="text-white font-mono text-[13px] font-bold tracking-widest">FDL-A2X9-K7M3</div>
      </div>
      <div className="text-white/25 text-[10px] text-center leading-relaxed">
        Muestra este QR al negocio<br />para recibir tu sello de visita
      </div>
    </div>
  )
}

function SuccessScreen() {
  return (
    <div className="bg-[#111] min-h-[420px] flex flex-col items-center justify-center gap-4 p-5">
      <div className="w-16 h-16 bg-[#00C896] rounded-full flex items-center justify-center text-3xl shadow-[0_0_0_12px_rgba(0,200,150,0.12)]">
        ✓
      </div>
      <div className="text-white text-[18px] font-black tracking-tight">¡Sello registrado!</div>
      <div className="bg-white/5 rounded-xl p-4 w-full text-center">
        <div className="text-white/30 text-[10px] tracking-widest uppercase mb-3">CAFÉ LUNA · MARÍA GONZÁLEZ</div>
        <div className="flex gap-1.5 justify-center mb-3">
          {[true, true, true, true, false].map((filled, i) => (
            <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${filled ? (i === 3 ? 'bg-[#00C896] shadow-[0_0_12px_rgba(0,200,150,0.7)]' : 'bg-[#00C896]') : 'bg-white/10'}`}>
              {filled ? '☕' : ''}
            </div>
          ))}
        </div>
        <div className="text-[#00C896] text-[15px] font-black">4 / 5 sellos</div>
        <div className="text-white/30 text-[11px] mt-1">¡Un sello más y ganas tu café gratis! 🎉</div>
      </div>
      <div className="flex items-center gap-1.5 text-white/30 text-[10px]">
        <span className="text-[#00C896]">✓</span>
        Wallet actualizada automáticamente
      </div>
    </div>
  )
}
