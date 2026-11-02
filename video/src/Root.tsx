import React from "react";
import { Composition } from "remotion";
import { Thumbnail } from "./Thumbnail";
import { MealBridgeVideo, SCENES, TOTAL } from "./Video";
import { FPS, H, W } from "./theme";

export const Root: React.FC = () => (
  <>
    <Composition id="MealBridge" component={MealBridgeVideo} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
    <Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={FPS} width={1280} height={720} />
    {/* One composition per scene, for quick previews and stills. */}
    {SCENES.map((s) => (
      <Composition key={s.id} id={`scene-${s.id}`} component={s.C} durationInFrames={s.frames} fps={FPS} width={W} height={H} />
    ))}
  </>
);
