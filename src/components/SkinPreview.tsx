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
    case 'lilypads':
      return (
        <Group>
          <RoundedRect x={s * 0.08} y={s * 0.08} width={s * 0.84} height={s * 0.84} r={s * 0.14} color={c('pondWater')} />
          {[[0.32, 0.36, 0.17], [0.66, 0.62, 0.15]].map(([x, y, r]) => (
            <Group key={x}>
              <Circle cx={s * x} cy={s * (y + 0.02)} r={s * r} color={c('lilyPadEdge')} />
              <Circle cx={s * x} cy={s * y} r={s * r} color={c('lilyPad')} />
            </Group>
          ))}
          <Circle cx={s * 0.66} cy={s * 0.62} r={s * 0.07} color={c('lilyBloom')} />
        </Group>
      );
    case 'vanes':
      return (
        <Group>
          <Path path={`M ${s * 0.14} ${s * 0.3} q ${s * 0.1} ${-s * 0.05} ${s * 0.2} 0`} color={c('vaneWind')} style="stroke" strokeWidth={s * 0.04} strokeCap="round" />
          <Path path={`M ${s * 0.1} ${s * 0.72} q ${s * 0.1} ${-s * 0.05} ${s * 0.2} 0`} color={c('vaneWind')} style="stroke" strokeWidth={s * 0.04} strokeCap="round" />
          <Path path={`M ${s * 0.28} ${s * 0.5} L ${s * 0.74} ${s * 0.5}`} color={c('vaneMetal')} style="stroke" strokeWidth={s * 0.05} strokeCap="round" />
          <Path path={`M ${s * 0.88} ${s * 0.5} L ${s * 0.7} ${s * 0.4} L ${s * 0.74} ${s * 0.5} L ${s * 0.7} ${s * 0.6} Z`} color={c('vaneMetal')} />
          <Path path={`M ${s * 0.36} ${s * 0.5} L ${s * 0.2} ${s * 0.38} L ${s * 0.26} ${s * 0.5} L ${s * 0.2} ${s * 0.62} Z`} color={c('vaneAccent')} />
        </Group>
      );
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
      // A solved 3x3 board, drawn the way the game draws one: two pairs
      // of raised tokens, each joined by a cord that runs cell to cell
      // and between them fills every cell.
      const tone = c('arukoneAccent');
      const other = shade(tone, 1.46);
      const at = (i: number) => s * (0.27 + i * 0.23);
      const cord = (cells: ReadonlyArray<[number, number]>) => cells.map(([x, y], k) => `${k === 0 ? 'M' : 'L'} ${at(x)} ${at(y)}`).join(' ');
      const a = cord([[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]]);
      const b = cord([[1, 0], [2, 0], [2, 1], [1, 1]]);
      const w = s * 0.075;
      const shadow = c('towersShadow');
      return (
        <Group>
          <RoundedRect x={s * 0.13} y={s * 0.13} width={s * 0.74} height={s * 0.74} r={s * 0.08} color={paper} />
          {[1, 2].map(k => (
            <Group key={k}>
              <Rect x={s * (0.155 + k * 0.23)} y={s * 0.17} width={1} height={s * 0.66} color={rule} />
              <Rect x={s * 0.17} y={s * (0.155 + k * 0.23)} width={s * 0.66} height={1} color={rule} />
            </Group>
          ))}
          {[
            { d: a, tone, ends: [[0, 0], [2, 2]] },
            { d: b, tone: other, ends: [[1, 0], [1, 1]] },
          ].map(({ d, tone: t, ends }, k) => (
            <Group key={k}>
              <Group transform={[{ translateY: w * 0.14 }]}>
                <Path path={d} color={shadow} style="stroke" strokeWidth={w} strokeCap="round" strokeJoin="round" />
              </Group>
              <Path path={d} color={t} style="stroke" strokeWidth={w} strokeCap="round" strokeJoin="round" />
              <Group transform={[{ translateY: -w * 0.16 }]}>
                <Path path={d} color={shade(t, 1.3)} opacity={0.5} style="stroke" strokeWidth={w * 0.26} strokeCap="round" strokeJoin="round" />
              </Group>
              {ends.map(([x, y]) => (
                <Group key={`${x}${y}`}>
                  <Circle cx={at(x)} cy={at(y) + s * 0.012} r={s * 0.085} color={shadow} />
                  <Circle cx={at(x)} cy={at(y)} r={s * 0.085} color={t} />
                  <Circle cx={at(x)} cy={at(y)} r={s * 0.078} color={shade(t, 1.55)} opacity={0.85} style="stroke" strokeWidth={s * 0.012} />
                </Group>
              ))}
            </Group>
          ))}
        </Group>
      );
    }
    case 'glass': {
      // Four panes round a centre one, as the lesson's window.
      const glazes: ColorToken[] = ['glassRuby', 'glassCobalt', 'glassCobalt', 'glassRuby'];
      return (
        <Group>
          {glazes.map((t, i) => (
            <RoundedRect key={i} x={s * (0.12 + (i % 2) * 0.39)} y={s * (0.12 + Math.floor(i / 2) * 0.39)} width={s * 0.37} height={s * 0.37} r={s * 0.07} color={c(t)} />
          ))}
          <RoundedRect x={s * 0.32} y={s * 0.32} width={s * 0.36} height={s * 0.36} r={s * 0.08} color={paper} />
          <RoundedRect x={s * 0.345} y={s * 0.345} width={s * 0.31} height={s * 0.31} r={s * 0.07} color={c('glassAmber')} />
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
