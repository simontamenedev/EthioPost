"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

type Props = { value: number; decimals?: number; duration?: number; className?: string };

/* Counts from 0 to `value` on mount and whenever `value` changes. */
export function CountUp({ value, decimals = 0, duration = 1.1, className }: Props) {
  const reduce = useReducedMotion();
  const v = useMotionValue(reduce ? value : 0);
  const text = useTransform(v, (n) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));

  useEffect(() => {
    if (reduce) { v.set(value); return; }
    const controls = animate(v, value, { duration, ease: "easeOut" });
    return () => controls.stop();
  }, [value, duration, reduce, v]);

  return <motion.span className={`tabular-nums ${className ?? ""}`}>{text}</motion.span>;
}
