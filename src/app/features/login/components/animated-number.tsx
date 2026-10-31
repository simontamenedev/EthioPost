"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { fmt } from "./login-data";

/* ---------- animated number ---------- */
export function AnimatedNumber({ value }: { value: number }) {
  const v = useMotionValue(value);
  const text = useTransform(v, (n) => fmt(Math.round(n)));
  useEffect(() => {
    const c = animate(v, value, { duration: 0.35, ease: "easeOut" });
    return () => c.stop();
  }, [value, v]);
  return <motion.span>{text}</motion.span>;
}
