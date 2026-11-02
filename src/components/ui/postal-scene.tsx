"use client";

import { motion, useReducedMotion } from "framer-motion";

const GOLD = "#f3ad1c";
const NAVY = "#2c317b";
const linear = "linear" as const;
const box = { transformBox: "fill-box", transformOrigin: "center" } as const;

/** Wavy filled path, period 80px: translating by -80 loops seamlessly. */
function wave(y: number, amp: number) {
  let d = `M0 ${y} Q20 ${y - amp} 40 ${y}`;
  for (let x = 80; x <= 720; x += 40) d += ` T${x} ${y}`;
  return `${d} V290 H0 Z`;
}

/** [x, width, height] — one 240px tile of skyline, repeated for the parallax scroll. */
const BUILDINGS: [number, number, number][] = [
  [0, 22, 34], [24, 16, 52], [42, 26, 40], [70, 18, 64], [90, 24, 44],
  [116, 20, 30], [138, 28, 58], [168, 18, 38], [188, 24, 50], [214, 26, 36],
];

function Wheel({ x, still }: { x: number; still: boolean }) {
  return (
    <g transform={`translate(${x},10)`}>
      <motion.g
        style={box}
        {...(still ? {} : { animate: { rotate: 360 }, transition: { duration: 0.5, ease: linear, repeat: Infinity } })}
      >
        <circle r="6.5" className="fill-slate-800 dark:fill-black" />
        <circle r="3" fill="#cbd5e1" />
        <path d="M0 -3V3M-3 0H3" stroke="#64748b" strokeWidth="1" />
      </motion.g>
    </g>
  );
}

function Puff({
  still, delay, dx, dy, r, className,
}: { still: boolean; delay: number; dx: number; dy: number; r: number; className: string }) {
  if (still) return null;
  return (
    <motion.circle
      r={r}
      className={className}
      style={box}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.55, 0], scale: [0.4, 1.7], x: [0, dx], y: [0, dy] }}
      transition={{ duration: 1.3, repeat: Infinity, delay, ease: "easeOut" }}
    />
  );
}

