// Wires scroll to the story: Lenis smooth scrolling (full mode only), ScrollTrigger progress for the camera,
// seasons and soil peel, SVG line drawing and the map parallax. Nothing runs under reduced motion.
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { MotionMode } from '../lib/motion-mode';
import type { StageView } from './Stage';
import { story } from './story';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function useScrollStory(root: RefObject<HTMLElement>, mode: MotionMode) {
  const [view, setView] = useState<StageView>('farm');
  const [panel, setPanel] = useState(0);
  const panelRef = useRef(0);

  useEffect(() => {
    if (mode === 'reduced' || !root.current) return;
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);

      let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
      const tick = (t: number) => lenis?.raf(t * 1000);
      if (mode === 'full') {
        const { default: Lenis } = await import('lenis');
        if (disposed) return;
        const l = new Lenis({ lerp: 0.1, smoothWheel: true });
        l.on('scroll', ScrollTrigger.update);
        lenis = l;
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
      }

      const ctx = gsap.context(() => {
        const showStage = (v: StageView) => {
          story.scene = v === 'soil' ? 'soil' : 'farm';
          setView(v);
        };

        ScrollTrigger.create({
          trigger: '#hero',
          start: 'top top',
          end: 'bottom top',
          onUpdate: (s) => (story.fly = s.progress * 0.12),
          onEnterBack: () => showStage('farm'),
        });

        // Seasons: three panels. The season holds steady through most of each panel, then blends to the next.
        ScrollTrigger.create({
          trigger: '#seasons',
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (s) => {
            story.fly = 0.12 + s.progress * 0.88;
            const seg = Math.min(2.999, s.progress * 3);
            const i = Math.floor(seg);
            story.season = Math.min(2, i + smoothstep(0.72, 1, seg - i));
            if (i !== panelRef.current) {
              panelRef.current = i;
              setPanel(i);
            }
          },
          onEnter: () => showStage('farm'),
          onEnterBack: () => showStage('farm'),
          onLeave: () => showStage('none'),
        });

        ScrollTrigger.create({
          trigger: '#soil',
          start: 'top 60%',
          end: 'bottom bottom',
          onEnter: () => showStage('soil'),
          onEnterBack: () => showStage('soil'),
          onLeave: () => showStage('none'),
          onLeaveBack: () => showStage('none'),
        });
        ScrollTrigger.create({
          trigger: '#soil',
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (s) => (story.peel = s.progress),
        });

        // SVG paths draw themselves as they scroll through view.
        gsap.utils.toArray<SVGPathElement>('[data-draw]').forEach((path) => {
          const len = path.getTotalLength();
          gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
          gsap.to(path, {
            strokeDashoffset: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: path.closest('section'),
              start: 'top 70%',
              end: 'center 45%',
              scrub: true,
            },
          });
        });

        // The produce truck follows the road to the mandi.
        const road = root.current?.querySelector<SVGPathElement>('#mandi-road');
        const truck = root.current?.querySelector<SVGGElement>('#mandi-truck');
        if (road && truck) {
          const len = road.getTotalLength();
          ScrollTrigger.create({
            trigger: '#mandi',
            start: 'top 70%',
            end: 'center 45%',
            scrub: true,
            onUpdate: (s) => {
              const p = road.getPointAtLength(len * s.progress);
              truck.setAttribute('transform', `translate(${p.x} ${p.y})`);
            },
          });
        }

        if (mode === 'full') {
          gsap.to('#map-art', {
            y: -70,
            ease: 'none',
            scrollTrigger: { trigger: '#map', start: 'top bottom', end: 'bottom top', scrub: true },
          });
          gsap.to('#map-title', {
            y: 40,
            ease: 'none',
            scrollTrigger: { trigger: '#map', start: 'top bottom', end: 'bottom top', scrub: true },
          });
        }
      }, root);

      cleanup = () => {
        ctx.revert();
        gsap.ticker.remove(tick);
        lenis?.destroy();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [mode, root]);

  return { view, panel };
}
