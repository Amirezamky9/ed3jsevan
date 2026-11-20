import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MenuCategory, MenuItem } from '../data/menuData';
import {
  calculateItemPrice,
  computeShortestWheelAngle,
  formatToman,
  getDefaultBean,
  getWheelSlotPosition,
  toPersianDigits,
} from '../utils/menuLogic';
import { easeOutCubic, projectTableSeat } from '../utils/tableProjection';
import { EyvanLogo } from './EyvanLogo';

export type CameraAngle = 'top' | 'front';

interface RotaryTableStageProps {
  category: MenuCategory;
  items: MenuItem[];
  activeIndex: number;
  overviewMode: boolean;
  cameraAngle: CameraAngle;
  drawerOpen: boolean;
  onSelectIndex: (index: number) => void;
  onStep: (delta: number) => void;
  onExitOverviewToIndex: (index: number) => void;
  onChangeCameraAngle: (angle: CameraAngle) => void;
}

interface AnimatedCameraState {
  wheelAngle: number;
  pitch: number;
  cx: number;
  cy: number;
  scale: number;
}

const PERSPECTIVE_PX = 1400;
const FOCAL_ANGLE_DEG = 180; // 6 o'clock front-center in BOTH top-down and eye-level modes so camera descends without spinning the drink away!

/**
 * Overhead brushed antique-gold dining cloche SVG rendered cleanly onto the
 * circular marble tabletop for the 3 "Coming Soon" sections (صبحانه، پیش‌غذا، غذای اصلی).
 */
function ComingSoonClochePlate({ label }: { label: string }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center select-none">
      <svg
        viewBox="0 0 260 260"
        className="h-[88%] w-[88%] drop-shadow-[0_14px_22px_rgba(14,21,37,0.24)]"
        aria-label={`سرویس ${label} به‌زودی`}
      >
        <defs>
          <radialGradient id="clochePlate" cx="45%" cy="42%" r="56%">
            <stop offset="0%" stopColor="#FAF8F4" />
            <stop offset="78%" stopColor="#EBE6DC" />
            <stop offset="100%" stopColor="#D6CFC1" />
          </radialGradient>
          <radialGradient id="clocheGold" cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#F0D8A8" />
            <stop offset="35%" stopColor="#CFA864" />
            <stop offset="74%" stopColor="#9A763B" />
            <stop offset="100%" stopColor="#6D5224" />
          </radialGradient>
          <radialGradient id="clocheKnob" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FAF0D7" />
            <stop offset="55%" stopColor="#C8A05A" />
            <stop offset="100%" stopColor="#6E5122" />
          </radialGradient>
        </defs>

        <circle cx="130" cy="130" r="108" fill="url(#clochePlate)" />
        <circle
          cx="130"
          cy="130"
          r="102"
          fill="none"
          stroke="#293B5F"
          strokeWidth="4.5"
        />
        <circle
          cx="130"
          cy="130"
          r="95"
          fill="none"
          stroke="#AF894B"
          strokeWidth="1.2"
          strokeOpacity="0.65"
        />

        <circle cx="130" cy="130" r="72" fill="url(#clocheGold)" />
        <circle
          cx="130"
          cy="130"
          r="66"
          fill="none"
          stroke="#F7E6C2"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
        <path
          d="M 86 104 A 52 52 0 0 1 154 84"
          fill="none"
          stroke="#FFF7E6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeOpacity="0.4"
        />

        <circle cx="130" cy="130" r="14" fill="rgba(14,21,37,0.22)" />
        <circle cx="130" cy="130" r="11" fill="url(#clocheKnob)" />
        <circle cx="127" cy="127" r="3" fill="#FFF8E8" fillOpacity="0.7" />
      </svg>
    </div>
  );
}

/**
 * Handcrafted architectural alabaster-marble veining and radial antique-gold inlays
 * baked directly onto the rotating tabletop so every degree of table rotation is unmistakably physical.
 */
