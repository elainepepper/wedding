"use client";

import React, { useEffect, useRef } from "react";

interface BubbleCursorProps {
  wrapperElement?: HTMLElement;
  zIndex?: number;
  /** Bubble fill and outline. Change these two to recolour the whole effect. */
  fill?: string;
  stroke?: string;
}

class Particle {
  lifeSpan: number;
  initialLifeSpan: number;
  velocity: { x: number; y: number };
  position: { x: number; y: number };
  baseDimension: number;
  fill: string;
  stroke: string;

  constructor(x: number, y: number, fill: string, stroke: string) {
    this.initialLifeSpan = Math.floor(Math.random() * 60 + 60);
    this.lifeSpan = this.initialLifeSpan;
    this.velocity = {
      x: (Math.random() < 0.5 ? -1 : 1) * (Math.random() / 10),
      y: -0.4 + Math.random() * -1,
    };
    this.position = { x, y };
    this.baseDimension = 4;
    this.fill = fill;
    this.stroke = stroke;
  }

  update(context: CanvasRenderingContext2D) {
    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    this.velocity.x += ((Math.random() < 0.5 ? -1 : 1) * 2) / 75;
    this.velocity.y -= Math.random() / 600;
    this.lifeSpan--;

    const scale = 0.2 + (this.initialLifeSpan - this.lifeSpan) / this.initialLifeSpan;
    // fade out as the bubble rises, so they dissolve instead of vanishing
    const life = Math.max(0, this.lifeSpan / this.initialLifeSpan);

    context.globalAlpha = Math.min(1, life * 1.4);
    context.fillStyle = this.fill;
    context.strokeStyle = this.stroke;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(
      this.position.x - (this.baseDimension / 2) * scale,
      this.position.y - this.baseDimension / 2,
      this.baseDimension * scale,
      0,
      2 * Math.PI
    );
    context.stroke();
    context.fill();
    context.closePath();
    context.globalAlpha = 1;
  }
}

const BubbleCursor: React.FC<BubbleCursorProps> = ({
  wrapperElement,
  zIndex,
  fill = "rgba(255, 248, 246, 0.72)",
  stroke = "rgba(201, 168, 160, 0.85)",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const cursorRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let canvas: HTMLCanvasElement | null = null;
    let context: CanvasRenderingContext2D | null = null;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const element = wrapperElement || document.body;

    const onWindowResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      if (!canvasRef.current) return;
      if (wrapperElement) {
        canvasRef.current.width = wrapperElement.clientWidth;
        canvasRef.current.height = wrapperElement.clientHeight;
      } else {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
    };

    const addParticle = (x: number, y: number) => {
      // a soft ceiling, so a long swirl of the finger cannot bog the page down
      if (particlesRef.current.length > 220) return;
      particlesRef.current.push(new Particle(x, y, fill, stroke));
    };

    const onTouchMove = (event: TouchEvent) => {
      for (let i = 0; i < event.touches.length; i++) {
        addParticle(event.touches[i].clientX, event.touches[i].clientY);
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      if (wrapperElement) {
        const box = wrapperElement.getBoundingClientRect();
        cursorRef.current.x = event.clientX - box.left;
        cursorRef.current.y = event.clientY - box.top;
      } else {
        cursorRef.current.x = event.clientX;
        cursorRef.current.y = event.clientY;
      }
      addParticle(cursorRef.current.x, cursorRef.current.y);
    };

    const updateParticles = () => {
      if (!canvas || !context) return;
      if (particlesRef.current.length === 0) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particlesRef.current.length; i++) {
        particlesRef.current[i].update(context);
      }
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        if (particlesRef.current[i].lifeSpan < 0) particlesRef.current.splice(i, 1);
      }
      if (particlesRef.current.length === 0) context.clearRect(0, 0, canvas.width, canvas.height);
    };

    const loop = () => {
      updateParticles();
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    const bindEvents = () => {
      element.addEventListener("mousemove", onMouseMove);
      element.addEventListener("touchmove", onTouchMove, { passive: true });
      element.addEventListener("touchstart", onTouchMove, { passive: true });
      window.addEventListener("resize", onWindowResize);
    };

    const init = () => {
      if (prefersReducedMotion.matches) return;
      canvas = canvasRef.current;
      if (!canvas) return;
      context = canvas.getContext("2d");
      if (!context) return;

      canvas.style.top = "0px";
      canvas.style.left = "0px";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = zIndex ? zIndex.toString() : "";

      if (wrapperElement) {
        canvas.style.position = "absolute";
        wrapperElement.appendChild(canvas);
        canvas.width = wrapperElement.clientWidth;
        canvas.height = wrapperElement.clientHeight;
      } else {
        canvas.style.position = "fixed";
        document.body.appendChild(canvas);
        canvas.width = width;
        canvas.height = height;
      }

      bindEvents();
      loop();
    };

    init();

    return () => {
      if (canvas) canvas.remove();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      element.removeEventListener("mousemove", onMouseMove);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchstart", onTouchMove);
      window.removeEventListener("resize", onWindowResize);
    };
  }, [wrapperElement, zIndex, fill, stroke]);

  return <canvas ref={canvasRef} aria-hidden="true" />;
};

export default BubbleCursor;
