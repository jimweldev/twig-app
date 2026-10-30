// CSS-drawn art for the Round 'Em Up picker: farm animals, the cowboy and the
// farm backdrop. Every part is a styled element (no images or emoji); styles
// live in games.css under .ca, .cb and .farm.

import type { CSSProperties } from "react";

export type AnimalKind = "cow" | "pig" | "sheep" | "chicken" | "horse" | "duck";

export const ANIMAL_KINDS: AnimalKind[] = ["cow", "pig", "sheep", "chicken", "horse", "duck"];

const HAS_EARS_AND_SNOUT: Record<AnimalKind, boolean> = {
  cow: true,
  pig: true,
  sheep: true,
  horse: true,
  chicken: false,
  duck: false,
};

/** A small farm animal that idly bobs, twitches its ears, wags its tail and blinks. */
export function CssAnimal({
  kind,
  size = 40,
  delay = 0,
  className,
  style,
}: {
  kind: AnimalKind;
  size?: number;
  /** Seconds of negative animation-delay so a herd doesn't move in lockstep. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const offset = { animationDelay: `${-delay}s` };
  const earsAndSnout = HAS_EARS_AND_SNOUT[kind];
  return (
    <div className={`ca ca--${kind} ${className ?? ""}`} style={{ fontSize: size, ...offset, ...style }} aria-hidden>
      {earsAndSnout && (
        <>
          <span className="ca__ear ca__ear--l" style={offset} />
          <span className="ca__ear ca__ear--r" style={offset} />
        </>
      )}
      <span className="ca__tail" style={offset} />
      {kind === "cow" && (
        <>
          <span className="ca__horn ca__horn--l" />
          <span className="ca__horn ca__horn--r" />
        </>
      )}
      {kind === "chicken" && <span className="ca__comb" />}
      {kind === "horse" && <span className="ca__mane" />}
      <span className="ca__body" />
      {kind === "cow" && (
        <>
          <span className="ca__spot ca__spot--1" />
          <span className="ca__spot ca__spot--2" />
        </>
      )}
      <span className="ca__eye ca__eye--l" />
      <span className="ca__eye ca__eye--r" />
      {earsAndSnout && <span className="ca__snout" />}
      {(kind === "chicken" || kind === "duck") && <span className="ca__beak" />}
    </div>
  );
}

/** The cowboy: idles with a gentle breathe; when throwing, leans in and swings the lasso arm. */
export function CssCowboy({
  throwing = false,
  size = 64,
  className,
  style,
}: {
  throwing?: boolean;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`cb ${throwing ? "cb--throw" : ""} ${className ?? ""}`} style={{ fontSize: size, ...style }} aria-hidden>
      <span className="cb__boot cb__boot--l" />
      <span className="cb__boot cb__boot--r" />
      <span className="cb__leg cb__leg--l" />
      <span className="cb__leg cb__leg--r" />
      <span className="cb__torso" />
      <span className="cb__vest cb__vest--l" />
      <span className="cb__vest cb__vest--r" />
      <span className="cb__belt" />
      <span className="cb__buckle" />
      <span className="cb__arm cb__arm--down" />
      <span className="cb__arm cb__arm--up">
        <span className="cb__hand" />
      </span>
      <span className="cb__head" />
      <span className="cb__scarf" />
      <span className="cb__eye cb__eye--l" />
      <span className="cb__eye cb__eye--r" />
      <span className="cb__stache" />
      <span className="cb__hat-brim" />
      <span className="cb__hat-crown" />
      <span className="cb__hat-band" />
    </div>
  );
}

/**
 * Sky, sun, clouds, mountains, hills, swaying trees, a silo, the red barn and
 * the back fence. The front fence is drawn by the game so it sits in front of the herd.
 */
export function FarmScenery() {
  const tree = (n: 1 | 2) => (
    <div className={`farm__tree farm__tree--${n}`}>
      <div className="farm__tree-foliage">
        <span className="farm__tree-leaf farm__tree-leaf--back" />
        <span className="farm__tree-leaf farm__tree-leaf--mid" />
        <span className="farm__tree-leaf farm__tree-leaf--front" />
      </div>
      <span className="farm__tree-trunk" />
    </div>
  );
  return (
    <div className="farm pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
      <div className="farm__sun" />
      <div className="farm__cloud farm__cloud--1" />
      <div className="farm__cloud farm__cloud--2" />
      <div className="farm__cloud farm__cloud--3" />

      <div className="farm__mountain farm__mountain--3" />
      <div className="farm__mountain farm__mountain--2" />
      <div className="farm__mountain farm__mountain--1" />

      <div className="farm__hill-back" />

      <div className="farm__fence-back">
        <span className="farm__fence-back__rail farm__fence-back__rail--1" />
        <span className="farm__fence-back__rail farm__fence-back__rail--2" />
        <div className="farm__fence-back__posts">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="farm__fence-back__post" />
          ))}
        </div>
      </div>

      <div className="farm__silo">
        <span className="farm__silo-roof" />
      </div>
      <div className="farm__barn">
        <span className="farm__barn-roof-top" />
        <span className="farm__barn-roof-side" />
        <span className="farm__barn-body">
          <span className="farm__barn-loft" />
          <span className="farm__barn-door" />
        </span>
      </div>

      {tree(1)}
      {tree(2)}

      <div className="farm__hill-front" />
    </div>
  );
}

/** Orange wooden rails in front of the herd. */
export function FrontFence() {
  return (
    <div className="farm__fence-front">
      <span className="farm__fence-front__rail farm__fence-front__rail--1" />
      <span className="farm__fence-front__rail farm__fence-front__rail--2" />
      <div className="farm__fence-front__posts">
        {Array.from({ length: 13 }).map((_, i) => (
          <span key={i} className="farm__fence-front__post" />
        ))}
      </div>
    </div>
  );
}