function MarbleTableInlays({ slotCount }: { slotCount: number }) {
  const safeCount = Math.max(4, slotCount);
  const spokes = Array.from({ length: safeCount }, (_, i) => {
    const angleRad = ((i / safeCount) * 360 * Math.PI) / 180;
    const x1 = 500 + Math.sin(angleRad) * 185;
    const y1 = 500 - Math.cos(angleRad) * 185;
    const x2 = 500 + Math.sin(angleRad) * 468;
    const y2 = 500 - Math.cos(angleRad) * 468;
    const tx = 500 + Math.sin(angleRad) * 480;
    const ty = 500 - Math.cos(angleRad) * 480;
    return { i, x1, y1, x2, y2, tx, ty };
  });

  return (
    <svg
      viewBox="0 0 1000 1000"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full rounded-full"
    >
      {/* Subtle asymmetric natural stone veining (gives clear visual motion cues as table revolves) */}
      <g fill="none" strokeLinecap="round">
        <path
          d="M 110 340 C 245 310, 310 420, 445 395 C 580 370, 665 245, 865 280"
          stroke="#9E9483"
          strokeOpacity="0.22"
          strokeWidth="3.2"
        />
        <path
          d="M 140 358 C 260 335, 325 438, 456 410 C 578 384, 678 272, 845 302"
          stroke="#AF894B"
          strokeOpacity="0.16"
          strokeWidth="1.4"
        />
        <path
          d="M 180 680 C 310 615, 420 675, 560 620 C 690 570, 770 635, 910 565"
          stroke="#8E8473"
          strokeOpacity="0.2"
          strokeWidth="2.8"
        />
        <path
          d="M 290 120 C 360 260, 465 310, 485 480 C 505 645, 430 760, 520 910"
          stroke="#9B9180"
          strokeOpacity="0.16"
          strokeWidth="2.2"
        />
        <path
          d="M 650 115 C 615 240, 680 355, 620 495 C 565 620, 690 740, 745 875"
          stroke="#AF894B"
          strokeOpacity="0.14"
          strokeWidth="1.6"
        />
        <path
          d="M 95 535 C 215 490, 295 570, 395 545"
          stroke="#8A806E"
          strokeOpacity="0.18"
          strokeWidth="2"
        />
      </g>

      {/* Architectural brass inlaid concentric circles */}
      <circle
        cx="500"
        cy="500"
        r="476"
        fill="none"
        stroke="#AF894B"
        strokeOpacity="0.34"
        strokeWidth="1.6"
      />
      <circle
        cx="500"
        cy="500"
        r="464"
        fill="none"
        stroke="#293B5F"
        strokeOpacity="0.1"
        strokeWidth="1"
      />
      <circle
        cx="500"
        cy="500"
        r="182"
        fill="none"
        stroke="#AF894B"
        strokeOpacity="0.26"
        strokeWidth="1.4"
      />
      <circle
        cx="500"
        cy="500"
        r="164"
        fill="none"
        stroke="#293B5F"
        strokeOpacity="0.09"
        strokeWidth="1"
      />

      {/* Radial antique-gold divider lines & rim compass markers that visibly sweep as the table turns */}
      {spokes.map((s) => (
        <g key={s.i}>
          <line
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke="#AF894B"
            strokeOpacity="0.16"
            strokeWidth="1.2"
            strokeDasharray="4 6"
          />
          <circle cx={s.tx} cy={s.ty} r="3.2" fill="#AF894B" fillOpacity="0.52" />
        </g>
      ))}
    </svg>
  );
}

