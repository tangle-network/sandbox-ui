import React, { useLayoutEffect, useState } from "react";

export function MotionConsumer() {
  const [generation, setGeneration] = useState(0);
  const sample = { opacity: generation % 2 ? 0.35 : 1, transition: "opacity 200ms linear" };
  useLayoutEffect(() => {
    if (!generation) return;
    const before = getComputedStyle(document.body).scrollbarColor;
    document.documentElement.className = document.documentElement.classList.contains("dark") ? "light" : "dark";
    const body = getComputedStyle(document.body);
    const transitions = document.getAnimations().filter(animation => animation instanceof CSSTransition).map(animation => {
      const target = (animation.effect as KeyframeEffect | null)?.target as Element;
      return { target: target.tagName, sample: target.getAttribute("data-motion-sample"), essential: !!target.closest('[data-motion="essential"]'), property: animation.transitionProperty, duration: animation.effect?.getTiming().duration, currentTime: animation.currentTime, playState: animation.playState };
    });
    document.documentElement.dataset.motionObservation = JSON.stringify({ generation, reduced: matchMedia("(prefers-reduced-motion: reduce)").matches, before, after: body.scrollbarColor, transitions });
  }, [generation]);
  return <section aria-label="Motion policy consumer">
    <button onClick={() => setGeneration(value => value + 1)}>Change consumer theme</button>
    <span data-motion-sample="ordinary" style={sample}>Ordinary transition</span>
    <span data-motion="essential" data-motion-sample="essential" style={sample}>Essential transition</span>
    <div data-motion="essential"><span data-motion-sample="descendant" style={sample}>Essential descendant</span></div>
  </section>;
}
