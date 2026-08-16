"use client";

import { useEffect, useRef } from "react";

interface BubbleCursorProps {
  wrapperElement?: HTMLElement;
  zIndex?: number;
  fill?: string;
  stroke?: string;
  environmentPointer?: boolean;
}

class Bubble {
  age = 0;
  readonly duration = 650 + Math.random() * 130;
  readonly radius = 4 + Math.random() * 4;
  readonly drift = (Math.random() - 0.5) * 6;

  constructor(
    readonly x: number,
    readonly y: number,
    readonly fill: string,
    readonly stroke: string,
  ) {}

  draw(context: CanvasRenderingContext2D, delta: number) {
    this.age += delta;
    const progress = Math.min(1, this.age / this.duration);
    const ease = 1 - Math.pow(1 - progress, 3);
    const x = this.x + this.drift * ease;
    const y = this.y - 18 * ease;
    const radius = this.radius * (0.72 + ease * 0.52);

    context.save();
    context.globalAlpha = Math.sin(progress * Math.PI) * 0.7;
    context.strokeStyle = this.stroke;
    context.fillStyle = this.fill;
    context.lineWidth = 0.8;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
    return progress < 1;
  }
}

class WaterRipple {
  age = 0;
  readonly duration = 680;

  constructor(
    readonly x: number,
    readonly y: number,
    readonly stroke: string,
  ) {}

  draw(context: CanvasRenderingContext2D, delta: number) {
    this.age += delta;
    const progress = Math.min(1, this.age / this.duration);
    const ease = 1 - Math.pow(1 - progress, 3);
    const radiusX = 13 + ease * 46;
    const radiusY = 8 + ease * 25;

    context.save();
    context.globalCompositeOperation = "screen";
    context.globalAlpha = Math.sin(progress * Math.PI) * 0.34;
    context.strokeStyle = this.stroke;
    context.lineWidth = 0.85;
    context.shadowColor = "rgba(255, 244, 237, 0.4)";
    context.shadowBlur = 10;
    context.beginPath();
    context.ellipse(this.x, this.y, radiusX, radiusY, -0.04, 0, Math.PI * 2);
    context.stroke();

    // One incomplete highlight prevents the effect reading as a touch ring.
    context.globalAlpha = Math.sin(progress * Math.PI) * 0.28;
    context.strokeStyle = "rgba(255, 252, 248, 0.72)";
    context.lineWidth = 0.9;
    context.shadowBlur = 5;
    context.beginPath();
    context.ellipse(
      this.x - radiusX * 0.08,
      this.y - radiusY * 0.08,
      radiusX * 0.78,
      radiusY * 0.72,
      -0.04,
      Math.PI * 1.08,
      Math.PI * 1.56,
    );
    context.stroke();
    context.restore();
    return progress < 1;
  }
}