export const RotaryTableStage: React.FC<RotaryTableStageProps> = ({
  category,
  items,
  activeIndex,
  overviewMode,
  cameraAngle,
  drawerOpen,
  onSelectIndex,
  onStep,
  onExitOverviewToIndex,
  onChangeCameraAngle,
}) => {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));
  const [hoveredOverviewIndex, setHoveredOverviewIndex] = useState<
    number | null
  >(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const isMobile = viewport.width < 1024;
  const isFrontCamera =
    cameraAngle === 'front' && !overviewMode && !category.comingSoon;

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Target camera & turntable geometry for the current viewport and mode
  const targetGeo = useMemo(() => {
    const vw = viewport.width;
    const vh = viewport.height;

    if (vw < 1024) {
      const tableDiameter = Math.min(468, Math.max(382, vw * 1.16));
      const overviewScale = Math.min(
        (vw - 28) / tableDiameter,
        (vh - 210) / tableDiameter,
      );

      // Mobile Top-Down: marble arc sweeps cleanly across upper ~42% with ZERO dead void below
      const topCx = vw * 0.5;
      const topCy = Math.max(104, vh * 0.145);
      // Mobile Front Eye-Level: marble slab sits cleanly around y = 36%..46% with generous marble in front & behind glass
      const frontCx = vw * 0.5;
      const frontCy = Math.max(226, vh * 0.355);
      const overviewCx = vw * 0.5;
      const overviewCy = vh * 0.49;

      const isCompactPhone = vh < 720;

      return {
        tableDiameter,
        ringRadiusPct: 30.5,
        dishSize: Math.round(tableDiameter * 0.28),
        tallCutoutH: Math.round(
          isCompactPhone
            ? Math.min(168, vh * 0.25)
            : Math.min(216, Math.max(176, vh * 0.255)),
        ),
        cupCutoutH: Math.round(
          isCompactPhone
            ? Math.min(126, vh * 0.19)
            : Math.min(156, Math.max(132, vh * 0.185)),
        ),
        cx: overviewMode ? overviewCx : isFrontCamera ? frontCx : topCx,
        cy: overviewMode ? overviewCy : isFrontCamera ? frontCy : topCy,
        scale: overviewMode
          ? overviewScale
          : isFrontCamera
            ? 0.94
            : 0.96,
        pitch: isFrontCamera ? 72 : 0,
      };
    }

    // Desktop (>= 1024px)
    const tableDiameter = Math.min(960, Math.max(760, vw * 0.67));
    const overviewScale = Math.min(
      (vh - 200) / tableDiameter,
      (vw - 140) / tableDiameter,
      0.72,
    );

    // Same horizontal axis (cx) in BOTH Top-Down & Front Camera so the camera smoothly swoops down
    // right in front of the active drink WITHOUT spinning the table sideways!
    const stageCx = drawerOpen ? vw * 0.275 : vw * 0.32;
    const topCy = vh * 0.245;
    const frontCy = vh * 0.645;
    const overviewCx = vw * 0.5;
    const overviewCy = vh * 0.51;

    const count = Math.max(items.length, 6);
    const dishRatio = count >= 10 ? 0.24 : count >= 8 ? 0.255 : 0.27;

    return {
      tableDiameter,
      ringRadiusPct: 30.5,
      dishSize: Math.round(tableDiameter * dishRatio),
      tallCutoutH: Math.round(Math.min(350, Math.max(270, vh * 0.385))),
      cupCutoutH: Math.round(Math.min(220, Math.max(175, vh * 0.242))),
      cx: overviewMode ? overviewCx : stageCx,
      cy: overviewMode ? overviewCy : isFrontCamera ? frontCy : topCy,
      scale: overviewMode
        ? overviewScale
        : isFrontCamera
          ? 0.96
          : 1.02,
      pitch: isFrontCamera ? 71 : 0,
    };
  }, [
    viewport.width,
    viewport.height,
    overviewMode,
    isFrontCamera,
    drawerOpen,
    items.length,
  ]);

  // Continuous target turntable wheel angle (180deg = front 6-o'clock seat in BOTH top & front modes)
  const targetWheelAngleRef = useRef<number>(
    computeShortestWheelAngle(
      FOCAL_ANGLE_DEG,
      activeIndex,
      Math.max(1, items.length),
      FOCAL_ANGLE_DEG,
    ),
  );
  const prevCategoryRef = useRef<string>(category.id);

  // Unified frame-by-frame rAF camera + turntable state (guarantees 0.0px drift between marble coasters and standing drinks!)
  const [anim, setAnim] = useState<AnimatedCameraState>(() => ({
    wheelAngle: targetWheelAngleRef.current,
    pitch: targetGeo.pitch,
    cx: targetGeo.cx,
    cy: targetGeo.cy,
    scale: targetGeo.scale,
  }));
  const animRef = useRef<AnimatedCameraState>(anim);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const count = Math.max(1, items.length);
    const categoryChanged = prevCategoryRef.current !== category.id;
    prevCategoryRef.current = category.id;

    let nextWheelAngle: number;
    if (categoryChanged) {
      const slotAngle = (activeIndex / count) * 360;
      nextWheelAngle = FOCAL_ANGLE_DEG - slotAngle;
      setHoveredOverviewIndex(null);
    } else {
      nextWheelAngle = computeShortestWheelAngle(
        targetWheelAngleRef.current,
        activeIndex,
        count,
        FOCAL_ANGLE_DEG,
      );
    }
    targetWheelAngleRef.current = nextWheelAngle;

    const target: AnimatedCameraState = {
      wheelAngle: nextWheelAngle,
      pitch: targetGeo.pitch,
      cx: targetGeo.cx,
      cy: targetGeo.cy,
      scale: targetGeo.scale,
    };

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion || categoryChanged) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      const snapped: AnimatedCameraState = {
        ...target,
        // Keep current pitch smooth even across category switches
        pitch: categoryChanged ? target.pitch : animRef.current.pitch,
      };
      animRef.current = snapped;
      setAnim(snapped);
      return;
    }

    const start: AnimatedCameraState = { ...animRef.current };
    const startTime = performance.now();
    // Smooth, weighty studio camera & marble turntable glide
    const pitchChanged = Math.abs(target.pitch - start.pitch) > 1;
    const durationMs = pitchChanged ? 860 : 760;

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const e = easeOutCubic(t);

      const current: AnimatedCameraState = {
        wheelAngle: start.wheelAngle + (target.wheelAngle - start.wheelAngle) * e,
        pitch: start.pitch + (target.pitch - start.pitch) * e,
        cx: start.cx + (target.cx - start.cx) * e,
        cy: start.cy + (target.cy - start.cy) * e,
        scale: start.scale + (target.scale - start.scale) * e,
      };

      animRef.current = current;
      setAnim(current);

      if (t < 1) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [
    activeIndex,
    items.length,
    category.id,
    targetGeo.pitch,
    targetGeo.cx,
    targetGeo.cy,
    targetGeo.scale,
  ]);

  // Wheel scroll & touch-swipe drag handling on the circular stage
  const wheelLockRef = useRef<number>(0);
  const dragStartRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  const handleStageWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (overviewMode || category.comingSoon || items.length <= 1) return;
    const now = Date.now();
    if (now - wheelLockRef.current < 320) return;
    const primary =
      Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(primary) < 18) return;
    wheelLockRef.current = now;
    onStep(primary > 0 ? 1 : -1);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (overviewMode || category.comingSoon || items.length <= 1) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, active: true };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current.active) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current.active = false;
    const dist = Math.hypot(dx, dy);
    if (dist < 36) return;
    if (Math.abs(dx) >= Math.abs(dy)) {
      onStep(dx < 0 ? 1 : -1);
    } else {
      onStep(dy < 0 ? 1 : -1);
    }
  };

  const hoveredOverviewItem =
    overviewMode && hoveredOverviewIndex !== null
      ? items[hoveredOverviewIndex]
      : null;

  const activeItem = items[activeIndex];
  const displayCenterItem = hoveredOverviewItem ?? activeItem;
  const comingSoonSlots = [0, 1, 2, 3];

  // Continuous camera-pitch progress [0 = pure top-down, 1 = full eye-level front]
  const pitchRatio = Math.max(0, Math.min(1, anim.pitch / 71));
  const plateOpacityFactor = Math.max(0, 1 - pitchRatio * 2.2);
  const standingReveal = Math.max(0, Math.min(1, (pitchRatio - 0.16) / 0.84));
  const ringRadiusPx = (targetGeo.tableDiameter * targetGeo.ringRadiusPct) / 100;

  return (
    <div
      onWheel={handleStageWheel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      aria-label="میز دوّار نمایش محصولات کافه ایوان"
      className="pointer-events-auto absolute inset-0 overflow-hidden select-none touch-pan-y"
    >
      {/* Subtle studio lighting radial glow behind the focal drink when camera descends */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            pitchRatio > 0.05
              ? isMobile
                ? `radial-gradient(ellipse 76% 42% at 50% 30%, rgba(212, 180, 124, ${(0.22 * pitchRatio).toFixed(3)}) 0%, rgba(14, 21, 37, 0) 70%)`
                : `radial-gradient(ellipse 46% 58% at ${drawerOpen ? 28 : 32}% 48%, rgba(212, 180, 124, ${(0.18 * pitchRatio).toFixed(3)}) 0%, rgba(14, 21, 37, 0) 68%)`
              : 'radial-gradient(circle at 32% 48%, rgba(212, 180, 124, 0.08) 0%, rgba(14, 21, 37, 0) 60%)',
        }}
      />

      {/* LAYER 1 (z-10): True 3D Tilted Rotating Alabaster-Marble Tabletop + Stone Slab Thickness + Coasters + Overhead Plates */}
      <div className="pointer-events-none absolute inset-0 z-10 isolate">
        <div
          className="pointer-events-auto absolute will-change-transform"
          style={{
            left: `${anim.cx}px`,
            top: `${anim.cy}px`,
            width: `${targetGeo.tableDiameter}px`,
            height: `${targetGeo.tableDiameter}px`,
            marginLeft: `${-targetGeo.tableDiameter / 2}px`,
            marginTop: `${-targetGeo.tableDiameter / 2}px`,
            transformStyle: 'preserve-3d',
            transform: `perspective(${PERSPECTIVE_PX}px) rotateX(${anim.pitch}deg) scale(${anim.scale})`,
          }}
        >
          {/* Solid 3D Bevelled Alabaster Marble Slab Edge Thickness (emerges naturally as camera lowers!) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              transform: 'translateZ(-18px)',
              background:
                'linear-gradient(180deg, #D5CEC1 0%, #BDB3A1 50%, #8F8574 100%)',
              boxShadow: '0 44px 100px rgba(3, 6, 15, 0.82)',
              opacity: Math.min(1, pitchRatio * 1.4),
            }}
          />

          {/* Outer Subtle Antique-Gold Trim Rim */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[3px] rounded-full"
            style={{
              border: '1px solid rgba(212, 180, 124, 0.34)',
              transform: 'translateZ(-4px)',
            }}
          />

          {/* Physically Rotating Circular Alabaster-Marble Disc */}
          <div
            className="eyvan-rotary-table relative h-full w-full rounded-full will-change-transform"
            style={{
              transform: `rotateZ(${anim.wheelAngle}deg)`,
            }}
          >
            {/* Asymmetric natural stone veining + brass radial compass inlays so the physical table rotation is unmistakably visible */}
            <MarbleTableInlays
              slotCount={category.comingSoon ? 4 : items.length}
            />

            {/* Coasters & Overhead Saucers physically seated ON the rotating marble disc */}
            {category.comingSoon
              ? comingSoonSlots.map((slotIdx) => {
                  const pos = getWheelSlotPosition(
                    slotIdx,
                    comingSoonSlots.length,
                    targetGeo.ringRadiusPct,
                  );
                  return (
                    <div
                      key={slotIdx}
                      className="absolute flex items-center justify-center"
                      style={{
                        left: `${pos.xPct}%`,
                        top: `${pos.yPct}%`,
                        width: `${targetGeo.dishSize * 1.12}px`,
                        height: `${targetGeo.dishSize * 1.12}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <ComingSoonClochePlate label={category.name} />
                    </div>
                  );
                })
              : items.map((item, idx) => {
                  const pos = getWheelSlotPosition(
                    idx,
                    items.length,
                    targetGeo.ringRadiusPct,
                  );
                  const isActive = idx === activeIndex;
                  const isHovered = overviewMode && hoveredOverviewIndex === idx;
                  const plateScale = overviewMode
                    ? isHovered
                      ? 1.16
                      : 0.98
                    : isActive
                      ? isMobile
                        ? 1.16
                        : 1.34
                      : 0.92;
                  const isBroken = Boolean(brokenImages[item.id]);

                  return (
                    <div
                      key={item.id}
                      className="absolute"
                      style={{
                        left: `${pos.xPct}%`,
                        top: `${pos.yPct}%`,
                        width: `${targetGeo.dishSize}px`,
                        height: `${targetGeo.dishSize}px`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: isActive || isHovered ? 20 : 10,
                      }}
                    >
                      {/* Recessed Brass-Rimmed Marble Coaster physically inlaid into the rotating tabletop */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-1/2 rounded-full"
                        style={{
                          width: item.vesselType === 'tall' ? '44%' : '58%',
                          height: item.vesselType === 'tall' ? '44%' : '58%',
                          transform: 'translate(-50%, -50%)',
                          background:
                            'radial-gradient(circle at 42% 38%, rgba(250, 248, 243, 0.95) 0%, rgba(226, 219, 206, 0.85) 75%, rgba(202, 192, 174, 0.78) 100%)',
                          border: isActive
                            ? '1.6px solid rgba(175, 137, 75, 0.62)'
                            : '1.2px solid rgba(175, 137, 75, 0.34)',
                          boxShadow:
                            'inset 0 2px 6px rgba(14, 21, 37, 0.14), 0 1px 2px rgba(255, 255, 255, 0.7)',
                          opacity: Math.min(1, standingReveal * 1.25),
                        }}
                      />

                      {/* Overhead 90° Studio Plate (smoothly cross-fades out as camera glides down to eye-level) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (overviewMode) {
                            onExitOverviewToIndex(idx);
                          } else if (isActive) {
                            onChangeCameraAngle('front');
                          } else {
                            onSelectIndex(idx);
                          }
                        }}
                        onMouseEnter={() => {
                          if (overviewMode) setHoveredOverviewIndex(idx);
                        }}
                        onMouseLeave={() => {
                          if (overviewMode) setHoveredOverviewIndex(null);
                        }}
                        tabIndex={isFrontCamera ? -1 : 0}
                        aria-hidden={isFrontCamera}
                        aria-label={
                          isActive
                            ? `${item.name} — پایین آمدن دوربین به نمای روبه‌رو`
                            : `${item.name} — انتخاب روی میز`
                        }
                        aria-pressed={isActive}
                        className={`group absolute inset-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#293B5F] ${
                          isFrontCamera || plateOpacityFactor <= 0.02
                            ? 'pointer-events-none'
                            : 'cursor-pointer'
                        }`}
                        style={{
                          transform: `scale(${plateScale})`,
                          transition:
                            'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
                          opacity:
                            plateOpacityFactor *
                            (overviewMode ? 1 : isActive ? 1 : 0.88),
                        }}
                      >
                        {overviewMode && (isActive || isHovered) && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-[14%] rounded-full border-2 border-[#AF894B]/70"
                          />
                        )}

                        {!isBroken ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            draggable={false}
                            onError={() =>
                              setBrokenImages((prev) => ({
                                ...prev,
                                [item.id]: true,
                              }))
                            }
                            className="eyvan-plate-img h-full w-full rounded-full object-cover pointer-events-none"
                            style={{
                              transform: `rotate(${item.plateAngle ?? 0}deg)`,
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-full border border-[#AF894B]/40 bg-[#152238] p-4 text-center text-xs font-medium text-[#F4F1EA]">
                            {item.name}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
          </div>

          {/* Non-Rotating Center Medallion (Full-Table Overview Mode only) */}
          <div
            className={`pointer-events-none absolute top-1/2 left-1/2 flex h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-[#AF894B]/28 bg-[#F2EFE9]/92 px-6 text-center transition-opacity duration-500 ${
              overviewMode ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transform: 'translate(-50%, -50%) translateZ(3px)' }}
          >
            <EyvanLogo variant="mark" tone="navy" className="scale-90" />
            {category.comingSoon ? (
              <>
                <p className="mt-2 text-lg font-semibold text-[#152238]">
                  {category.name}
                </p>
                <p className="mt-1 text-xs font-medium text-[#6B7043]">
                  به‌زودی در ایوان
                </p>
              </>
            ) : displayCenterItem ? (
              <>
                <p className="mt-2 text-xs text-[#6B7043]">
                  {category.shortName}
                </p>
                <p className="mt-0.5 text-lg font-semibold text-[#152238] leading-snug">
                  {displayCenterItem.name}
                </p>
                <p className="tabular-fa mt-1 text-sm font-medium text-[#AF894B]">
                  {formatToman(
                    calculateItemPrice(
                      displayCenterItem,
                      getDefaultBean(displayCenterItem),
                      null,
                    ),
                  )}
                </p>
                <p className="mt-2 text-[11px] text-[#556070]">
                  روی هر نوشیدنی کلیک کنید
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-[#556070]">
                {toPersianDigits(items.length)} آیتم روی میز
              </p>
            )}
          </div>
        </div>
      </div>

      {/* LAYER 2 (z-20): Mathematically Projected Background-Free Standing Drinks
          Every glass/cup base is locked to 0.0px precision onto its rotating marble coaster
          with grounded contact shadow + continuous optical depth-of-field bokeh! */}
      {!category.comingSoon && standingReveal > 0.01 && (
        <div className="pointer-events-none absolute inset-0 z-20 isolate">
          {items.map((item, idx) => {
            const slotAngleDeg = (idx / Math.max(1, items.length)) * 360;
            const proj = projectTableSeat({
              perspectivePx: PERSPECTIVE_PX,
              tableCenterX: anim.cx,
              tableCenterY: anim.cy,
              ringRadiusPx,
              tableScale: anim.scale,
              pitchDeg: anim.pitch,
              wheelAngleDeg: anim.wheelAngle,
              slotAngleDeg,
            });

            const isActive = idx === activeIndex;
            const baseHeight =
              item.vesselType === 'tall'
                ? targetGeo.tallCutoutH
                : targetGeo.cupCutoutH;
            // True 3D perspective foreshortening: closer front drink is naturally larger, rear drinks shrink smoothly
            const drinkHeight = baseHeight * proj.perspScale;
            // Subtle optical centering for handled ceramic cups so the cup body sits dead-center on its coaster
            const handleCenterShiftPct = item.vesselType === 'cup' ? -46 : -50;
            // Tight physical contact shadow footprint matched to tall glass vs ceramic cup base
            const contactWidthPx =
              (item.vesselType === 'tall' ? baseHeight * 0.34 : baseHeight * 0.72) *
              proj.perspScale;
            const contactHeightPx = Math.max(10, contactWidthPx * 0.24);

            // Fade only far-back items very subtly; keep front & adjacent drinks 100% solid opaque so marble never ghosts through!
            const seatOpacity =
              standingReveal *
              (proj.frontness >= 0.25
                ? 1
                : Math.max(0.55, 0.55 + (proj.frontness + 1) * 0.36));

            return (
              <div
                key={`projected-${item.id}`}
                className="pointer-events-none absolute top-0 left-0 will-change-transform"
                style={{
                  transform: `translate3d(${proj.screenX.toFixed(2)}px, ${proj.screenY.toFixed(2)}px, 0)`,
                  zIndex: proj.zIndex,
                  opacity: seatOpacity,
                }}
              >
                {/* Grounded Ambient-Occlusion Contact Shadow right where glass/ceramic base meets marble */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-0 left-0 rounded-full"
                  style={{
                    width: `${contactWidthPx.toFixed(1)}px`,
                    height: `${contactHeightPx.toFixed(1)}px`,
                    transform: 'translate(-50%, -45%)',
                    background:
                      'radial-gradient(ellipse at center, rgba(10, 15, 28, 0.58) 0%, rgba(10, 15, 28, 0.28) 52%, rgba(10, 15, 28, 0) 78%)',
                    filter:
                      proj.blurPx > 0
                        ? `blur(${(proj.blurPx * 0.65 + 1.5).toFixed(1)}px)`
                        : 'blur(1.5px)',
                  }}
                />

                {/* Standing Background-Free Cutout Glass / Ceramic Cup anchored firmly ON the coaster */}
                <button
                  type="button"
                  onClick={() => {
                    if (!isFrontCamera) return;
                    if (isActive) {
                      onChangeCameraAngle('top');
                    } else {
                      // Clicking any blurred neighbor glass revolves the marble table to bring it to front focus!
                      onSelectIndex(idx);
                    }
                  }}
                  tabIndex={isFrontCamera ? 0 : -1}
                  aria-hidden={!isFrontCamera}
                  aria-label={
                    isActive
                      ? `${item.name} — بازگشت به نمای بالا`
                      : `${item.name} — چرخاندن میز و نمایش از روبه‌رو`
                  }
                  className="pointer-events-auto absolute bottom-0 left-0 cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-none"
                  style={{
                    height: `${drinkHeight.toFixed(1)}px`,
                    width: 'auto',
                    transformOrigin: '50% 100%',
                    transform: `translate(${handleCenterShiftPct}%, ${
                      item.vesselType === 'cup' ? '4px' : '2px'
                    }) scaleY(${(0.55 + standingReveal * 0.45).toFixed(3)})`,
                  }}
                >
                  <img
                    src={item.cutoutImage}
                    alt={`نمای روبه‌رو ${item.name}`}
                    referrerPolicy="no-referrer"
                    draggable={false}
                    className="block h-full w-auto max-w-none select-none object-contain pointer-events-none"
                    style={{
                      filter:
                        proj.blurPx > 0
                          ? `blur(${proj.blurPx}px) brightness(${proj.brightness}) saturate(${proj.saturate}) drop-shadow(0 8px 12px rgba(8,12,24,0.28))`
                          : `brightness(${proj.brightness}) saturate(${proj.saturate}) drop-shadow(0 10px 16px rgba(8,12,24,0.32))`,
                    }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Subtle Rising Steam Overlay positioned over the focal hot beverage (Top-Down Hero Mode only) */}
      {!overviewMode &&
        !isFrontCamera &&
        !category.comingSoon &&
        activeItem?.isHot &&
        !isMobile && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-30 flex gap-3 opacity-75"
            style={{
              left: drawerOpen ? '27.5%' : '32%',
              top: '51%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {[0, 1, 2].map((w) => (
              <span
                key={w}
                className="eyvan-steam-line block h-12 w-1 rounded-full bg-gradient-to-t from-transparent via-[#F4F1EA]/40 to-transparent blur-[1px]"
                style={{ animationDelay: `${w * 0.9}s` }}
              />
            ))}
          </div>
        )}
    </div>
  );
};
