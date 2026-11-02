import React from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Audio, interpolate, Sequence, staticFile } from "remotion";
import audio from "./audio.gen.json";
import { Driver, Funding, Hook, Impact, Money, Outro, PayPal, Problem, Restaurant, Reveal, Shelter, Start } from "./scenes";
import { FRAMES, ORDER, type SceneId } from "./timing";

const XFADE = 15;

const COMPONENT: Record<SceneId, React.FC> = {
  hook: Hook,
  problem: Problem,
  reveal: Reveal,
  start: Start,
  restaurant: Restaurant,
  funding: Funding,
  driver: Driver,
  shelter: Shelter,
  money: Money,
  paypal: PayPal,
  impact: Impact,
  outro: Outro,
};

// Problem → product → one rescue, start to finish → where the money comes from → impact → close.
export const SCENES = ORDER.map((id) => ({ id, frames: FRAMES[id], C: COMPONENT[id] }));

export const TOTAL = SCENES.reduce((n, s) => n + s.frames, 0) - XFADE * (SCENES.length - 1);

// Frame each scene starts at, once the crossfades overlap; voiceover line N starts with scene N.
const STARTS = SCENES.map((_, i) => SCENES.slice(0, i).reduce((n, s) => n + s.frames - XFADE, 0));
const VO_DELAY = 8;

const Soundtrack: React.FC = () => {
  const lines = Object.entries(audio.vo as Record<string, string>);
  // Music sits low under the voice, louder if there is no voiceover; it fades in and out.
  const level = lines.length ? 0.09 : 0.5;
  return (
    <>
      {audio.music ? (
        <Audio
          src={staticFile(audio.music)}
          loop
          volume={(f) => level * interpolate(f, [0, 30, TOTAL - 60, TOTAL], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      ) : null}
      {lines.map(([n, file]) => (
        <Sequence key={file} from={STARTS[Number(n) - 1] + VO_DELAY} layout="none">
          <Audio src={staticFile(file)} volume={1.25} />
        </Sequence>
      ))}
    </>
  );
};

export const MealBridgeVideo: React.FC = () => (
  <>
    <Soundtrack />
    <TransitionSeries>
      {SCENES.flatMap((s, i) => [
        ...(i ? [<TransitionSeries.Transition key={`t-${s.id}`} presentation={fade()} timing={linearTiming({ durationInFrames: XFADE })} />] : []),
        <TransitionSeries.Sequence key={s.id} durationInFrames={s.frames}>
          <s.C />
        </TransitionSeries.Sequence>,
      ])}
    </TransitionSeries>
  </>
);