function drawGlassBubble(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  fill: string,
  stroke: string,
) {
  context.save();
  const glow = context.createRadialGradient(x - 5, y - 6, 1, x, y, 18);
  glow.addColorStop(0, "rgba(255, 255, 255, 0.92)");
  glow.addColorStop(0.22, "rgba(255, 255, 255, 0.2)");
  glow.addColorStop(0.72, fill);
  glow.addColorStop(1, "rgba(246, 220, 211, 0.025)");
  context.fillStyle = glow;
  context.strokeStyle = stroke;
  context.lineWidth = 1;
  context.shadowColor = "rgba(238, 197, 185, 0.22)";
  context.shadowBlur = 10;
  context.beginPath();
  context.arc(x, y, 15, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

const BubbleCursor = ({
  wrapperElement,
  zIndex,
  fill = "rgba(255, 248, 242, 0.12)",
  stroke = "rgba(237, 203, 190, 0.42)",
  environmentPointer = false,
}: BubbleCursorProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (reducedMotion.matches) return;

    const element = wrapperElement || document.body;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 0;
    let height = 0;
    let ratio = 1;
    let frame = 0;
    let lastFrame = performance.now();
    let lastBubbleTime = 0;
    let lastBubbleX = 0;
    let lastBubbleY = 0;
    let lastAmbientRipple = 0;
    let lastAmbientX = 0;
    let lastAmbientY = 0;
    let pointerVisible = false;
    let dirty = false;
    const pointer = { x: 0, y: 0 };
    const worldTarget = { x: 0, y: 0 };
    const worldCurrent = { x: 0, y: 0 };
    const bubbles: Bubble[] = [];
    const ripples: WaterRipple[] = [];

    const resize = () => {
      const rect = wrapperElement?.getBoundingClientRect();
      width = rect?.width || window.innerWidth;
      height = rect?.height || window.innerHeight;
      ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      dirty = true;
      ensureLoop();
    };

    const render = (time: number) => {
      frame = 0;
      if (document.hidden) return;
      const delta = Math.max(1, Math.min(40, time - lastFrame));
      lastFrame = time;
      context.clearRect(0, 0, width, height);

      for (let index = bubbles.length - 1; index >= 0; index--) {
        if (!bubbles[index].draw(context, delta)) bubbles.splice(index, 1);
      }
      for (let index = ripples.length - 1; index >= 0; index--) {
        if (!ripples[index].draw(context, delta)) ripples.splice(index, 1);
      }
      if (finePointer && pointerVisible)
        drawGlassBubble(context, pointer.x, pointer.y, fill, stroke);

      if (environmentPointer) {
        worldCurrent.x += (worldTarget.x - worldCurrent.x) * 0.12;
        worldCurrent.y += (worldTarget.y - worldCurrent.y) * 0.12;
        document.documentElement.style.setProperty(
          "--pointer-x",
          worldCurrent.x.toFixed(4),
        );
        document.documentElement.style.setProperty(
          "--pointer-y",
          worldCurrent.y.toFixed(4),
        );
      }

      dirty = false;
      if (
        bubbles.length ||
        ripples.length ||
        (environmentPointer &&
          (Math.abs(worldTarget.x - worldCurrent.x) > 0.002 ||
            Math.abs(worldTarget.y - worldCurrent.y) > 0.002))
      )
        frame = requestAnimationFrame(render);
    };

    function ensureLoop() {
      if (!frame) {
        lastFrame = performance.now();
        frame = requestAnimationFrame(render);
      }
    }

    const localPoint = (event: PointerEvent) => {
      if (!wrapperElement) return { x: event.clientX, y: event.clientY };
      const box = wrapperElement.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!finePointer || event.pointerType === "touch") return;
      const point = localPoint(event);
      pointer.x = point.x;
      pointer.y = point.y;
      pointerVisible = true;
      if (environmentPointer) {
        worldTarget.x = Math.max(
          -1,
          Math.min(1, (event.clientX / window.innerWidth - 0.5) * 2),
        );
        worldTarget.y = Math.max(
          -1,
          Math.min(1, (event.clientY / window.innerHeight - 0.5) * 2),
        );
      }
      const distance = Math.hypot(point.x - lastBubbleX, point.y - lastBubbleY);
      if (distance > 18 && performance.now() - lastBubbleTime > 72) {
        bubbles.push(new Bubble(point.x, point.y, fill, stroke));
        if (bubbles.length > 26) bubbles.shift();
        lastBubbleX = point.x;
        lastBubbleY = point.y;
        lastBubbleTime = performance.now();
      }
      const atmosphericZone = (event.target as Element | null)?.closest(
        "[data-ripple-zone]",
      );
      const ambientDistance = Math.hypot(
        point.x - lastAmbientX,
        point.y - lastAmbientY,
      );
      if (
        atmosphericZone &&
        ambientDistance > 120 &&
        performance.now() - lastAmbientRipple > 720
      ) {
        ripples.push(new WaterRipple(point.x, point.y, stroke));
        lastAmbientX = point.x;
        lastAmbientY = point.y;
        lastAmbientRipple = performance.now();
      }
      dirty = true;
      ensureLoop();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (
        !target?.closest(
          "[data-ripple], [data-ripple-zone], .choice-card, .segmented-control button, .editorial-guide__heading",
        )
      )
        return;
      const point = localPoint(event);
      ripples.push(new WaterRipple(point.x, point.y, stroke));
      if (ripples.length > 4) ripples.shift();
      ensureLoop();
    };

    const onPointerLeave = () => {
      pointerVisible = false;
      worldTarget.x = 0;
      worldTarget.y = 0;
      dirty = true;
      ensureLoop();
    };

    const onVisibility = () => {
      if (document.hidden && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (
        !document.hidden &&
        (dirty || bubbles.length || ripples.length)
      ) {
        ensureLoop();
      }
    };

    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = zIndex ? String(zIndex) : "";
    canvas.style.position = wrapperElement ? "absolute" : "fixed";
    canvas.style.inset = "0";
    if (finePointer) document.documentElement.classList.add("heart-cursor");
    resize();

    element.addEventListener("pointermove", onPointerMove, { passive: true });
    element.addEventListener("pointerdown", onPointerDown, { passive: true });
    element.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.documentElement.classList.remove("heart-cursor");
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [wrapperElement, zIndex, fill, stroke, environmentPointer]);

  return (
    <canvas
      ref={canvasRef}
      className="bubble-cursor-canvas"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: 0,
        height: 0,
        pointerEvents: "none",
      }}
    />
  );
};

export default BubbleCursor;
