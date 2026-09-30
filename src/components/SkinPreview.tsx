import React from 'react';
import { Canvas, Circle, Group, Path, Rect, RoundedRect } from '@shopify/react-native-skia';
import { shade } from '../game/rendering';
import { Cosmetic } from '../progression';
import { ColorToken, getColorScheme, paletteFor } from '../theme';

/**
 * A game skin in miniature: that game's own pieces, drawn in the skin's
 * colours - a tent, a lamp, a beam, a glaze - so the card shows what the
 * board will look like rather than a swatch. One canvas per preview.
 *
 * Colours come from the skin's tokens over the *unskinned* palette, so
 * the Classic card shows the game as designed even while another skin is
 * worn.
 */
export function SkinPreview({ item, size }: { item: Cosmetic; size: number }): React.JSX.Element {
  const dark = getColorScheme() === 'dark';
  const base = paletteFor(getColorScheme());
  const c = (token: ColorToken): string => (dark ? item.darkTokens?.[token] : undefined) ?? item.tokens?.[token] ?? base[token];
  const game = item.slot.replace('skin-', '');
  const s = size;
  return (
    <Canvas style={{ width: s, height: s }}>
      <RoundedRect x={0} y={0} width={s} height={s} r={s * 0.18} color={base.surface} />
      {draw(game, s, c, base.surfaceHi, base.border)}
    </Canvas>
  );
}

