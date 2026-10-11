import React from 'react';
import { Season, seasonOf } from './season';
import { Canvas, Circle, Oval, Rect } from '@shopify/react-native-skia';

/**
 * The sky an island floats in: a soft flat blue with the sun low on one
 * side and two clouds by day; deep blue with a moon and a scatter of stars
 * by night. Flat colour, like the rest of the art.
 */
export function VillaSky({ width, height, night = false, season = seasonOf(new Date()) }: { width: number; height: number; night?: boolean; season?: Season }): React.JSX.Element {
  return (
    <Canvas style={{ width, height }}>
      <SkyShapes width={width} height={height} night={night} season={season} />
    </Canvas>
  );
}

/** The sky's shapes alone, for drawing into another canvas (the villa's
 * keepsake picture is one image: sky and island together). */
export function SkyShapes({ width: W, height: H, night = false, season = 'summer' }: { width: number; height: number; night?: boolean; season?: Season }): React.JSX.Element {
  return (
    <>
      <Rect x={0} y={0} width={W} height={H} color={night ? '#1F2340' : '#CFE5EC'} />
      {/* A paler band near the horizon, by geometry: a second, lighter field. */}
      <Rect x={0} y={H * 0.62} width={W} height={H * 0.38} color={night ? '#262B4C' : '#DCEDF1'} />
      {night ? (
        <>
          <Circle cx={W * 0.8} cy={H * 0.16} r={W * 0.06} color="#F4EBCF" />
          <Circle cx={W * 0.825} cy={H * 0.145} r={W * 0.052} color="#1F2340" />
          {[
            [0.12, 0.1],
            [0.24, 0.2],
            [0.38, 0.08],
            [0.55, 0.16],
            [0.66, 0.05],
            [0.9, 0.32],
            [0.08, 0.36],
          ].map(([x, y], i) => (
            <Circle key={i} cx={W * x} cy={H * y} r={i % 3 === 0 ? 1.6 : 1.1} color="#E9E3F5" />
          ))}
        </>
      ) : (
        <>
          <Circle cx={W * 0.82} cy={H * 0.17} r={W * 0.075} color="#FBE7B5" />
          <Circle cx={W * 0.82} cy={H * 0.17} r={W * 0.055} color="#F8D88A" />
          <Oval x={W * 0.06} y={H * 0.12} width={W * 0.22} height={H * 0.06} color="#F4FAFB" />
          <Oval x={W * 0.13} y={H * 0.09} width={W * 0.13} height={H * 0.06} color="#F4FAFB" />
          <Oval x={W * 0.6} y={H * 0.33} width={W * 0.16} height={H * 0.04} color="#EEF7F9" />
        </>
      )}
      {/* Winter: a few flakes in the air. */}
      {season === 'winter' &&
        Array.from({ length: 22 }, (_v, i) => (
          <Circle key={`snow${i}`} cx={W * ((i * 0.618034 + 0.05) % 1)} cy={H * ((i * 0.381966 + 0.07) % 1) * 0.7} r={1.2 + (i % 3) * 0.6} color="#FFFFFF" opacity={night ? 0.7 : 0.9} />
        ))}
      {/* Spring: a few petals carried on the air. */}
      {season === 'spring' &&
        Array.from({ length: 9 }, (_v, i) => (
          <Oval key={`petal${i}`} x={W * ((i * 0.618034 + 0.1) % 1)} y={H * ((i * 0.381966 + 0.1) % 1) * 0.6} width={5} height={3} color="#F4C6D3" opacity={night ? 0.6 : 0.85} />
        ))}
    </>
  );
}