export function PostalScene({ className }: { className?: string }) {
  const still = !!useReducedMotion();

  const travel = (from: number, to: number, duration: number, delay = 0) =>
    still
      ? { animate: { x: (from + to) / 2 }, transition: { duration: 0 } }
      : { animate: { x: [from, to] }, transition: { duration, ease: linear, repeat: Infinity, delay } };

  const loop = (animate: Record<string, number[]>, duration: number) =>
    still ? {} : { animate, transition: { duration, ease: "easeInOut" as const, repeat: Infinity } };

  return (
    <svg viewBox="0 0 480 290" aria-hidden className={className}>
      <defs>
        <linearGradient id="ps-sky-l" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfdbfe" />
          <stop offset="1" stopColor="#f8fafc" />
        </linearGradient>
        <linearGradient id="ps-sky-d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1040" />
          <stop offset="1" stopColor="#2c317b" />
        </linearGradient>
      </defs>

      {/* sky */}
      <rect width="480" height="290" fill="url(#ps-sky-l)" className="dark:hidden" />
      <rect width="480" height="290" fill="url(#ps-sky-d)" className="hidden dark:block" />

      {/* sun (day) / moon + stars (night) */}
      <g className="dark:hidden">
        <motion.circle cx="410" cy="52" r="26" fill={GOLD} opacity="0.25" style={box}
          {...(still ? {} : { animate: { scale: [1, 1.18, 1] }, transition: { duration: 4, repeat: Infinity, ease: "easeInOut" } })} />
        <circle cx="410" cy="52" r="15" fill={GOLD} />
      </g>
      <g className="hidden dark:block">
        <circle cx="410" cy="52" r="14" fill="#e2e8f0" />
        <circle cx="404" cy="48" r="3" fill="#cbd5e1" />
        {[[60, 30], [130, 70], [200, 22], [290, 60], [340, 26], [450, 100], [30, 100]].map(([x, y], i) => (
          <motion.circle key={i} cx={x} cy={y} r="1.3" fill="white"
            {...(still ? {} : { animate: { opacity: [0.2, 1, 0.2] }, transition: { duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.3 } })} />
        ))}
      </g>

      {/* far mountains */}
      <path d="M0 170V135L60 102L110 138L170 96L240 142L300 106L370 140L430 100L480 128V170Z" className="fill-slate-200/80 dark:fill-white/5" />

      {/* clouds */}
      <motion.g {...travel(-80, 540, 40)}>
        <g transform="translate(0,34)" className="fill-white dark:fill-white/10">
          <ellipse rx="24" ry="7" /><ellipse cx="12" cy="-6" rx="15" ry="8" /><ellipse cx="-12" cy="-4" rx="12" ry="6" />
        </g>
      </motion.g>
      <motion.g {...travel(-80, 540, 58, -25)}>
        <g transform="translate(0,92)" className="fill-white/80 dark:fill-white/10">
          <ellipse rx="28" ry="8" /><ellipse cx="-10" cy="-6" rx="15" ry="8" />
        </g>
      </motion.g>

      {/* gulls */}
      <motion.g {...travel(-40, 520, 24, -8)}>
        <g transform="translate(0,120)">
          <motion.path d="M0 0q4-5 8 0q4-5 8 0" fill="none" strokeWidth="1.4" strokeLinecap="round" style={box}
            className="stroke-slate-500 dark:stroke-white/60"
            {...(still ? {} : { animate: { scaleY: [1, 0.3, 1] }, transition: { duration: 0.6, repeat: Infinity } })} />
        </g>
      </motion.g>

      {/* skyline (parallax) */}
      <g transform="translate(0,170)">
        <motion.g {...(still ? {} : { animate: { x: [0, -240] }, transition: { duration: 14, ease: linear, repeat: Infinity } })}>
          {[0, 240, 480].map((off) => (
            <g key={off} transform={`translate(${off},0)`}>
              {BUILDINGS.map(([x, w, h], i) => (
                <g key={i}>
                  <rect x={x} y={-h} width={w} height={h} className="fill-[#2c317b]/20 dark:fill-[#4a51b8]/40" />
                  <rect x={x + w / 2 - 1.5} y={-h + 7} width="3" height="3" fill={GOLD} className="opacity-0 dark:opacity-70" />
                  <rect x={x + w / 2 - 1.5} y={-h + 15} width="3" height="3" fill={GOLD} className="opacity-0 dark:opacity-50" />
                </g>
              ))}
            </g>
          ))}
        </motion.g>
      </g>

      {/* ground + quay */}
      <rect y="170" width="480" height="120" className="fill-slate-100 dark:fill-[#10144f]" />

      {/* ✈ airplane towing the brand banner */}
      <g transform="translate(0,56)">
        <motion.g {...travel(-210, 560, 9)}>
          <motion.g {...loop({ y: [0, -5, 0, 4, 0], rotate: [-1.5, 1, -1.5] }, 3.4)}>
            {/* tow line + banner */}
            <line x1="-32" y1="0" x2="-46" y2="0" strokeWidth="1" className="stroke-slate-500 dark:stroke-white/60" />
         
            {/* airliner */}
            <path d="M-31 -4L-39 -21L-31 -21L-16 -8Z" fill={NAVY} />
            <path d="M-31 -21L-33 -21L-39 -21" stroke={GOLD} strokeWidth="2" />
            <path d="M-27 -2L-37 -8L-32 -8L-21 -3Z" className="fill-slate-300 dark:fill-slate-300" />
            <path d="M2 2L-16 17L-7 17L17 2Z" className="fill-slate-300 stroke-slate-400 dark:stroke-none" strokeWidth="0.6" />
            <ellipse cx="5" cy="11" rx="7" ry="3.2" className="fill-slate-500 dark:fill-slate-400" />
            <path d="M-31 -4C-31 -8 -18 -9.5 0 -9.5L18 -9.5C28 -9.5 36 -4 38 0C36 4 28 6.5 18 6.5L-8 6.5C-21 6.5 -31 3 -31 -4Z"
              className="fill-white stroke-[#2c317b]/50 dark:stroke-none" strokeWidth="0.8" />
            <path d="M-29 3H34" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M24 -8C30 -7 34 -4 35 -2L24 -2Z" fill="#7dd3fc" />
            {[-12, -7, -2, 3, 8, 13, 18].map((x) => <circle key={x} cx={x} cy="-3" r="1.3" fill="#7dd3fc" />)}
            <motion.circle cx="-7" cy="17" r="1.6" fill="#ef4444"
              {...(still ? {} : { animate: { opacity: [1, 0.1, 1] }, transition: { duration: 1, repeat: Infinity } })} />
          </motion.g>
        </motion.g>
      </g>

      {/* 🚚 road + post van */}
      <g transform="translate(0,172)">
        <rect width="480" height="22" className="fill-slate-300 dark:fill-[#1b1f6b]" />
        <motion.path d="M0 17H480" strokeWidth="2" strokeDasharray="14 12" strokeLinecap="round" className="stroke-white/80 dark:stroke-white/30"
          {...(still ? {} : { animate: { strokeDashoffset: [0, 26] }, transition: { duration: 0.45, ease: linear, repeat: Infinity } })} />
        <motion.g {...travel(-90, 560, 6)}>
          {/* exhaust + speed lines behind the van */}
          <g transform="translate(-4,8)">
            <Puff still={still} delay={0} dx={-26} dy={-8} r={3} className="fill-slate-400 dark:fill-white/40" />
            <Puff still={still} delay={0.45} dx={-26} dy={-8} r={3} className="fill-slate-400 dark:fill-white/40" />
            <Puff still={still} delay={0.9} dx={-26} dy={-8} r={3} className="fill-slate-400 dark:fill-white/40" />
          </g>
          {!still && [-10, -2, 6].map((y, i) => (
            <motion.line key={y} x1="-8" x2="-26" y1={y} y2={y} strokeWidth="1.2" strokeLinecap="round"
              className="stroke-slate-400 dark:stroke-white/40"
              animate={{ opacity: [0, 0.8, 0], x: [0, -10] }}
              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15 }} />
          ))}
          <motion.g {...loop({ y: [0, -0.9, 0] }, 0.3)}>
            <path d="M62 -4L110 -14L110 6Z" fill={GOLD} opacity="0.18" />
            <rect x="0" y="-26" width="42" height="30" rx="3" fill={NAVY} className="dark:fill-[#4a51b8]" />
            <rect x="0" y="-11" width="42" height="4" fill={GOLD} />
            <text x="21" y="-14" textAnchor="middle" fontSize="9" fontWeight="800" letterSpacing="1" fill="white">POST</text>
            <path d="M42 -18H54L62 -6V4H42Z" fill={NAVY} className="dark:fill-[#4a51b8]" />
            <path d="M45 -15H53L58 -7H45Z" className="fill-sky-100 dark:fill-sky-200/80" />
            <rect x="-2" y="4" width="66" height="6" rx="2" className="fill-slate-800 dark:fill-black" />
            <rect x="59" y="-3" width="4" height="4" rx="1" fill={GOLD} />
            <Wheel x={12} still={still} />
            <Wheel x={50} still={still} />
          </motion.g>
        </motion.g>
      </g>

      {/* 🚢 sea: back wave → ship → front wave */}
      <motion.path d={wave(206, 7)} className="fill-[#2c317b]/15 dark:fill-white/10"
        {...(still ? {} : { animate: { x: [0, -80] }, transition: { duration: 5, ease: linear, repeat: Infinity } })} />

      <g transform="translate(0,222)">
        <motion.g {...travel(-150, 530, 17)}>
          {/* wake + bow wave stay on the waterline */}
          <motion.ellipse cx="-14" cy="6" rx="22" ry="3" className="fill-white/70" style={box}
            {...(still ? {} : { animate: { opacity: [0.8, 0.25, 0.8], scaleX: [1, 1.35, 1] }, transition: { duration: 1.6, repeat: Infinity } })} />
          <motion.ellipse cx="112" cy="5" rx="8" ry="3" className="fill-white/80" style={box}
            {...(still ? {} : { animate: { scale: [1, 1.3, 1] }, transition: { duration: 1.2, repeat: Infinity } })} />

          <motion.g style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }} {...loop({ rotate: [-1.8, 1.8, -1.8], y: [0, -2, 0] }, 3.4)}>
            {/* funnel smoke */}
            <g transform="translate(15,-40)">
              <Puff still={still} delay={0} dx={-24} dy={-18} r={4} className="fill-slate-400 dark:fill-white/40" />
              <Puff still={still} delay={0.6} dx={-24} dy={-18} r={4} className="fill-slate-400 dark:fill-white/40" />
              <Puff still={still} delay={1.2} dx={-24} dy={-18} r={4} className="fill-slate-400 dark:fill-white/40" />
            </g>
            {/* containers */}
            <rect x="30" y="-24" width="17" height="11" fill={GOLD} />
            <rect x="48" y="-24" width="17" height="11" className="fill-white stroke-slate-300 dark:stroke-none" />
            <rect x="66" y="-24" width="17" height="11" className="fill-[#4a51b8]" />
            <rect x="84" y="-24" width="17" height="11" fill={GOLD} />
            <rect x="39" y="-35" width="17" height="11" className="fill-[#4a51b8]" />
            <rect x="57" y="-35" width="17" height="11" fill={GOLD} />
            <rect x="75" y="-35" width="17" height="11" className="fill-white stroke-slate-300 dark:stroke-none" />
            {/* bridge + funnel */}
            <rect x="6" y="-30" width="20" height="18" rx="2" className="fill-slate-100 dark:fill-slate-200" />
            <rect x="9" y="-26" width="14" height="4" fill={NAVY} />
            <rect x="12" y="-39" width="7" height="9" fill={GOLD} />
            {/* hull */}
            <path d="M0 -12H114L97 8H13Z" fill={NAVY} className="dark:fill-[#3b41a3]" />
            <path d="M3 -6H110L106 -2H6Z" fill={GOLD} />
          </motion.g>
        </motion.g>
      </g>

      <motion.path d={wave(228, 6)} className="fill-[#2c317b]/30 dark:fill-white/15"
        {...(still ? {} : { animate: { x: [-80, 0] }, transition: { duration: 3.4, ease: linear, repeat: Infinity } })} />
    </svg>
  );
}