function draw(game: string, s: number, c: (token: ColorToken) => string, paper: string, rule: string): React.JSX.Element {
  switch (game) {
    case 'gravity': {
      const piece = c('pieceBlue');
      return (
        <Group>
          <RoundedRect x={s * 0.14} y={s * 0.14} width={s * 0.72} height={s * 0.72} r={s * 0.1} color={paper} />
          <Circle cx={s * 0.5} cy={s * 0.52} r={s * 0.22} color={shade(piece, 0.75)} />
          <Circle cx={s * 0.48} cy={s * 0.49} r={s * 0.2} color={piece} />
          <Circle cx={s * 0.42} cy={s * 0.43} r={s * 0.06} color="#FFFFFF" opacity={0.55} />
        </Group>
      );
    }
    case 'mirror': {
      const glow = c('mirrorBeamGlow');
      return (
        <Group>
          <RoundedRect x={s * 0.1} y={s * 0.1} width={s * 0.8} height={s * 0.8} r={s * 0.1} color={c('mirrorPanel')} />
          <Path path={`M ${s * 0.18} ${s * 0.62} L ${s * 0.6} ${s * 0.62} L ${s * 0.6} ${s * 0.2}`} color={glow} style="stroke" strokeWidth={s * 0.1} strokeCap="round" strokeJoin="round" opacity={0.35} />
          <Path path={`M ${s * 0.18} ${s * 0.62} L ${s * 0.6} ${s * 0.62} L ${s * 0.6} ${s * 0.2}`} color={c('mirrorBeamCore')} style="stroke" strokeWidth={s * 0.03} strokeCap="round" strokeJoin="round" />
          <Path path={`M ${s * 0.5} ${s * 0.72} L ${s * 0.7} ${s * 0.52}`} color={c('mirrorGlass')} style="stroke" strokeWidth={s * 0.04} strokeCap="round" />
        </Group>
      );
    }
    case 'tents':
      return (
        <Group>
          <RoundedRect x={s * 0.14} y={s * 0.7} width={s * 0.72} height={s * 0.06} r={s * 0.03} color={rule} />
          <Path path={`M ${s * 0.5} ${s * 0.24} L ${s * 0.18} ${s * 0.72} L ${s * 0.5} ${s * 0.72} Z`} color={c('tentDark')} />
          <Path path={`M ${s * 0.5} ${s * 0.24} L ${s * 0.82} ${s * 0.72} L ${s * 0.5} ${s * 0.72} Z`} color={c('tentLight')} />
          <Path path={`M ${s * 0.5} ${s * 0.48} L ${s * 0.43} ${s * 0.72} L ${s * 0.57} ${s * 0.72} Z`} color={paper} />
        </Group>
      );
    case 'towers': {
      const bars: Array<[number, number]> = [
        [0.16, 0.42],
        [0.4, 0.62],
        [0.64, 0.32],
      ];
      return (
        <Group>
          {bars.map(([x, h], i) => (
            <Group key={i}>
              <Rect x={s * x} y={s * (0.82 - h)} width={s * 0.2} height={s * h} color={c('towersBuilding')} />
              <Rect x={s * x} y={s * (0.82 - h)} width={s * 0.2} height={s * 0.04} color={c('towersBuildingRoof')} />
              {Array.from({ length: Math.floor(h / 0.14) }, (_v, k) => (
                <Rect key={k} x={s * (x + 0.06)} y={s * (0.82 - h + 0.08 + k * 0.13)} width={s * 0.08} height={s * 0.06} color={k % 2 === 0 ? c('towersWindow') : c('towersWindowDark')} />
              ))}
            </Group>
          ))}
        </Group>
      );
    }
    case 'binairo':
      return (
        <Group>
          <RoundedRect x={s * 0.1} y={s * 0.28} width={s * 0.38} height={s * 0.44} r={s * 0.08} color={paper} />
          <RoundedRect x={s * 0.52} y={s * 0.28} width={s * 0.38} height={s * 0.44} r={s * 0.08} color={paper} />
          <Circle cx={s * 0.29} cy={s * 0.5} r={s * 0.13} color={c('binairoMarkFilled')} />
          <Circle cx={s * 0.26} cy={s * 0.46} r={s * 0.05} color={c('binairoMarkFilledLight')} />
          <RoundedRect x={s * 0.595} y={s * 0.385} width={s * 0.23} height={s * 0.23} r={s * 0.04} color={c('binairoMarkOutline')} />
        </Group>
      );
    case 'arukone': {
      const tone = c('arukoneAccent');
      return (
        <Group>
          <Path path={`M ${s * 0.2} ${s * 0.25} L ${s * 0.2} ${s * 0.55} Q ${s * 0.2} ${s * 0.75} ${s * 0.45} ${s * 0.75} L ${s * 0.8} ${s * 0.75}`} color={tone} style="stroke" strokeWidth={s * 0.08} strokeCap="round" />
          <Path path={`M ${s * 0.45} ${s * 0.25} L ${s * 0.8} ${s * 0.25} L ${s * 0.8} ${s * 0.5}`} color={shade(tone, 1.45)} style="stroke" strokeWidth={s * 0.08} strokeCap="round" strokeJoin="round" />
          <Circle cx={s * 0.2} cy={s * 0.25} r={s * 0.08} color={tone} />
          <Circle cx={s * 0.8} cy={s * 0.75} r={s * 0.08} color={tone} />
        </Group>
      );
    }
    case 'fillapix': {
      const ink = c('fillapixAccent');
      const filled = [1, 3, 4, 5, 7];
      return (
        <Group>
          {Array.from({ length: 9 }, (_v, i) => (
            <RoundedRect key={i} x={s * (0.14 + (i % 3) * 0.25)} y={s * (0.14 + Math.floor(i / 3) * 0.25)} width={s * 0.22} height={s * 0.22} r={s * 0.04} color={filled.includes(i) ? ink : paper} />
          ))}
        </Group>
      );
    }
    case 'lightsout': {
      const lit = c('lightsOutLit');
      return (
        <Group>
          <RoundedRect x={s * 0.1} y={s * 0.1} width={s * 0.8} height={s * 0.8} r={s * 0.1} color={c('lightsOutPanel')} />
          {[0, 1, 2, 3].map(i => {
            const on = i !== 2;
            const cx = s * (0.33 + (i % 2) * 0.34);
            const cy = s * (0.33 + Math.floor(i / 2) * 0.34);
            return (
              <Group key={i}>
                {on && <Circle cx={cx} cy={cy} r={s * 0.14} color={lit} opacity={0.3} />}
                <Circle cx={cx} cy={cy} r={s * 0.09} color={on ? lit : c('lightsOutDim')} />
                {on && <Circle cx={cx} cy={cy} r={s * 0.04} color={c('lightsOutLitCore')} />}
              </Group>
            );
          })}
        </Group>
      );
    }
    case 'adjacent': {
      const tiles: ColorToken[] = ['adjacentTile0', 'adjacentTile1', 'adjacentTile2', 'adjacentTile3', 'adjacentTile4', 'adjacentTile1'];
      return (
        <Group>
          {tiles.map((t, i) => (
            <RoundedRect key={i} x={s * (0.12 + (i % 3) * 0.26)} y={s * (0.27 + Math.floor(i / 3) * 0.26)} width={s * 0.22} height={s * 0.22} r={s * 0.05} color={c(t)} />
          ))}
        </Group>
      );
    }
    case 'bloom': {
      const petal = c('bloomAccent');
      return (
        <Group>
          {[0, 1, 2, 3].map(i => {
            const a = (i / 4) * Math.PI * 2;
            return <Circle key={i} cx={s * 0.5 + Math.cos(a) * s * 0.16} cy={s * 0.5 + Math.sin(a) * s * 0.16} r={s * 0.17} color={petal} />;
          })}
          <Circle cx={s * 0.5} cy={s * 0.5} r={s * 0.08} color={paper} />
        </Group>
      );
    }
    case 'mosaic':
      return (
        <Group>
          <RoundedRect x={s * 0.1} y={s * 0.1} width={s * 0.8} height={s * 0.8} r={s * 0.08} color={c('mosaicGrout')} />
          {Array.from({ length: 9 }, (_v, i) => {
            const piece = i === 0 || i === 1 || i === 4 ? '#6E9A45' : i === 6 || i === 7 ? '#D9A441' : null;
            return <RoundedRect key={i} x={s * (0.15 + (i % 3) * 0.24)} y={s * (0.15 + Math.floor(i / 3) * 0.24)} width={s * 0.21} height={s * 0.21} r={s * 0.04} color={piece ?? c('mosaicSocket')} />;
          })}
        </Group>
      );
    default:
      return <Group />;
  }
}
