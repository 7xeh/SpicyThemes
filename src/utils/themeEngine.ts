import { themeState, ThemeConfig, WordEffectTrigger, resolveWordTrigger, eqStyleMeta, eqStyleBands } from './state';
import { startEqAudio, stopEqAudio, refreshEqElements } from './eqAudio';
import { startMusicVideo, stopMusicVideo, refreshMusicVideoLayer, setMusicVideoCompactAllowed } from './musicVideo';


const STYLE_ID = 'spicy-themes-injected-styles';
const BASE_STYLE_ID = 'spicy-themes-base-styles';
const MUSIC_VIDEO_ID = 'spicy-themes-mv';

const NPV_CARD = '#SpicyLyricsNPVCard';
const METADATA_SELECTOR = '#SpicyLyricsPage:not(.CardMode) .ContentBox .NowBar .Header .Metadata';

function hexToRgba(hex: string, alpha: number): string {
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    if (hex.startsWith('rgb')) {
        const match = hex.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (match) return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
    }
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
    };
}

function readableOn(color: string): string {
    const { r, g, b } = hexToRgb(color);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 150 ? 'rgba(0, 0, 0, 0.68)' : '#fff';
}

function gradientRule(r: number, g: number, b: number, r2?: number, g2?: number, b2?: number, feather = 20): string {
    const er = r2 ?? r, eg = g2 ?? g, eb = b2 ?? b;
    return `background-image: linear-gradient(
        var(--gradient-degrees, 180deg),
        rgba(${r}, ${g}, ${b}, var(--gradient-alpha, 1)) var(--gradient-position, 0%),
        rgba(${er}, ${eg}, ${eb}, var(--gradient-alpha-end, 1)) calc(var(--gradient-position, 0%) + ${feather}% + var(--gradient-offset, 0%))
    ) !important;
    background-size: 100% 100% !important;
    background-repeat: no-repeat !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    -webkit-text-fill-color: transparent !important;`;
}

function colorRule(color: string): string {
    return `color: ${color} !important;
    -webkit-text-fill-color: ${color} !important;
    background-image: none !important;
    -webkit-background-clip: unset !important;
    background-clip: unset !important;`;
}

function sel(bases: string[], suffix: string): string {
    return bases.map(b => suffix ? `${b} ${suffix}` : b).join(',\n');
}

function lineSelectors(bases: string[], state: string): string {
    return bases.flatMap(base => [
        `${base} .line.${state}`,
        `${base} .line.${state} .word`,
        `${base} .line.${state} .letter`,
        `${base} .line.${state} .letterGroup`,
    ]).join(',\n');
}

function buildProps(...decls: (string | false | null | undefined | 0 | '')[]): string {
    return (decls.filter(Boolean) as string[]).join('\n    ');
}

function lineOriginRules(lineTargets: string[]): string {
    const variant = (suffix: string) => lineTargets.map(t => `${t}${suffix}`).join(',\n');
    return `
${variant('')} {
    transform-origin: left center !important;
}
${variant('.OppositeAligned')},
${variant('.rtl')} {
    transform-origin: right center !important;
}
${variant('.rtl.OppositeAligned')} {
    transform-origin: left center !important;
}
`;
}

function round(value: number, digits = 3): number {
    const f = 10 ** digits;
    return Math.round(value * f) / f;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

interface WordAnimSpec {
    duration: number;
    easing: string;
    origin?: string;
    perspective?: boolean;
    frames: (intensity: number, baseShadow: string) => string;
}

const WORD_ANIMS: Record<string, WordAnimSpec> = {
    pop: {
        duration: 0.34,
        easing: 'cubic-bezier(0.2, 0.85, 0.25, 1)',
        frames: (i) => `
    0% { scale: 1; }
    38% { scale: ${round(1 + 0.1 * i)}; }
    100% { scale: 1; }`,
    },

    wave: {
        duration: 1.1,
        easing: 'ease-in-out',
        frames: (i) => `
    0%, 100% { translate: 0 0; }
    50% { translate: 0 -${round(0.14 * i)}em; }`,
    },

    bounce: {
        duration: 0.62,
        easing: 'cubic-bezier(0.28, 0.84, 0.42, 1)',
        origin: '50% 90%',
        frames: (i) => {
            const squash = round(0.06 * i);
            return `
    0% { translate: 0 0; scale: 1 1; }
    22% { translate: 0 -${round(0.22 * i)}em; scale: ${round(1 - squash * 0.6)} ${round(1 + squash)}; }
    52% { translate: 0 ${round(0.07 * i)}em; scale: ${round(1 + squash)} ${round(1 - squash)}; }
    76% { translate: 0 -${round(0.07 * i)}em; scale: 1 1; }
    100% { translate: 0 0; scale: 1 1; }`;
        },
    },

    stamp: {
        duration: 0.42,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        frames: (i) => `
    0% { scale: ${round(1 + 0.55 * i)}; opacity: 0.3; filter: blur(${round(2.4 * i)}px); }
    48% { opacity: 1; }
    100% { scale: 1; opacity: 1; filter: blur(0px); }`,
    },

    shake: {
        duration: 0.42,
        easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        frames: (i) => `
    0%, 100% { translate: 0 0; }
    12% { translate: -${round(0.055 * i)}em 0; }
    28% { translate: ${round(0.055 * i)}em 0; }
    44% { translate: -${round(0.038 * i)}em 0; }
    60% { translate: ${round(0.038 * i)}em 0; }
    80% { translate: -${round(0.018 * i)}em 0; }`,
    },

    glitch: {
        duration: 0.45,
        easing: 'steps(1, end)',
        frames: (i, baseShadow) => {
            const tail = baseShadow ? `, ${baseShadow}` : '';
            const rest = baseShadow || 'none';
            const chroma = (offset: number) =>
                `${round(offset)}em 0 rgba(255, 0, 92, 0.72), ${round(-offset)}em 0 rgba(0, 232, 255, 0.72)${tail}`;
            return `
    0% { translate: 0 0; opacity: 1; text-shadow: ${rest}; }
    14% { translate: -${round(0.07 * i)}em 0; opacity: 1; text-shadow: ${chroma(0.05 * i)}; }
    26% { translate: ${round(0.055 * i)}em 0; opacity: 0.78; text-shadow: ${chroma(-0.05 * i)}; }
    38% { translate: -${round(0.03 * i)}em 0; opacity: 1; text-shadow: ${chroma(0.028 * i)}; }
    54% { translate: ${round(0.03 * i)}em 0; opacity: 0.9; text-shadow: ${chroma(-0.028 * i)}; }
    70% { translate: -${round(0.014 * i)}em 0; opacity: 1; text-shadow: ${rest}; }
    100% { translate: 0 0; opacity: 1; text-shadow: ${rest}; }`;
        },
    },

    rise: {
        duration: 0.46,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        frames: (i) => `
    0% { translate: 0 ${round(0.38 * i)}em; opacity: 0.35; }
    100% { translate: 0 0; opacity: 1; }`,
    },

    sway: {
        duration: 2.4,
        easing: 'ease-in-out',
        origin: '50% 80%',
        frames: (i) => `
    0%, 100% { rotate: -${round(2.4 * i)}deg; }
    50% { rotate: ${round(2.4 * i)}deg; }`,
    },

    focus: {
        duration: 0.42,
        easing: 'ease-out',
        frames: (i) => `
    0% { filter: blur(${round(3.2 * i)}px); opacity: 0.35; }
    100% { filter: blur(0px); opacity: 1; }`,
    },

    swell: {
        duration: 2.2,
        easing: 'ease-in-out',
        frames: (i) => `
    0%, 100% { scale: 1; }
    50% { scale: ${round(1 + 0.05 * i)}; }`,
    },

    flip: {
        duration: 0.5,
        easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)',
        origin: '50% 80%',
        perspective: true,
        frames: (i) => `
    0% { rotate: x ${round(72 * i)}deg; opacity: 0.4; }
    55% { opacity: 1; }
    100% { rotate: x 0deg; opacity: 1; }`,
    },

    depth: {
        duration: 0.55,
        easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)',
        perspective: true,
        frames: (i) => `
    0% { translate: 0 0 0; }
    40% { translate: 0 0 ${round(70 * i)}px; }
    100% { translate: 0 0 0; }`,
    },

    lean: {
        duration: 0.48,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        origin: '50% 90%',
        frames: (i) => `
    0% { rotate: -${round(7 * i)}deg; scale: 1 ${round(1 + 0.09 * i)}; opacity: 0.3; }
    100% { rotate: 0deg; scale: 1 1; opacity: 1; }`,
    },
};

const WORD_STAGGER_DEPTH = 48;

export function wordEffectTrigger(config: ThemeConfig): WordEffectTrigger | null {
    if (!WORD_ANIMS[config.wordEffect]) return null;
    return resolveWordTrigger(config.wordEffect, config.wordEffectTrigger);
}

function wordEffectCSS(config: ThemeConfig, bases: string[], baseShadow: string): string[] {
    const spec = WORD_ANIMS[config.wordEffect];
    if (!spec) return [];

    const trigger = resolveWordTrigger(config.wordEffect, config.wordEffectTrigger);
    const intensity = clamp(config.wordEffectIntensity, 0.1, 2);
    const speed = clamp(config.wordEffectSpeed, 0.3, 3);
    const stagger = clamp(config.wordEffectStagger, 0, 150) / 1000;
    const duration = round(spec.duration / speed, 4);
    const name = `st-word-${config.wordEffect}`;
    const scope = `:is(${bases.join(', ')})`;
    const gate = trigger === 'word' ? '.st-word-live' : '';

    const targets = (root: string, nth: string) => [
        `${root} .line.Active :is(.word, .letterGroup)${nth}${gate}`,
        `.slt-interleaved-translation.Active .slt-sync-word${nth}${gate}`,
        `.slt-replace-line.Active .slt-replace-word${nth}${gate}`,
    ].join(',\n');

    const iterations = trigger === 'loop' ? 'infinite' : '1';
    const fill = trigger === 'line' ? 'backwards' : 'none';
    const out: string[] = [];

    out.push(`
@keyframes ${name} {${spec.frames(intensity, baseShadow)}
}
${targets(scope, '')} {
    ${buildProps(
        'display: inline-block !important;',
        `animation: ${name} ${duration}s ${spec.easing} ${iterations} ${fill} !important;`,
        spec.origin && `transform-origin: ${spec.origin} !important;`,
        trigger === 'loop' && 'will-change: transform, opacity !important;',
        'backface-visibility: hidden !important;',
    )}
}
`);

    if (spec.perspective) {
        out.push(`
${scope} .line.Active,
.slt-interleaved-translation.Active,
.slt-replace-line.Active {
    perspective: 640px !important;
    transform-style: preserve-3d !important;
}
`);
    }

    if (trigger !== 'word' && stagger > 0) {
        const sign = trigger === 'loop' ? '-' : '';
        const delays: string[] = [];
        for (let n = 1; n <= WORD_STAGGER_DEPTH; n++) {
            delays.push(`${targets('#SpicyLyricsPage', `:nth-child(${n})`)} {\n    animation-delay: ${sign}${round((n - 1) * stagger, 4)}s !important;\n}`);
        }
        out.push(delays.join('\n'));
    }

    out.push(`
@media (prefers-reduced-motion: reduce) {
    ${targets('#SpicyLyricsPage', '')} {
        animation: none !important;
    }
}
`);

    return out;
}

export function generateThemeCSS(config: ThemeConfig): string {
    const css: string[] = [];

    const activeRgb = hexToRgb(config.activeLineColor);
    const sungRgb = hexToRgb(config.sungLineColor);
    const notSungRgb = hexToRgb(config.notSungLineColor);
    const gradStartRgb = hexToRgb(config.gradientStartColor);
    const gradEndRgb = hexToRgb(config.gradientEndColor);

    const BASES = [
        '#SpicyLyricsPage.SpicyRenderer .LyricsContainer .LyricsContent',
        '#SpicyLyricsPage .SpicyLyricsScrollContainer',
    ];
    const SIDEBAR = [
        `${NPV_CARD} #SpicyLyricsPage.SpicyRenderer .LyricsContainer .LyricsContent`,
        `${NPV_CARD} #SpicyLyricsPage .SpicyLyricsScrollContainer`,
    ];
    const PIP = [
        '.spicy-pip-wrapper #SpicyLyricsPage .LyricsContainer .LyricsContent',
        '.spicy-pip-wrapper #SpicyLyricsPage .SpicyLyricsScrollContainer',
        '.spicy-pip-wrapper #SpicyLyricsPage .LyricsContent',
    ];
    const ALL = [...BASES, ...PIP];

    const gradientFeather = round(clamp(config.gradientFeather, 0, 60), 2);
    const activeGrad = config.gradientEnabled
        ? gradientRule(gradStartRgb.r, gradStartRgb.g, gradStartRgb.b, gradEndRgb.r, gradEndRgb.g, gradEndRgb.b, gradientFeather)
        : colorRule(config.activeLineColor);
    const sungGrad = colorRule(config.sungLineColor);
    const notSungGrad = colorRule(config.notSungLineColor);

    const clampedActiveGlow = Math.min(config.activeGlowIntensity, 15);
    const clampedGlow = Math.min(config.glowIntensity, 15);
    const clampedSidebarGlow = Math.min(Math.round(config.activeGlowIntensity * 0.7), 15);
    const glowActive = config.glowEnabled && `filter: drop-shadow(0 0 ${clampedActiveGlow}px ${config.activeGlowColor}) !important;`;
    const glowNormal = config.glowEnabled && `filter: drop-shadow(0 0 ${clampedGlow}px ${config.glowColor}) !important;`;
    const glowSidebar = config.glowEnabled && `filter: drop-shadow(0 0 ${clampedSidebarGlow}px ${config.activeGlowColor}) !important;`;
    const scaleEffect = !config.scaleInEffect && config.scaleActive !== 1.0 && `transform: scale3d(${config.scaleActive}, ${config.scaleActive}, 1) !important;`;
    const glowPulseOn = config.glowEnabled && config.glowPulse;
    const pulseSpeed = Math.min(Math.max(config.glowPulseSpeed, 0.3), 3);
    const pulsePeak = Math.min(Math.round(clampedActiveGlow * 1.9) + 2, 30);
    const pulseAnim = glowPulseOn ? `st-glow-pulse ${(1.6 / pulseSpeed).toFixed(2)}s ease-in-out infinite` : '';
    const bgGlowRgb = hexToRgb(config.bgGlowColor);
    const clampedBgGlow = Math.min(config.bgGlowIntensity, 30);
    const dropShadow = config.textShadowEnabled
        ? `${config.textShadowOffsetX}px ${config.textShadowOffsetY}px ${config.textShadowBlur}px ${hexToRgba(config.textShadowColor, config.textShadowOpacity)}`
        : '';
    const shadowSuffix = dropShadow ? `, ${dropShadow}` : '';
    const bgGlowDecl = config.bgGlowEnabled
        ? `text-shadow: 0 0 ${clampedBgGlow}px rgba(${bgGlowRgb.r}, ${bgGlowRgb.g}, ${bgGlowRgb.b}, var(--text-shadow-opacity, 1))${shadowSuffix} !important;`
        : '';
    const wordBaseShadow = [
        config.bgGlowEnabled && `0 0 ${clampedBgGlow}px rgba(${bgGlowRgb.r}, ${bgGlowRgb.g}, ${bgGlowRgb.b}, var(--text-shadow-opacity, 1))`,
        dropShadow,
    ].filter(Boolean).join(', ');
    const lyricTransitionMs = Math.max(8.333, 110 / config.animationSpeed).toFixed(3);
    const lyricSnapMs = Math.max(8.333, 56 / config.animationSpeed).toFixed(3);

    const fontFamily = config.fontFamily === 'Custom Font' ? '' : config.fontFamily;
    const sltTranslationFont = config.sltTranslationFont === 'Custom Font' ? '' : config.sltTranslationFont;
    const sltFont = sltTranslationFont || fontFamily;
    const sltFontFamilyDecl = sltFont ? `font-family: ${sltFont}, system-ui, sans-serif !important;` : '';
    const sltCombinedScale = Math.round(config.sltTranslationFontSize * config.lyricsScale * 10000) / 10000;
    const sltFontOverrides = buildProps(
        sltCombinedScale !== 1.0 && `font-size: calc(1em * ${sltCombinedScale}) !important;`,
        sltFontFamilyDecl,
        `font-weight: ${config.fontWeight} !important;`,
    );

    css.push(`
@property --gradient-position {
    syntax: '<percentage>';
    inherits: true;
    initial-value: 0%;
}

@property --gradient-offset {
    syntax: '<percentage>';
    inherits: true;
    initial-value: 0%;
}

@property --gradient-alpha {
    syntax: '<number>';
    inherits: true;
    initial-value: 1;
}

@property --gradient-alpha-end {
    syntax: '<number>';
    inherits: true;
    initial-value: 1;
}
`);

    css.push(`
${sel(ALL, '.line')} {
    ${buildProps(
        `--Vocal-Active-opacity: ${config.activeLineOpacity} !important;`,
        `--Vocal-Sung-opacity: ${config.sungLineOpacity} !important;`,
        `--Vocal-NotSung-opacity: ${config.notSungLineOpacity} !important;`,
        `--gradient-degrees: ${config.gradientAngle}deg !important;`,
        `--st-lyric-transition: ${lyricTransitionMs}ms !important;`,
        `--st-lyric-snap: ${lyricSnapMs}ms !important;`,
        fontFamily && `font-family: ${fontFamily}, system-ui, sans-serif !important;`,
        `font-weight: ${config.fontWeight} !important;`,
        config.lyricsScale !== 1.0 && `font-size: calc(1em * ${config.lyricsScale}) !important;`,
        config.letterSpacing !== 0 && `letter-spacing: ${config.letterSpacing}em !important;`,
        config.wordSpacing !== 0 && `word-spacing: ${round(clamp(config.wordSpacing, -0.1, 1), 3)}em !important;`,
        config.fontStyle !== 'normal' && `font-style: ${config.fontStyle} !important;`,
        config.lineHeight !== 1.1818181818 && `--lyrics-line-height: ${config.lineHeight} !important;`,
    )}
    transition-property: opacity, filter, transform, color, -webkit-text-fill-color, --gradient-position, --gradient-offset, --gradient-alpha, --gradient-alpha-end !important;
    transition-duration: var(--st-lyric-transition) !important;
    transition-timing-function: linear !important;
    backface-visibility: hidden !important;
    transform-style: preserve-3d !important;
    ${(config.glowEnabled || config.bgGlowEnabled) ? 'contain: layout style !important;' : 'contain: paint style !important;'}
}
`);

    css.push(`
${ALL.flatMap(b => [
    `${b} .line .word`,
    `${b} .line .letter`,
    `${b} .line .letterGroup`,
]).join(',\n')} {
    font-weight: ${config.fontWeight} !important;
    ${fontFamily ? `font-family: ${fontFamily}, system-ui, sans-serif !important;` : ''}
    transition-property: color, -webkit-text-fill-color !important;
    transition-duration: var(--st-lyric-snap) !important;
    transition-timing-function: linear !important;
    backface-visibility: hidden !important;
}
`);

    if (config.textTransform !== 'none') {
        css.push(`
${ALL.map(b => `${b} .line`).join(',\n')} {
    text-transform: ${config.textTransform} !important;
}
`);
    }

    if (config.textAlign !== 'default' || config.maxLineWidth > 0) {
        const width = round(clamp(config.maxLineWidth, 0, 100), 2);
        const inlineMargin: Record<string, string> = {
            center: 'margin-inline: auto !important;',
            right: 'margin-inline: auto 0 !important;',
            left: 'margin-inline: 0 auto !important;',
        };
        css.push(`
${ALL.map(b => `${b} .line`).join(',\n')} {
    ${buildProps(
        config.textAlign !== 'default' && `text-align: ${config.textAlign} !important;`,
        width > 0 && `max-width: ${width}% !important;`,
        width > 0 && (inlineMargin[config.textAlign] || 'margin-inline: 0 auto !important;'),
    )}
}
`);
    }

    if (config.activeLineWeight > 0) {
        css.push(`
${ALL.flatMap(b => [
    `${b} .line.Active`,
    `${b} .line.Active .word`,
    `${b} .line.Active .letter`,
    `${b} .line.Active .letterGroup`,
]).join(',\n')} {
    font-weight: ${Math.round(config.activeLineWeight)} !important;
}
`);
    }

    if (config.gradientEnabled && config.gradientDirection !== 'auto') {
        const custom = clamp(Math.round(config.gradientAngle), 0, 360);
        const DIRECTIONS: Record<string, [number, number]> = {
            horizontal: [90, -90],
            vertical: [180, 180],
            diagonal: [135, -135],
            custom: [custom, -custom],
        };
        const [ltr, rtl] = DIRECTIONS[config.gradientDirection] || DIRECTIONS.horizontal;
        const paints = (base: string, prefix: string) => [
            `${base} ${prefix}`,
            `${base} ${prefix} .word`,
            `${base} ${prefix} .letter`,
            `${base} ${prefix} .letterGroup`,
        ];
        css.push(`
${ALL.flatMap(b => paints(b, '.line:not(.rtl)')).join(',\n')} {
    --gradient-degrees: ${ltr}deg !important;
}
${ALL.flatMap(b => paints(b, '.line.rtl')).join(',\n')} {
    --gradient-degrees: ${rtl}deg !important;
}
`);
    }

    css.push(`
${ALL.map(b => `${b} .line.Active`).join(',\n')} {
    will-change: opacity, filter, transform !important;
}
`);

    css.push(`
${lineSelectors(ALL, 'Active')} {
    ${activeGrad}
}
`);

    if (scaleEffect) {
        css.push(`
${ALL.map(b => `${b} .line.Active`).join(',\n')} {
    ${scaleEffect}
}
${lineOriginRules(ALL.map(b => `${b} .line.Active`))}
`);
    }

    css.push(`
${lineSelectors(ALL, 'Sung')} {
    ${sungGrad}
}
`);

    css.push(`
${lineSelectors(ALL, 'NotSung')} {
    ${notSungGrad}
}
`);

    if (config.glowEnabled) {
        css.push(`
${ALL.map(b => `${b} .line.Active`).join(',\n')} {
    ${glowActive}
}
${ALL.map(b => `${b} .line.Sung`).join(',\n')},
${ALL.map(b => `${b} .line.NotSung`).join(',\n')} {
    ${glowNormal}
}
`);
    }

    if (glowPulseOn) {
        css.push(`
@keyframes st-glow-pulse {
    0%, 100% { filter: drop-shadow(0 0 ${clampedActiveGlow}px ${config.activeGlowColor}); }
    50% { filter: drop-shadow(0 0 ${pulsePeak}px ${config.activeGlowColor}); }
}
`);
        if (!config.scaleInEffect) {
            css.push(`
${ALL.map(b => `${b} .line.Active`).join(',\n')} {
    animation: ${pulseAnim} !important;
    will-change: filter !important;
}
`);
        }
    }

    if (config.blurUnsung) {
        const blurTargets = [
            ...ALL.flatMap(b => [`${b} .line.Sung`, `${b} .line.NotSung`]),
            '.slt-replace-line.Sung',
            '.slt-replace-line.NotSung',
            '.line.Sung + .slt-replace-line',
            '.line.NotSung + .slt-replace-line',
            '.line.Sung + .slt-interleaved-translation',
            '.line.NotSung + .slt-interleaved-translation',
        ].join(',\n');
        const blurFilter = config.glowEnabled
            ? `filter: blur(${config.blurAmount}px) drop-shadow(0 0 ${clampedGlow}px ${config.glowColor}) !important;`
            : `filter: blur(${config.blurAmount}px) !important;`;
        css.push(`
${blurTargets} {
    ${blurFilter}
    will-change: filter, opacity, transform;
}
`);

        if (config.blurProgressive) {
            const glowPart = config.glowEnabled ? ` drop-shadow(0 0 ${clampedGlow}px ${config.glowColor})` : '';
            const ramp = [0.3, 0.6, 0.85];
            const rampRules = ramp.map((factor, idx) => {
                const k = idx + 1;
                const ahead = Array(k).fill('+ [data-index]');
                ahead[ahead.length - 1] = '+ [data-index]:not(.st-preview-line)';
                const behind = Array(k).fill('+ [data-index]');
                behind[behind.length - 1] = '+ [data-index] > .line.Active';

                const targets = ALL.flatMap(b => [
                    `${b} [data-index]:has(> .line.Active) ${ahead.join(' ')} > .line`,
                    `${b} [data-index]:not(.st-preview-line):has(${behind.join(' ')}) > .line`,
                ]).join(',\n');

                const amount = Math.round(config.blurAmount * factor * 100) / 100;
                return `${targets} {\n    filter: blur(${amount}px)${glowPart} !important;\n}`;
            });
            css.push(rampRules.join('\n'));
        }

        const unblurFilter = config.glowEnabled
            ? `filter: drop-shadow(0 0 ${clampedGlow}px ${config.glowColor}) !important;`
            : `filter: none !important;`;
        const unblurTargets = [
            ...ALL.map(b => `${b} [data-index].st-preview-line > .line`),
            ...ALL.map(b => `${b} [data-index].st-preview-line > .line.Sung`),
            ...ALL.map(b => `${b} [data-index].st-preview-line > .line.NotSung`),
            '[data-index].st-preview-line .slt-interleaved-translation',
            '[data-index].st-preview-line .slt-replace-line',
            '.slt-replace-line.Active',
            '.slt-replace-line.active',
            '.line.Active + .slt-replace-line',
            '.slt-interleaved-translation.Active',
            '.slt-interleaved-translation.active',
            '.line.Active + .slt-interleaved-translation',
        ];
        css.push(`
${unblurTargets.join(',\n')} {
    ${unblurFilter}
}
`);
    }

    if (config.blurSungWords) {
        const sungWordTargets = ALL.flatMap(b => [
            `${b} .line.Active .word.st-sung-word`,
            `${b} .line.Active .letterGroup.st-sung-word`,
        ]).join(',\n');
        const sungWordTransitions = ALL.flatMap(b => [
            `${b} .line.Active .word`,
            `${b} .line.Active .letterGroup`,
        ]).join(',\n');
        css.push(`
${sungWordTransitions} {
    transition-property: color, -webkit-text-fill-color, filter !important;
    transition-duration: 180ms !important;
    transition-timing-function: linear !important;
}
${sungWordTargets} {
    filter: blur(${config.blurSungWordsAmount}px) opacity(${config.blurSungWordsOpacity}) !important;
}
`);
    }

    if (config.textShadowEnabled) {
        const shadowTargets = [
            ...ALL.map(b => `${b} .line`),
            '.slt-replace-line',
            '.slt-interleaved-translation',
        ].join(',\n');
        css.push(`
${shadowTargets} {
    text-shadow: ${dropShadow} !important;
}
`);
    }

    if (config.textStrokeEnabled && config.textStrokeWidth > 0) {
        const strokeWidth = round(clamp(config.textStrokeWidth, 0, 3), 2);
        const strokeTargets = [
            ...ALL.flatMap(b => [
                `${b} .line`,
                `${b} .line :is(.word, .letter, .letterGroup)`,
            ]),
            '.slt-replace-line',
            '.slt-replace-line .slt-replace-word',
            '.slt-interleaved-translation',
            '.slt-interleaved-translation .slt-sync-word',
        ].join(',\n');
        css.push(`
${strokeTargets} {
    -webkit-text-stroke: ${strokeWidth}px ${config.textStrokeColor} !important;
    paint-order: stroke fill !important;
}
`);
    }

    if (config.lineWindowEnabled) {
        const sungN = Math.min(Math.max(Math.round(config.lineWindowSungLines), 0), 10);
        const unsungN = Math.min(Math.max(Math.round(config.lineWindowUnsungLines), 0), 10);

        const hideTargets = ALL.flatMap(b => [
            `${b} [data-index]:has(> .line.Sung)`,
            `${b} [data-index]:has(> .line.NotSung)`,
        ]).join(',\n');
        css.push(`
${hideTargets} {
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
    transition: opacity 0.35s ease, visibility 0s linear 0.35s !important;
}
`);

        const showTargets: string[] = [...ALL.map(b => `${b} [data-index]:has(> .line.Active)`)];
        for (let k = 1; k <= unsungN; k++) {
            const fwd = Array(k).fill('+ [data-index]').join(' ');
            showTargets.push(...ALL.map(b => `${b} [data-index]:has(> .line.Active) ${fwd}`));
        }
        for (let k = 1; k <= sungN; k++) {
            const parts = Array(k).fill('+ [data-index]');
            parts[parts.length - 1] = '+ [data-index] > .line.Active';
            const inner = parts.join(' ');
            showTargets.push(...ALL.map(b => `${b} [data-index]:has(${inner})`));
        }
        css.push(`
${showTargets.join(',\n')} {
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    transition: opacity 0.35s ease, visibility 0s !important;
}
`);
    }

    if (config.bgGlowEnabled) {
        const bgGlowTargets = ALL.flatMap(b => [
            `${b} .line.Active`,
            `${b} .line.Active .word`,
            `${b} .line.Active .letter`,
            `${b} .line.Active .letterGroup`,
        ]).join(',\n');
        css.push(`
${bgGlowTargets} {
    ${bgGlowDecl}
}
`);
    }

    if (config.disableHighlight) {
        const states = ['Active', 'Sung', 'NotSung'];
        const highlightTargets = ALL.flatMap(b =>
            states.flatMap(s => [
                `${b} .line.${s}`,
                `${b} .line.${s} .word`,
                `${b} .line.${s} .letter`,
                `${b} .line.${s} .letterGroup`,
                `${b} .line.${s} .syllable`,
                `${b} .line.${s} .syllableGroup`,
            ])
        ).join(',\n');
        css.push(`
${highlightTargets} {
    background-image: none !important;
    -webkit-background-clip: unset !important;
    background-clip: unset !important;
    color: ${config.highlightColor} !important;
    -webkit-text-fill-color: ${config.highlightColor} !important;
    transition-property: color, -webkit-text-fill-color, opacity, filter, transform !important;
    transition-duration: var(--st-lyric-snap, ${lyricSnapMs}ms) !important;
    transition-timing-function: linear !important;
}
`);
    }

    if (config.pageBgOverlay) {
        css.push(`
#SpicyLyricsPage:not(.CardMode) .LyricsContainer::before,
#SpicyLyricsPage.CompactMode::before {
    content: '';
    position: absolute;
    inset: 0;
    background: ${hexToRgba(config.pageBgColor, config.pageBgOpacity)};
    pointer-events: none;
    z-index: 0;
}
#SpicyLyricsPage .LyricsContainer,
#SpicyLyricsPage.CompactMode {
    position: relative;
}
#SpicyLyricsPage.SpicyRenderer .LyricsContainer .LyricsContent,
.spicy-pip-wrapper #SpicyLyricsPage .LyricsContainer .LyricsContent,
.spicy-pip-wrapper #SpicyLyricsPage .LyricsContent,
#SpicyLyricsPage.CompactMode .ContentBox {
    position: relative;
    z-index: 1;
}
#SpicyLyricsPage.CompactMode::before {
    z-index: 1;
}
#SpicyLyricsPage.CompactMode .ContentBox {
    z-index: 2;
}
#SpicyLyricsPage.CompactMode .LyricsContainer::before {
    display: none !important;
}
`);
    }

    if (config.sltStylingEnabled) {
    const useSltColor = config.sltTranslationColorEnabled && !!config.sltTranslationColor;
    const sltBaseColor = useSltColor ? config.sltTranslationColor : config.notSungLineColor;
    const useSltGlow = config.sltGlowColorEnabled && !!config.sltGlowColor;
    const sltGlowActive = config.glowEnabled && `filter: drop-shadow(0 0 ${clampedActiveGlow}px ${useSltGlow ? config.sltGlowColor : config.activeGlowColor}) !important;`;
    const sltBgGlowRgb = hexToRgb(useSltGlow ? config.sltGlowColor : config.bgGlowColor);
    const sltBgGlowDecl = config.bgGlowEnabled
        ? `text-shadow: 0 0 ${clampedBgGlow}px rgba(${sltBgGlowRgb.r}, ${sltBgGlowRgb.g}, ${sltBgGlowRgb.b}, var(--text-shadow-opacity, 1))${shadowSuffix} !important;`
        : '';
    const sltKaraokeGlowDecl = `text-shadow: 0 0 7px ${hexToRgba(useSltGlow ? config.sltGlowColor : (config.gradientEnabled ? config.gradientStartColor : config.activeLineColor), 0.5)}${shadowSuffix} !important;`;
    if (sltFontFamilyDecl) {
        css.push(`
#SpicyLyricsPage .slt-interleaved-translation.slt-interleaved-translation,
#SpicyLyricsPage .slt-interleaved-translation.slt-interleaved-translation *,
#SpicyLyricsPage .slt-replace-line.slt-replace-line,
#SpicyLyricsPage .slt-replace-line.slt-replace-line * {
    ${sltFontFamilyDecl}
}
`);
    }
    const sltHlStartRgb = hexToRgb(config.sltHighlightStartColor);
    const sltHlEndRgb = hexToRgb(config.sltHighlightEndColor);
    const sltHlGrad = gradientRule(sltHlStartRgb.r, sltHlStartRgb.g, sltHlStartRgb.b, sltHlEndRgb.r, sltHlEndRgb.g, sltHlEndRgb.b, gradientFeather);
    const activeGrad = sltHlGrad;
    const sungGrad = sltHlGrad;
    const notSungGrad = colorRule(sltBaseColor);
    const sltActiveOpacity = Math.round(config.activeLineOpacity * config.sltTranslationOpacity * 1000) / 1000;
    const sltSungOpacity = Math.round(config.sungLineOpacity * config.sltTranslationOpacity * 1000) / 1000;
    const sltNotSungOpacity = Math.round(config.notSungLineOpacity * config.sltTranslationOpacity * 1000) / 1000;
    css.push(`
.slt-replace-line {
    ${buildProps(notSungGrad, `opacity: ${config.sltTranslationOpacity} !important;`, sltFontOverrides)}
    transition-property: opacity, filter, transform, color, -webkit-text-fill-color, --gradient-position, --gradient-offset, --gradient-alpha, --gradient-alpha-end !important;
    transition-duration: ${lyricTransitionMs}ms !important;
    transition-timing-function: linear !important;
    backface-visibility: hidden !important;
}

.slt-replace-line:has(.slt-replace-word) {
    background-image: none !important;
}

.slt-replace-word {
    ${notSungGrad}
    ${sltFontFamilyDecl}
    display: inline-block !important;
    white-space: pre-wrap !important;
    transition-property: color, -webkit-text-fill-color, transform, text-shadow !important;
    transition-duration: ${lyricSnapMs}ms !important;
    transition-timing-function: linear !important;
    backface-visibility: hidden !important;
}

.slt-interleaved-translation:not(.slt-sync-translation) {
    ${buildProps(
        notSungGrad,
        `opacity: ${config.sltTranslationOpacity} !important;`,
        sltFontOverrides,
    )}
    transition-property: opacity, filter, transform, color, -webkit-text-fill-color, --gradient-position, --gradient-offset, --gradient-alpha, --gradient-alpha-end !important;
    transition-duration: ${lyricTransitionMs}ms !important;
    transition-timing-function: linear !important;
    backface-visibility: hidden !important;
}

.slt-sync-translation.slt-interleaved-translation {
    ${buildProps(
        notSungGrad,
        `opacity: ${config.sltTranslationOpacity} !important;`,
        `background-size: 100% 100% !important;`,
        `background-repeat: no-repeat !important;`,
        `-webkit-box-decoration-break: slice !important;`,
        `box-decoration-break: slice !important;`,
        sltFontOverrides,
    )}
    transition-property: opacity, filter, transform, color, -webkit-text-fill-color, --gradient-position, --gradient-offset, --gradient-alpha, --gradient-alpha-end !important;
    transition-duration: ${lyricTransitionMs}ms !important;
    transition-timing-function: linear !important;
    backface-visibility: hidden !important;
}

.slt-sync-translation.slt-interleaved-translation:has(.slt-sync-word) {
    background-image: none !important;
}

.slt-sync-word {
    ${notSungGrad}
    ${sltFontFamilyDecl}
    display: inline-block !important;
    white-space: pre-wrap !important;
    transition-property: color, -webkit-text-fill-color, transform, text-shadow !important;
    transition-duration: ${lyricSnapMs}ms !important;
    transition-timing-function: linear !important;
    backface-visibility: hidden !important;
}

.slt-replace-line.Active,
.slt-replace-line.active,
.line.Active + .slt-replace-line {
    ${buildProps(activeGrad, `opacity: ${sltActiveOpacity} !important;`, sltGlowActive)}
}

.slt-replace-line.active .slt-replace-word.word-active,
.slt-replace-line.Active .slt-replace-word.word-active {
    ${buildProps(activeGrad, scaleEffect, sltBgGlowDecl || sltKaraokeGlowDecl)}
}

.line.Active + .slt-interleaved-translation:not(.slt-sync-translation),
.slt-interleaved-translation.active:not(.slt-sync-translation),
.slt-interleaved-translation.Active:not(.slt-sync-translation) {
    ${buildProps(
        activeGrad,
        `opacity: ${sltActiveOpacity} !important;`,
        sltGlowActive,
    )}
}

.line.Active + .slt-sync-translation.slt-interleaved-translation,
.slt-sync-translation.slt-interleaved-translation.active {
    ${buildProps(
        activeGrad,
        `opacity: ${sltActiveOpacity} !important;`,
        `background-size: 100% 100% !important;`,
        `background-repeat: no-repeat !important;`,
        `-webkit-box-decoration-break: slice !important;`,
        `box-decoration-break: slice !important;`,
        sltGlowActive || `filter: none !important;`,
    )}
}

.slt-sync-word.slt-word-active {
    ${buildProps(activeGrad, scaleEffect, sltBgGlowDecl || sltKaraokeGlowDecl)}
}

.slt-replace-line.Sung,
.line.Sung + .slt-replace-line {
    ${buildProps(sungGrad, `opacity: ${sltSungOpacity} !important;`)}
}

.slt-replace-word.word-sung {
    ${sungGrad}
}

.line.Sung + .slt-interleaved-translation:not(.slt-sync-translation) {
    ${buildProps(
        sungGrad,
        `opacity: ${sltSungOpacity} !important;`,
    )}
}

.line.Sung + .slt-sync-translation.slt-interleaved-translation {
    ${buildProps(
        sungGrad,
        `opacity: ${sltSungOpacity} !important;`,
        `--gradient-position: 100% !important;`,
        `background-size: 100% 100% !important;`,
        `background-repeat: no-repeat !important;`,
        `-webkit-box-decoration-break: slice !important;`,
        `box-decoration-break: slice !important;`,
    )}
}

.slt-sync-word.slt-word-past {
    ${sungGrad}
}

.slt-replace-line.NotSung,
.line.NotSung + .slt-replace-line {
    ${buildProps(notSungGrad, `opacity: ${sltNotSungOpacity} !important;`)}
}

.slt-replace-word.word-notsung,
.slt-replace-word.word-notsng {
    ${notSungGrad}
}

.line.NotSung + .slt-interleaved-translation:not(.slt-sync-translation) {
    ${buildProps(
        notSungGrad,
        `opacity: ${sltNotSungOpacity} !important;`,
    )}
}

.line.NotSung + .slt-sync-translation.slt-interleaved-translation {
    ${buildProps(
        notSungGrad,
        `opacity: ${sltNotSungOpacity} !important;`,
        `--gradient-position: -20% !important;`,
        `background-size: 100% 100% !important;`,
        `background-repeat: no-repeat !important;`,
        `-webkit-box-decoration-break: slice !important;`,
        `box-decoration-break: slice !important;`,
    )}
}

.slt-sync-word.slt-word-future {
    ${notSungGrad}
}
`);
    }

    css.push(...wordEffectCSS(config, ALL, wordBaseShadow));

    if (config.scaleInEffect) {
        const scaleInTargets = [
            ...ALL.map(b => `${b} .line.Active`),
            '.slt-replace-line.Active',
            '.slt-replace-line.active',
            '.line.Active + .slt-replace-line',
            '.slt-interleaved-translation.Active',
            '.slt-interleaved-translation.active',
            '.line.Active + .slt-interleaved-translation',
        ].join(',\n');
        css.push(`
@keyframes st-line-scale-in {
    from { transform: scale3d(${config.scaleInFrom}, ${config.scaleInFrom}, 1); }
    to { transform: scale3d(${config.scaleActive}, ${config.scaleActive}, 1); }
}
${scaleInTargets} {
    animation: ${[`st-line-scale-in ${config.scaleInDuration}s cubic-bezier(0.16, 1, 0.3, 1) both`, pulseAnim].filter(Boolean).join(', ')} !important;
    will-change: transform${glowPulseOn ? ', filter' : ''} !important;
}
${lineOriginRules([
    ...ALL.map(b => `${b} .line.Active`),
    '.slt-replace-line.Active',
    '.slt-interleaved-translation.Active',
])}
`);
    }

    if (config.glowEnabled) {
        css.push(`
${SIDEBAR.map(b => `${b} .line.Active`).join(',\n')} {
    ${glowSidebar}
}
`);
    }

    const PLAYER = ['#SpicyLyricsPage', '.spicy-pip-wrapper #SpicyLyricsPage'];
    const playerSel = (mod: string, rest: string) => PLAYER.map(p => `${p}${mod} ${rest}`).join(',\n');

    if (config.playerStylingEnabled) {
        const radius = Math.min(Math.max(config.playerArtRadius, 0), 50);
        const barT = Math.min(Math.max(config.playerProgressThickness, 0.5), 5);

        const artTargets = [
            ...PLAYER.map(p => `${p} .ContentBox .NowBar .MediaImageContainer`),
            '.spicy-pip-wrapper #SpicyLyricsPage.CompactMode .ContentBox .NowBar .Header .MediaBox:not(:hover) .MediaImageContainer',
            '.spicy-pip-wrapper #SpicyLyricsPage.CompactMode .ContentBox .NowBar .Header .MediaBox:hover .MediaImageContainer',
        ];
        css.push(`
${artTargets.join(',\n')} {
    border-radius: ${radius}% !important;
    --BorderRadius: ${radius}% !important;
}
`);

        if (barT !== 1) {
            const SKINS = [
                { mod: '.Exp_NewProgressBar', bar: 2.2, header: 1.7, barHover: 3, headerHover: 2.3 },
                { mod: ':not(.Exp_NewProgressBar)', bar: 1.3, header: 1, barHover: 0, headerHover: 0 },
            ];
            const barHeight = (cqh: number) => `height: calc(${cqh}cqh * ${barT}) !important;`;
            const barRules = (mod: string, state: string, bar: number, header: number) => !bar ? '' : `
${playerSel(mod, `.Timeline .SliderBar${state}`)} {
    ${barHeight(bar)}
}
${playerSel(mod, `.Header > .Timeline .SliderBar${state}`)} {
    ${barHeight(header)}
}
`;
            css.push(SKINS.map(s =>
                barRules(s.mod, '', s.bar, s.header) +
                barRules(s.mod, ':is(:hover, .Dragging)', s.barHover, s.headerHover)
            ).join('\n'));
        }

        if (config.playerAccentEnabled) {
            const accent = config.playerAccentColor;
            css.push(`
${playerSel(':not(.Exp_NewProgressBar)', '.Timeline .SliderBar')},
${playerSel(':not(.Exp_NewProgressBar)', '.VolumeControl')} {
    --TraveledColor: ${accent} !important;
}
${playerSel(':not(.Exp_NewProgressBar)', '.Timeline .SliderBar .Handle')},
${playerSel(':not(.Exp_NewProgressBar)', '.VolumeControl .Handle')} {
    background: ${readableOn(accent)} !important;
}
${playerSel('.Exp_NewProgressBar', '.Timeline .SliderBar::before')},
${playerSel('.Exp_NewProgressBar', '.VolumeControl .VolumeFill')} {
    background: ${accent} !important;
}
${playerSel('.Exp_NewProgressBar', '.VolumeControl.IconOnFill .VolumeIcon')} {
    fill: ${readableOn(accent)} !important;
}
`);
        }

        if (config.playerHideShuffle) {
            css.push(`${PLAYER.map(p => `${p} .PlaybackControls .ShuffleToggle`).join(',\n')} {\n    display: none !important;\n}`);
        }
        if (config.playerHideRepeat) {
            css.push(`${PLAYER.map(p => `${p} .PlaybackControls .LoopToggle`).join(',\n')} {\n    display: none !important;\n}`);
        }
        if (config.playerHideLike) {
            css.push(`${PLAYER.map(p => `${p} .NowBar .Heart`).join(',\n')} {\n    display: none !important;\n}`);
        }

        if (config.playerControlsAnimation) {
            const notFs = PLAYER.map(p => `${p}:not(.Fullscreen)`);
            css.push(`
${PLAYER.map(p => `${p} .PlaybackControls .PlaybackControl`).join(',\n')} {
    --ShrinkScale: 0.86;
    --ShrinkDelta: calc(1 - var(--ShrinkScale));
    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.175s ease-out, opacity 0.175s cubic-bezier(0.37, 0, 0.63, 1) !important;
}
${PLAYER.map(p => `${p} .PlaybackControls .PlaybackControl:hover`).join(',\n')} {
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.55)) !important;
}
${notFs.map(p => `${p} .PlaybackControls .PlaybackControl:hover:not(.Pressed)`).join(',\n')} {
    transform: scale(1.18);
}
${notFs.map(p => `${p} .PlaybackControls .PlaybackControl.Pressed`).join(',\n')} {
    transform: scale(var(--ShrinkScale));
}
`);
        }
    }

    if (config.musicVideoEnabled) {
        const mvDim = Math.min(Math.max(config.musicVideoDim, 0), 1);
        css.push(`
#SpicyLyricsPage #${MUSIC_VIDEO_ID} {
    position: absolute !important;
    inset: 0 !important;
    z-index: -1 !important;
    overflow: hidden !important;
    pointer-events: none !important;
    opacity: 0 !important;
    transition: opacity 0.4s ease !important;
}
#SpicyLyricsPage.st-mv-active #${MUSIC_VIDEO_ID} {
    opacity: 1 !important;
}
#SpicyLyricsPage #${MUSIC_VIDEO_ID} video {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    object-position: center !important;
    display: block !important;
    background: transparent !important;
}
#SpicyLyricsPage #${MUSIC_VIDEO_ID} video::-webkit-media-text-track-container {
    display: none !important;
}
#SpicyLyricsPage #${MUSIC_VIDEO_ID} video::cue {
    visibility: hidden !important;
    color: transparent !important;
    background: transparent !important;
}
#SpicyLyricsPage #${MUSIC_VIDEO_ID} iframe {
    position: absolute !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    min-width: calc(100% + max(160px, 24%)) !important;
    min-height: calc(100% + max(160px, 24%)) !important;
    width: auto !important;
    height: auto !important;
    aspect-ratio: 16 / 9 !important;
    border: 0 !important;
    pointer-events: none !important;
}
#SpicyLyricsPage #${MUSIC_VIDEO_ID}::after {
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    background: rgba(0, 0, 0, ${mvDim}) !important;
    pointer-events: none !important;
}
#SpicyLyricsPage.st-mv-active .spicy-dynamic-bg {
    opacity: 0 !important;
    transition: opacity 0.4s ease !important;
}
#SpicyLyricsPage.st-mv-active .LyricsContainer::before,
#SpicyLyricsPage.st-mv-active.CompactMode::before {
    background: transparent !important;
}
`);
        if (!config.musicVideoCompact) {
            const compactScopes = ['CardMode', 'CompactMode'];
            css.push(`
${compactScopes.map(c => `#SpicyLyricsPage.${c} #${MUSIC_VIDEO_ID}`).join(',\n')} {
    display: none !important;
}
${compactScopes.map(c => `#SpicyLyricsPage.${c}.st-mv-active .spicy-dynamic-bg`).join(',\n')} {
    opacity: 1 !important;
}
${compactScopes.flatMap(c => [
    `#SpicyLyricsPage.${c}.st-mv-active .LyricsContainer::before`,
    `#SpicyLyricsPage.${c}.st-mv-active::before`,
]).join(',\n')} {
    background: revert !important;
}
`);
        }
    }

    if (config.eqEnabled) {
        const eqU = (6 * config.eqSize).toFixed(2);
        const beatCalc = (n: number) => `calc(var(--st-eq-beat, 0.5s) * ${(n / config.eqSpeed).toFixed(3)})`;
        const u = (n: number) => `calc(var(--st-eq-u) * ${round(n)})`;
        const styleRule = (style: string, suffix: string, decl: (band: number, i: number) => string) => {
            const meta = eqStyleMeta(style);
            return eqStyleBands(meta ? meta.count : 10)
                .map((band, i) => `.st-eq[data-style="${style}"] i:nth-child(${i + 1})${suffix} { ${decl(band, i)} }`)
                .join('\n');
        };
        const bandVars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const glitchBar = 'scaleY(calc(0.12 + 0.88 * var(--st-eq-amp)))';
        const swayBar = 'scaleY(calc(0.5 + 0.65 * var(--st-eq-amp)))';
        css.push(`
${METADATA_SELECTOR} {
    position: relative;
}
.st-eq {
    --st-eq-u: ${eqU}cqh;
    --st-eq-level: 0;
    --st-eq-pulse: 0;
    --st-eq-phase: 0;
    --st-eq-phase2: 0.5;
${bandVars.map(v => `    --st-eq-b${v}: 0;`).join('\n')}
${bandVars.map(v => `    --st-eq-p${v}: 0;`).join('\n')}
    position: absolute;
    top: 30cqh;
    translate: 0 -50%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${u(0.45)};
    pointer-events: none;
    z-index: 5;
    color: ${config.eqColor};
    opacity: 0.92;
    visibility: hidden;
}
.st-eq-left { left: 2cqw; flex-direction: row-reverse; }
.st-eq-right { right: 2cqw; }
.st-eq i {
    --st-eq-amp: 0;
    display: block;
    background: currentColor;
}
.st-eq.st-eq-paused,
.st-eq.st-eq-paused i {
    animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
    .st-eq,
    .st-eq i {
        animation: none;
    }
}
`);
        const blocks: Record<string, string> = {};
        blocks.equalizer = `
.st-eq[data-style="equalizer"] {
    gap: ${u(0.3)};
}
.st-eq[data-style="equalizer"] i {
    position: relative;
    width: ${u(0.55)};
    height: ${u(3.6)};
    background: none;
}
.st-eq[data-style="equalizer"] i::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: ${u(0.28)};
    background: currentColor;
    will-change: transform;
}
.st-eq[data-style="equalizer"] i::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: max(1px, ${u(0.12)});
    margin-top: ${u(-0.06)};
    border-radius: ${u(0.06)};
    background: currentColor;
    opacity: 0.5;
    will-change: transform;
}
${styleRule('equalizer', '::before', b => `transform: scaleY(calc(0.14 + 0.86 * var(--st-eq-b${b}))); opacity: calc(0.62 + 0.38 * var(--st-eq-b${b}));`)}
${styleRule('equalizer', '::after', b => `transform: translateY(calc(var(--st-eq-u) * -1.74 * var(--st-eq-p${b})));`)}

`;
        blocks.dotwave = `
.st-eq[data-style="dotwave"] {
    gap: ${u(0.28)};
}
.st-eq[data-style="dotwave"] i {
    width: ${u(0.55)};
    height: ${u(0.55)};
    border-radius: 50%;
    will-change: transform, opacity;
}
${styleRule('dotwave', '', b => `transform: translateY(calc(var(--st-eq-u) * (0.45 - 1.35 * var(--st-eq-b${b})))) scale(calc(0.72 + 0.5 * var(--st-eq-b${b}))); opacity: calc(0.42 + 0.58 * var(--st-eq-b${b}));`)}

`;
        blocks.waveform = `
.st-eq[data-style="waveform"] {
    gap: ${u(0.32)};
}
.st-eq[data-style="waveform"] i {
    position: relative;
    width: ${u(0.4)};
    height: ${u(3.4)};
    background: none;
}
.st-eq[data-style="waveform"] i::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: ${u(0.2)};
    background: currentColor;
    will-change: transform;
}
.st-eq[data-style="waveform"] i::after {
    content: '';
    position: absolute;
    left: ${u(-0.05)};
    right: ${u(-0.05)};
    top: 50%;
    height: max(1px, ${u(0.1)});
    margin-top: ${u(-0.05)};
    border-radius: ${u(0.05)};
    background: currentColor;
    opacity: 0.42;
    will-change: transform, box-shadow;
}
${styleRule('waveform', '::before', b => `transform: scaleY(calc(0.05 + 0.95 * var(--st-eq-b${b})));`)}
${styleRule('waveform', '::after', b => `transform: translateY(calc(var(--st-eq-u) * -1.7 * var(--st-eq-p${b}))); box-shadow: 0 calc(var(--st-eq-u) * 3.4 * var(--st-eq-p${b})) 0 0 currentColor;`)}

`;
        blocks.ladder = `
.st-eq[data-style="ladder"] {
    flex-direction: column-reverse;
    gap: ${u(0.1)};
    transform: scaleY(calc(1 + 0.05 * var(--st-eq-pulse)));
}
.st-eq[data-style="ladder"] i {
    width: ${u(1.6)};
    height: ${u(0.22)};
    border-radius: ${u(0.07)};
    will-change: transform, opacity;
}
${styleRule('ladder', '', (b, i) => {
    const t = round((i + 0.4) / 12, 4);
    const lit = `(var(--st-eq-level) - ${t}) * 9`;
    return `opacity: clamp(0.12, calc(${lit}), 1); transform: scaleX(clamp(0.6, calc(0.6 + ${lit}), 1));`;
})}

`;
        blocks.bounce = `
.st-eq[data-style="bounce"] {
    gap: ${u(0.42)};
}
.st-eq[data-style="bounce"] i {
    width: ${u(0.7)};
    height: ${u(0.7)};
    border-radius: 50%;
    transform-origin: 50% 100%;
    animation: st-eq-bounce ${beatCalc(1)} cubic-bezier(0.3, 0, 0.25, 1) infinite;
    will-change: transform;
}
${styleRule('bounce', '', (b, i) => `--st-eq-amp: var(--st-eq-b${b}); animation-delay: ${beatCalc(-0.14 * i)}; opacity: calc(0.55 + 0.45 * var(--st-eq-b${b}));`)}
@keyframes st-eq-bounce {
    0% { transform: translateY(0) scale(1.16, 0.82); }
    38% { transform: translateY(calc(var(--st-eq-u) * -1 * (0.3 + 1.5 * var(--st-eq-amp)))) scale(0.9, 1.12); }
    74% { transform: translateY(0) scale(1.12, 0.86); }
    100% { transform: translateY(0) scale(1, 1); }
}

`;
        blocks.glitch = `
.st-eq[data-style="glitch"] {
    gap: ${u(0.32)};
}
.st-eq[data-style="glitch"] i {
    width: ${u(0.5)};
    height: ${u(3.4)};
    border-radius: ${u(0.07)};
    animation: st-eq-glitch ${beatCalc(2)} steps(1, end) infinite;
    will-change: transform, opacity;
}
${styleRule('glitch', '', (b, i) => `--st-eq-amp: var(--st-eq-b${b}); animation-delay: ${beatCalc(-0.21 * i)};`)}
@keyframes st-eq-glitch {
    0%, 100% { transform: translate(0, 0) ${glitchBar}; opacity: 1; }
    16% { transform: translate(${u(0.3)}, ${u(-0.16)}) ${glitchBar}; opacity: 0.5; }
    28% { transform: translate(${u(-0.34)}, ${u(0.12)}) ${glitchBar}; opacity: 1; }
    42% { transform: translate(${u(0.18)}, 0) ${glitchBar}; opacity: 0.78; }
    56% { transform: translate(${u(-0.1)}, ${u(-0.06)}) ${glitchBar}; opacity: 1; }
    70% { transform: translate(0, 0) ${glitchBar}; opacity: 0.88; }
}

`;
        blocks.pulsedot = `
.st-eq[data-style="pulsedot"] {
    width: ${u(3.4)};
    height: ${u(3.4)};
}
.st-eq[data-style="pulsedot"] i:first-child {
    position: absolute;
    top: 50%;
    left: 50%;
    width: ${u(1.1)};
    height: ${u(1.1)};
    margin: ${u(-0.55)} 0 0 ${u(-0.55)};
    border-radius: 50%;
    transform: scale(calc(0.5 + 0.5 * var(--st-eq-b1) + 0.35 * var(--st-eq-pulse)));
    will-change: transform;
}
.st-eq[data-style="pulsedot"] i:nth-child(n+2) {
    position: absolute;
    inset: 0;
    background: transparent;
    border: ${u(0.16)} solid currentColor;
    border-radius: 50%;
    will-change: transform, opacity;
}
.st-eq[data-style="pulsedot"] i:nth-child(2) {
    transform: scale(calc(0.32 + 0.68 * var(--st-eq-phase)));
    opacity: calc((1 - var(--st-eq-phase)) * (0.3 + 0.7 * var(--st-eq-level)));
}
.st-eq[data-style="pulsedot"] i:nth-child(3) {
    transform: scale(calc(0.32 + 0.68 * var(--st-eq-phase2)));
    opacity: calc((1 - var(--st-eq-phase2)) * (0.2 + 0.5 * var(--st-eq-level)));
}

`;
        blocks.signal = `
.st-eq[data-style="signal"] {
    gap: ${u(0.26)};
}
.st-eq[data-style="signal"] i {
    width: ${u(0.34)};
    height: ${u(0.9)};
    border-radius: ${u(0.17)};
    will-change: transform, opacity;
}
${styleRule('signal', '', b => `transform: translateY(calc(var(--st-eq-u) * (0.7 - 1.4 * var(--st-eq-b${b})))) scaleY(calc(0.7 + 0.9 * var(--st-eq-b${b}))); opacity: calc(0.45 + 0.55 * var(--st-eq-b${b}));`)}

`;
        blocks.breathe = `
.st-eq[data-style="breathe"] {
    width: ${u(3.8)};
    height: ${u(3.8)};
}
.st-eq[data-style="breathe"] i {
    position: absolute;
    top: 50%;
    left: 50%;
    border-radius: 50%;
    will-change: transform, opacity;
}
.st-eq[data-style="breathe"] i:nth-child(1) {
    width: ${u(1)};
    height: ${u(1)};
    margin: ${u(-0.5)} 0 0 ${u(-0.5)};
    transform: scale(calc(0.68 + 0.55 * var(--st-eq-level)));
    opacity: calc(0.7 + 0.3 * var(--st-eq-level));
}
.st-eq[data-style="breathe"] i:nth-child(2) {
    width: ${u(2)};
    height: ${u(2)};
    margin: ${u(-1)} 0 0 ${u(-1)};
    filter: blur(${u(0.22)});
    transform: scale(calc(0.7 + 0.5 * var(--st-eq-level)));
    opacity: calc(0.16 + 0.3 * var(--st-eq-level));
}
.st-eq[data-style="breathe"] i:nth-child(3) {
    width: ${u(3.4)};
    height: ${u(3.4)};
    margin: ${u(-1.7)} 0 0 ${u(-1.7)};
    filter: blur(${u(0.45)});
    transform: scale(calc(0.7 + 0.4 * var(--st-eq-level)));
    opacity: calc(0.06 + 0.14 * var(--st-eq-level) + 0.16 * var(--st-eq-pulse));
}

`;
        blocks.sway = `
.st-eq[data-style="sway"] {
    gap: ${u(0.5)};
}
.st-eq[data-style="sway"] i {
    width: ${u(0.3)};
    height: ${u(2.2)};
    border-radius: ${u(0.15)};
    transform-origin: 50% 100%;
    animation: st-eq-sway ${beatCalc(4)} ease-in-out infinite;
    will-change: transform;
}
${styleRule('sway', '', (b, i) => `--st-eq-amp: var(--st-eq-b${b}); animation-delay: ${beatCalc(-0.3 * i)}; opacity: calc(0.5 + 0.5 * var(--st-eq-b${b}));`)}
@keyframes st-eq-sway {
    0%, 100% { transform: rotate(calc(-13deg * (0.25 + 0.75 * var(--st-eq-level)))) ${swayBar}; }
    50% { transform: rotate(calc(13deg * (0.25 + 0.75 * var(--st-eq-level)))) ${swayBar}; }
}

`;
        blocks.orbit = `
.st-eq[data-style="orbit"] {
    width: ${u(4)};
    height: ${u(4)};
    transform: scale(calc(0.7 + 0.5 * var(--st-eq-level)));
    will-change: transform;
}
.st-eq[data-style="orbit"] i {
    position: absolute;
    top: 50%;
    left: 50%;
    width: ${u(0.7)};
    height: ${u(0.7)};
    margin: ${u(-0.35)} 0 0 ${u(-0.35)};
    border-radius: 50%;
    animation: st-eq-orbit ${beatCalc(4)} linear infinite;
    will-change: transform, scale;
}
${[0, 1, 2].map(i => `.st-eq[data-style="orbit"] i:nth-child(${i + 1}) { animation-delay: ${beatCalc(-i * 4 / 3)}; scale: calc(0.55 + 0.85 * var(--st-eq-b${[1, 5, 10][i]})); opacity: calc(0.5 + 0.5 * var(--st-eq-b${[1, 5, 10][i]})); }`).join('\n')}
.st-eq[data-style="orbit"] i:nth-child(4) {
    width: ${u(0.9)};
    height: ${u(0.9)};
    margin: ${u(-0.45)} 0 0 ${u(-0.45)};
    animation: none;
    scale: calc(0.6 + 0.9 * var(--st-eq-b1));
}
@keyframes st-eq-orbit {
    from { transform: rotate(0deg) translateX(calc(var(--st-eq-u) * (1.15 + 0.5 * var(--st-eq-level)))); }
    to { transform: rotate(360deg) translateX(calc(var(--st-eq-u) * (1.15 + 0.5 * var(--st-eq-level)))); }
}

`;
        blocks.spectrumring = `
.st-eq[data-style="spectrumring"] {
    width: ${u(5.2)};
    height: ${u(5.2)};
    animation: st-eq-slow-spin ${beatCalc(16)} linear infinite;
}
.st-eq[data-style="spectrumring"] i {
    position: absolute;
    top: 50%;
    left: 50%;
    width: ${u(0.24)};
    height: ${u(1.05)};
    margin: ${u(-1.05)} 0 0 ${u(-0.12)};
    border-radius: ${u(0.12)};
    transform-origin: 50% 100%;
    will-change: transform, opacity;
}
${styleRule('spectrumring', '', (b, i) => `transform: rotate(${round(i * 18)}deg) translateY(${u(-1.1)}) scaleY(calc(0.22 + 1.2 * var(--st-eq-b${b}))); opacity: calc(0.4 + 0.6 * var(--st-eq-b${b}));`)}
@keyframes st-eq-slow-spin {
    from { rotate: 0deg; }
    to { rotate: 360deg; }
}

`;
        blocks.helix = `
.st-eq[data-style="helix"] {
    gap: ${u(0.38)};
    perspective: ${u(9)};
}
.st-eq[data-style="helix"] i {
    width: ${u(0.5)};
    height: ${u(2.6)};
    border-radius: ${u(0.1)};
    animation: st-eq-helix ${beatCalc(4)} linear infinite;
    will-change: transform, opacity;
}
${styleRule('helix', '', (b, i) => `--st-eq-amp: var(--st-eq-b${b}); animation-delay: ${beatCalc(-0.5 * i)}; opacity: calc(0.45 + 0.55 * var(--st-eq-b${b}));`)}
@keyframes st-eq-helix {
    from { transform: rotateY(0deg) scaleY(calc(0.3 + 0.9 * var(--st-eq-amp))); }
    to { transform: rotateY(360deg) scaleY(calc(0.3 + 0.9 * var(--st-eq-amp))); }
}
`;
        css.push(blocks[config.eqStyle] || blocks.equalizer);
    }

    return css.join('\n');
}

function getPIPWindow(): Window | null {
    try {
        const docPiP = (window as any).documentPictureInPicture;
        if (docPiP && docPiP.window) return docPiP.window;
    } catch (e) {}
    return null;
}

function injectIntoPIPDocument(css: string): void {
    const pipWindow = getPIPWindow();
    if (!pipWindow) return;
    const pipDoc = pipWindow.document;
    const old = pipDoc.getElementById(STYLE_ID);
    if (old) old.remove();

    const style = pipDoc.createElement('style');
    style.id = STYLE_ID;
    pipDoc.head.appendChild(style);
    style.textContent = css;
}

function updateEqualizerIn(doc: Document): void {
    const config = themeState.activeTheme;
    const enabled = themeState.isEnabled && config.eqEnabled;
    const existing = Array.from(doc.querySelectorAll<HTMLElement>('.st-eq'));

    const metadata = doc.querySelector(METADATA_SELECTOR);
    if (!enabled || !metadata) {
        existing.forEach(el => el.remove());
        return;
    }

    const sides = config.eqPosition === 'both' ? ['left', 'right'] : [config.eqPosition];
    const count = eqStyleMeta(config.eqStyle)?.count ?? 10;
    existing.forEach(el => {
        const side = el.classList.contains('st-eq-left') ? 'left' : 'right';
        if (!sides.includes(side) || el.parentElement !== metadata || el.getAttribute('data-style') !== config.eqStyle || el.children.length !== count) {
            el.remove();
        }
    });

    sides.forEach(side => {
        if (metadata.querySelector(`.st-eq-${side}`)) return;
        const eq = doc.createElement('div');
        eq.className = `st-eq st-eq-${side}`;
        eq.setAttribute('data-style', config.eqStyle);
        for (let i = 0; i < count; i++) {
            eq.appendChild(doc.createElement('i'));
        }
        metadata.appendChild(eq);
    });
}

export function updateEqualizer(): void {
    try {
        updateEqualizerIn(document);
        const pipWindow = getPIPWindow();
        if (pipWindow) updateEqualizerIn(pipWindow.document);
        refreshEqElements();
        if (themeState.isEnabled && themeState.activeTheme.eqEnabled) {
            startEqAudio();
        } else {
            stopEqAudio();
        }
    } catch (e) {}
}

function removeEqualizer(): void {
    stopEqAudio();
    document.querySelectorAll('.st-eq').forEach(el => el.remove());
    const pipWindow = getPIPWindow();
    if (pipWindow) pipWindow.document.querySelectorAll('.st-eq').forEach(el => el.remove());
}

export function updateMusicVideo(): void {
    try {
        if (themeState.isEnabled && themeState.activeTheme.musicVideoEnabled) {
            setMusicVideoCompactAllowed(themeState.activeTheme.musicVideoCompact);
            startMusicVideo();
            refreshMusicVideoLayer();
        } else {
            stopMusicVideo();
        }
    } catch (e) {}
}

function removeMusicVideo(): void {
    stopMusicVideo();
}

const WORD_TAG_CLASSES = ['st-sung-word', 'st-word-live'];
const NOT_STARTED = -19.5;
const FINISHED = 99;

let wordTagFrame: number | null = null;
let wordTagSung = false;
let wordTagLive = false;
const activeLineCache = new Map<Document, HTMLElement[]>();

function gradientPos(el: HTMLElement): number {
    const raw = el.style.getPropertyValue('--gradient-position')
        || el.style.getPropertyValue('--SLM_GradientPosition');
    const v = parseFloat(raw);
    return Number.isNaN(v) ? Number.NEGATIVE_INFINITY : v;
}

function clearWordTags(root: ParentNode, classes: string[] = WORD_TAG_CLASSES): void {
    root.querySelectorAll(classes.map(c => `.${c}`).join(',')).forEach(el => {
        el.classList.remove(...classes);
    });
}

function clearLiveTags(): void {
    try {
        clearWordTags(document, ['st-word-live']);
        const pipWindow = getPIPWindow();
        if (pipWindow) clearWordTags(pipWindow.document, ['st-word-live']);
    } catch (e) {}
}

function tagWordsIn(doc: Document): void {
    const active = Array.from(doc.querySelectorAll<HTMLElement>('#SpicyLyricsPage .line.Active'));
    const previous = activeLineCache.get(doc) || [];

    previous.forEach(line => {
        if (!active.includes(line)) clearWordTags(line);
    });
    activeLineCache.set(doc, active);

    active.forEach(line => {
        line.querySelectorAll<HTMLElement>('.word, .letterGroup').forEach(el => {
            const isGroup = el.classList.contains('letterGroup');

            if (wordTagLive && !el.classList.contains('st-word-live')) {
                const head = isGroup ? (el.querySelector<HTMLElement>('.letter') || el) : el;
                if (gradientPos(head) > NOT_STARTED) el.classList.add('st-word-live');
            }

            if (wordTagSung) {
                const tail = isGroup ? (el.querySelector<HTMLElement>('.letter:last-child') || el) : el;
                const sung = gradientPos(tail) >= FINISHED;
                if (el.classList.contains('st-sung-word') !== sung) {
                    el.classList.toggle('st-sung-word', sung);
                }
            }
        });
    });
}

function tagWords(): void {
    try {
        tagWordsIn(document);
        const pipWindow = getPIPWindow();
        if (pipWindow) tagWordsIn(pipWindow.document);
    } catch (e) {}
}

function wordTagLoop(): void {
    tagWords();
    wordTagFrame = requestAnimationFrame(wordTagLoop);
}

function startWordTagger(sung: boolean, live: boolean): void {
    wordTagSung = sung;
    wordTagLive = live;
    if (wordTagFrame !== null) return;
    wordTagFrame = requestAnimationFrame(wordTagLoop);
}

export function stopSungWordTagger(): void {
    if (wordTagFrame !== null) {
        cancelAnimationFrame(wordTagFrame);
        wordTagFrame = null;
    }
    wordTagSung = false;
    wordTagLive = false;
    activeLineCache.clear();
    clearWordTags(document);
    const pipWindow = getPIPWindow();
    if (pipWindow) clearWordTags(pipWindow.document);
}

type BlurPreviewWatch = { target: Element; observer: MutationObserver };
const blurPreviewWatches = new Map<Document, BlurPreviewWatch>();
let blurPreviewScheduled = false;

function refreshBlurPreviewIn(doc: Document, n: number): void {
    doc.querySelectorAll('#SpicyLyricsPage [data-index].st-preview-line')
        .forEach(el => el.classList.remove('st-preview-line'));

    if (n <= 0) return;

    const active = doc.querySelector('#SpicyLyricsPage .line.Active');
    const activeWrapper = active?.closest('[data-index]') as HTMLElement | null;
    const container = activeWrapper?.parentElement;
    if (!activeWrapper || !container) return;
    const activeIdx = parseInt(activeWrapper.getAttribute('data-index') || '', 10);
    if (Number.isNaN(activeIdx)) return;

    for (let k = 1; k <= n; k++) {
        const w = container.querySelector(`[data-index="${activeIdx + k}"]`) as HTMLElement | null;
        if (w) w.classList.add('st-preview-line');
    }
}

export function refreshBlurPreview(): void {
    blurPreviewScheduled = false;
    const enabled = themeState.isEnabled && themeState.activeTheme.blurUnsung;
    const n = enabled ? Math.max(0, Math.round(themeState.activeTheme.blurPreviewLines)) : 0;
    try {
        refreshBlurPreviewIn(document, n);
        const pipWindow = getPIPWindow();
        if (pipWindow) refreshBlurPreviewIn(pipWindow.document, n);
    } catch (e) {}
}

function scheduleBlurPreview(): void {
    if (blurPreviewScheduled) return;
    blurPreviewScheduled = true;
    requestAnimationFrame(refreshBlurPreview);
}

function watchBlurPreviewIn(doc: Document): void {
    const target = doc.querySelector('#SpicyLyricsPage');
    const existing = blurPreviewWatches.get(doc);
    if (existing) {
        if (existing.target === target && target?.isConnected) return;
        existing.observer.disconnect();
        blurPreviewWatches.delete(doc);
    }
    if (!target) return;

    const observer = new MutationObserver((muts) => {
        for (const m of muts) {
            const t = m.target as HTMLElement;
            if (t.classList && t.classList.contains('line')) {
                scheduleBlurPreview();
                return;
            }
        }
    });
    observer.observe(target, { attributes: true, attributeFilter: ['class'], subtree: true });
    blurPreviewWatches.set(doc, { target, observer });
}

export function startBlurPreviewObserver(): void {
    try {
        blurPreviewWatches.forEach((watch, doc) => {
            if (doc !== document && !doc.defaultView) {
                watch.observer.disconnect();
                blurPreviewWatches.delete(doc);
            }
        });
        watchBlurPreviewIn(document);
        const pipWindow = getPIPWindow();
        if (pipWindow) watchBlurPreviewIn(pipWindow.document);
    } catch (e) {}
    scheduleBlurPreview();
}

export function stopBlurPreviewObserver(): void {
    blurPreviewWatches.forEach(w => w.observer.disconnect());
    blurPreviewWatches.clear();
}

export function injectThemeStyles(): void {
    if (!themeState.isEnabled) {
        removeThemeStyles();
        return;
    }

    const css = generateThemeCSS(themeState.activeTheme);

    const old = document.getElementById(STYLE_ID);
    if (old) old.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
    style.textContent = css;

    injectIntoPIPDocument(css);

    updateEqualizer();
    updateMusicVideo();
    const needSung = themeState.activeTheme.blurSungWords;
    const needLive = wordEffectTrigger(themeState.activeTheme) === 'word';
    if (needSung || needLive) {
        if (!needLive) clearLiveTags();
        startWordTagger(needSung, needLive);
    } else {
        stopSungWordTagger();
    }
    scheduleBlurPreview();
}

export function removeThemeStyles(): void {
    const style = document.getElementById(STYLE_ID);
    if (style) {
        style.remove();
    }

    const pipWindow = getPIPWindow();
    if (pipWindow) {
        const pipStyle = pipWindow.document.getElementById(STYLE_ID);
        if (pipStyle) pipStyle.remove();
    }

    removeEqualizer();
    removeMusicVideo();
    stopSungWordTagger();
}

export function injectBaseStyles(): void {
    if (document.getElementById(BASE_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = BASE_STYLE_ID;
    style.textContent = BASE_STYLES;
    document.head.appendChild(style);
}

const BASE_STYLES = `
.spicy-themes-settings {
    position: relative;
    z-index: 1;
    width: 100%;
    box-sizing: border-box;
}

.spicy-themes-settings.st-standalone {
    max-width: 780px;
    margin: 0 auto;
    padding: 0 16px 24px;
}

.spicy-themes-settings .x-settings-section {
    width: 100%;
}

.spicy-themes-settings .x-settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    padding: 6px 0;
    box-sizing: border-box;
}

.spicy-themes-settings .x-settings-firstColumn {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
}

.spicy-themes-settings .x-settings-secondColumn {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex: 0 0 auto;
}

.spicy-themes-settings .st-color-swatch {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    padding: 0;
    appearance: none;
    -webkit-appearance: none;
    background: none;
    outline: none;
}

.spicy-themes-settings .st-color-swatch::-webkit-color-swatch-wrapper {
    padding: 0;
}

.spicy-themes-settings .st-color-swatch::-webkit-color-swatch {
    border: none;
    border-radius: 50%;
}

.spicy-themes-settings .st-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 120px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.2);
    outline: none;
    cursor: pointer;
}

.spicy-themes-settings .st-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--spice-button-active, #1db954);
    cursor: pointer;
}

.spicy-themes-settings .st-preset-card {
    display: inline-block;
    padding: 8px 16px;
    margin: 4px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.07);
    color: var(--spice-text, #fff);
    cursor: pointer;
    transition: background 0.2s, transform 0.15s;
    border: 1px solid transparent;
    font-size: 13px;
}

.spicy-themes-settings .st-preset-card:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: scale(1.03);
}

.spicy-themes-settings .st-preset-card.active {
    border-color: var(--spice-button-active, #1db954);
    background: rgba(29, 185, 84, 0.15);
}

.spicy-themes-settings .st-preset-card .st-preset-delete {
    margin-left: 8px;
    opacity: 0.5;
    cursor: pointer;
    font-size: 11px;
}

.spicy-themes-settings .st-preset-card .st-preset-delete:hover {
    opacity: 1;
    color: #e74c3c;
}

.spicy-themes-settings .st-section-header {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--spice-subtext, #b3b3b3);
    margin: 16px 0 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.spicy-themes-settings .st-value-display {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 11px;
    color: var(--spice-subtext, #b3b3b3);
    min-width: 40px;
    text-align: right;
}

.spicy-themes-settings .st-inline-group {
    display: flex;
    align-items: center;
    gap: 8px;
}

.spicy-themes-settings .st-coming-soon {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--spice-button-active, #1db954);
    background: rgba(29, 185, 84, 0.12);
    padding: 3px 8px;
    border-radius: 999px;
    white-space: nowrap;
}

#ThemeToggle.active svg {
    color: var(--spice-button-active, #1db954);
}

.st-ci-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 20px;
    background: transparent;
    cursor: pointer;
    transition: background 0.25s ease;
    overflow: visible;
    white-space: nowrap;
}

.st-ci-button:hover {
    background: rgba(255, 255, 255, 0.07);
}

.st-ci-dot {
    width: 8px;
    height: 8px;
    min-width: 8px;
    border-radius: 50%;
    background: #555;
    transition: background 0.3s ease, box-shadow 0.3s ease;
    flex-shrink: 0;
}

.st-ci-dot.st-ci-connected {
    background: #1db954;
    box-shadow: 0 0 6px rgba(29, 185, 84, 0.4);
}

.st-ci-expanded {
    display: flex;
    align-items: center;
    white-space: nowrap;
}

.st-ci-stats-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 0.65rem;
    color: var(--spice-subtext, #b3b3b3);
}

.st-ci-stats-row .slt-ci-users-count.slt-ci-active .st-ci-active-count {
    color: #1db954;
    font-weight: 600;
}

.st-modal-root {
    --st-accent: #1db954;
    --st-accent-soft: rgba(29, 185, 84, 0.12);
    --st-bg: #121214;
    --st-bg-elev: rgba(255, 255, 255, 0.04);
    --st-border: rgba(255, 255, 255, 0.08);
    --st-text: var(--spice-text, #fff);
    --st-text-dim: var(--spice-subtext, #b3b3b3);
    --st-radius: 8px;
    --st-radius-sm: 6px;
    width: min(980px, calc(100vw - 48px));
    max-width: 100%;
    max-height: min(78vh, 760px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
    padding: 14px;
    color: var(--st-text);
    font-size: 13px;
    line-height: 1.35;
    animation: st-modal-in 0.34s cubic-bezier(0.16, 1, 0.3, 1);
}

.st-modal-root *,
.st-modal-root *::before,
.st-modal-root *::after {
    box-sizing: border-box;
}

.st-modal-root .st-m-header {
    flex: 0 0 auto;
}

.st-modal-root .st-m-enabled-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--st-bg-elev);
    border: 1px solid var(--st-border);
    border-radius: var(--st-radius);
    margin-bottom: 10px;
    transition: background 0.24s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-enabled-bar:not(.st-m-enabled-off) {
    border-color: rgba(29, 185, 84, 0.32);
    background: linear-gradient(90deg, var(--st-accent-soft), var(--st-bg-elev) 55%);
}
.st-modal-root .st-m-enabled-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.st-modal-root .st-m-enabled-title {
    font-weight: 700;
    font-size: 13px;
}
.st-modal-root .st-m-enabled-sub {
    font-size: 11px;
    color: var(--st-text-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.st-modal-root .st-m-enabled-reset {
    flex-shrink: 0;
    min-height: 28px;
    padding: 5px 10px;
    font-size: 11px;
}

.st-modal-root .st-m-toggle {
    position: relative;
    width: 38px;
    height: 22px;
    flex-shrink: 0;
    display: inline-block;
}
.st-modal-root .st-m-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
}
.st-modal-root .st-m-toggle-slider {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.18);
    border-radius: 22px;
    cursor: pointer;
    transition: background 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-toggle-slider::before {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    left: 3px;
    top: 3px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-toggle input:checked + .st-m-toggle-slider {
    background: var(--st-accent);
}
.st-modal-root .st-m-toggle input:checked + .st-m-toggle-slider::before {
    transform: translateX(16px);
}

.st-modal-root .st-prv-line {
    font-size: calc(18px * var(--st-prv-scale, 1));
    font-weight: 800;
    line-height: 1.4;
    transition: color 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), filter 0.28s cubic-bezier(0.16, 1, 0.3, 1), text-shadow 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    transform-origin: left center;
}

.st-modal-root .st-m-tabbar {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--st-border);
    margin-bottom: 12px;
    overflow-x: auto;
    scrollbar-width: none;
}
.st-modal-root .st-m-tabbar::-webkit-scrollbar { display: none; }
.st-modal-root .st-m-tab {
    background: transparent;
    border: none;
    color: var(--st-text-dim);
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    white-space: nowrap;
}
.st-modal-root .st-m-tab:hover {
    color: var(--st-text);
    background: rgba(255, 255, 255, 0.04);
}
.st-modal-root .st-m-tab.active {
    color: var(--st-text);
    border-bottom-color: var(--st-accent);
}

.st-modal-root .st-m-tab-host {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;
}

.st-modal-root .st-m-tab-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: st-tab-in 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.st-modal-root .st-m-cz {
    gap: 0;
}
.st-modal-root .st-m-cz-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    margin-bottom: 14px;
    border: 1px solid var(--st-border);
    border-radius: var(--st-radius);
    background: rgba(255, 255, 255, 0.03);
    transition: border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-cz-toolbar:focus-within {
    border-color: var(--st-accent);
}
.st-modal-root .st-m-cz-search-icon {
    display: flex;
    align-items: center;
    color: var(--st-text-dim);
    flex-shrink: 0;
    line-height: 0;
}
.st-modal-root .st-m-cz-search {
    flex: 1;
    border: none !important;
    background: transparent !important;
    padding: 2px 0 !important;
    font-size: 13px;
}
.st-modal-root .st-m-cz-search:focus {
    outline: none;
}

.st-modal-root .st-m-cz-body {
    display: grid;
    grid-template-columns: 186px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
}
.st-modal-root .st-m-cz-rail {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-self: start;
    min-width: 0;
}
.st-modal-root .st-m-cz-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-cz-nav.st-m-cz-nav-muted {
    opacity: 0.4;
}
.st-modal-root .st-m-cz-nav-item {
    display: flex;
    align-items: center;
    gap: 9px;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--st-text-dim);
    padding: 8px 11px;
    border-radius: var(--st-radius-sm);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.18s cubic-bezier(0.16, 1, 0.3, 1), color 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-cz-nav-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.06);
    font-size: 11px;
    line-height: 1;
    transition: background 0.18s cubic-bezier(0.16, 1, 0.3, 1), color 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-cz-nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--st-text);
}
.st-modal-root .st-m-cz-nav-item.active {
    background: var(--st-accent-soft);
    color: var(--st-accent);
}
.st-modal-root .st-m-cz-nav-item.active .st-m-cz-nav-icon {
    background: var(--st-accent);
    color: #000;
}

.st-modal-root .st-m-cz-clear {
    background: transparent;
    border: none;
    color: var(--st-text-dim);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 6px;
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.18s cubic-bezier(0.16, 1, 0.3, 1), background 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-cz-clear:hover {
    color: var(--st-text);
    background: rgba(255, 255, 255, 0.08);
}

.st-modal-root .st-m-cz-status {
    font-size: 12px;
    color: var(--st-text-dim);
    padding: 0 2px 10px;
}
.st-modal-root .st-m-cz-status-empty {
    color: var(--st-text);
}

.st-modal-root .st-m-cz-sections {
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-width: 0;
}
.st-modal-root .st-m-cz-category {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: st-tab-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-cz-cat-head {
    padding-bottom: 9px;
    border-bottom: 1px solid var(--st-border);
}
.st-modal-root .st-m-cz-cat-title {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.01em;
    color: var(--st-text);
}

.st-modal-root .st-m-cz-cat-desc {
    font-size: 12px;
    line-height: 1.45;
    color: var(--st-text-dim);
    margin-top: 3px;
}

.st-modal-root .st-m-section {
    background: var(--st-bg-elev);
    border: 1px solid var(--st-border);
    border-radius: var(--st-radius);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    container-type: inline-size;
    transition: border-color 0.24s cubic-bezier(0.16, 1, 0.3, 1), background 0.24s cubic-bezier(0.16, 1, 0.3, 1), transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-section:hover {
    border-color: rgba(255, 255, 255, 0.16);
    transform: translateY(-1px);
}
.st-modal-root .st-m-section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--st-text-dim);
    margin-bottom: 2px;
}

.st-modal-root .st-m-field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 38px;
    padding: 6px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-section-title + .st-m-field {
    border-top: none;
    padding-top: 2px;
}
.st-modal-root .st-m-field-labelbox {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.st-modal-root .st-m-field-label {
    min-width: 0;
    font-size: 13px;
    color: var(--st-text);
    overflow-wrap: normal;
    line-height: 1.3;
}
.st-modal-root .st-m-field-hint {
    font-size: 11.5px;
    line-height: 1.4;
    color: var(--st-text-dim);
    max-width: 46ch;
}
.st-modal-root .st-m-field-control {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;
    min-width: 0;
    width: 100%;
}

.st-modal-root .st-m-field-reset {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex: 0 0 22px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--st-text-dim);
    cursor: pointer;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), background 0.18s cubic-bezier(0.16, 1, 0.3, 1), color 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-field-reset-on {
    visibility: visible;
    opacity: 0.45;
}
.st-modal-root .st-m-field-reset-on:hover,
.st-modal-root .st-m-field-reset-on:focus-visible {
    opacity: 1;
    color: var(--st-text);
    background: rgba(255, 255, 255, 0.1);
}

.st-modal-root .st-m-subgroup {
    display: flex;
    flex-direction: column;
    margin: 2px 0 4px 10px;
    padding-left: 12px;
    border-left: 2px solid var(--st-accent-soft);
}
.st-modal-root .st-m-subgroup .st-m-field {
    min-height: 34px;
    padding: 4px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.03);
}
.st-modal-root .st-m-subgroup > .st-m-field:first-child {
    border-top: none;
}
.st-modal-root .st-m-subgroup .st-m-field-label {
    font-size: 12.5px;
    color: var(--st-text-dim);
}
.st-modal-root .st-m-subgroup .st-m-subgroup {
    border-left-color: rgba(255, 255, 255, 0.07);
}

.st-modal-root .st-m-field-color,
.st-modal-root .st-m-field-toggle {
    grid-template-columns: minmax(0, 1fr) max-content;
}

.st-modal-root .st-m-field-coming-soon {
    grid-template-columns: minmax(0, 1fr) max-content;
}
.st-modal-root .st-m-field-coming-soon .st-m-field-label {
    opacity: 0.5;
}
.st-modal-root .st-m-coming-soon {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--st-accent);
    background: var(--st-accent-soft);
    padding: 3px 8px;
    border-radius: 999px;
    white-space: nowrap;
}

.st-modal-root .st-m-field-slider {
    grid-template-columns: minmax(0, 1fr) minmax(170px, 300px);
}

.st-modal-root .st-m-field-dropdown,
.st-modal-root .st-m-field-text {
    grid-template-columns: minmax(0, 1fr) minmax(170px, 300px);
}

.st-modal-root .st-m-field-text {
    grid-template-columns: 1fr;
    gap: 6px;
    align-items: stretch;
}
.st-modal-root .st-m-field-text .st-m-field-control {
    max-width: 440px;
}

@container (max-width: 440px) {
    .st-modal-root .st-m-field-slider,
    .st-modal-root .st-m-field-dropdown,
    .st-modal-root .st-m-field-text {
        grid-template-columns: 1fr;
        align-items: start;
        gap: 6px;
    }
    .st-modal-root .st-m-field-slider .st-m-field-control,
    .st-modal-root .st-m-field-dropdown .st-m-field-control,
    .st-modal-root .st-m-field-text .st-m-field-control {
        width: 100%;
        max-width: 100%;
        justify-content: stretch;
    }
}

.st-modal-root .st-m-color {
    width: 28px;
    height: 28px;
    border: 2px solid rgba(255, 255, 255, 0.18);
    border-radius: var(--st-radius-sm);
    padding: 0;
    cursor: pointer;
    background: transparent;
    appearance: none;
    -webkit-appearance: none;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-color::-webkit-color-swatch-wrapper { padding: 0; }
.st-modal-root .st-m-color::-webkit-color-swatch { border: none; border-radius: 4px; }
.st-modal-root .st-m-color:hover {
    border-color: rgba(255, 255, 255, 0.34);
    transform: translateY(-1px);
}

.st-modal-root .st-m-slider-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
}
.st-modal-root .st-m-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    min-width: 0;
    flex: 1 1 112px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.18);
    cursor: pointer;
    outline: none;
    transition: background 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--st-accent);
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-slider:hover::-webkit-slider-thumb {
    box-shadow: 0 0 0 5px var(--st-accent-soft);
    transform: scale(1.08);
}
.st-modal-root .st-m-slider-value {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 11px;
    color: var(--st-text-dim);
    flex: 0 0 48px;
    min-width: 48px;
    text-align: right;
    overflow: hidden;
    text-overflow: clip;
}

.st-modal-root .st-m-select,
.st-modal-root .st-m-text {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--st-border);
    color: var(--st-text);
    padding: 6px 9px;
    border-radius: var(--st-radius-sm);
    font-size: 13px;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    outline: none;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-select:focus,
.st-modal-root .st-m-text:focus {
    border-color: var(--st-accent);
    background: rgba(0, 0, 0, 0.45);
}

.st-modal-root .st-m-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--st-border);
    color: var(--st-text);
    padding: 7px 11px;
    border-radius: var(--st-radius-sm);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    min-height: 32px;
    transition: background 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.16s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
}
.st-modal-root .st-m-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.98);
}
.st-modal-root .st-m-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.st-modal-root .st-m-btn-primary {
    background: var(--st-accent);
    color: #000;
    border-color: var(--st-accent);
}
.st-modal-root .st-m-btn-primary:hover:not(:disabled) {
    background: #1ed760;
}
.st-modal-root .st-m-btn-danger {
    background: rgba(231, 76, 60, 0.12);
    border-color: rgba(231, 76, 60, 0.4);
    color: #f08272;
}
.st-modal-root .st-m-btn-danger:hover:not(:disabled) {
    background: rgba(231, 76, 60, 0.22);
}

.st-modal-root .st-m-preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 10px;
}
.st-modal-root .st-m-preset-card {
    background: var(--st-bg-elev);
    border: 1px solid var(--st-border);
    border-radius: var(--st-radius);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-width: 0;
    transition: border-color 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-preset-card:hover {
    border-color: rgba(255, 255, 255, 0.18);
    transform: translateY(-2px);
}
.st-modal-root .st-m-preset-card.active {
    border-color: var(--st-accent);
    box-shadow: 0 0 0 1px var(--st-accent);
}
.st-modal-root .st-m-preset-preview {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-height: 84px;
    background: linear-gradient(145deg, rgba(0, 0, 0, 0.55), rgba(8, 8, 10, 0.95));
}
.st-modal-root .st-m-preset-preview .st-prv-line {
    font-size: calc(13px * var(--st-prv-scale, 1));
    font-weight: 700;
}
.st-modal-root .st-m-preset-meta {
    padding: 9px 12px 6px;
}
.st-modal-root .st-m-preset-name {
    font-weight: 700;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow-wrap: anywhere;
}
.st-modal-root .st-m-preset-tag {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--st-text-dim);
}
.st-modal-root .st-m-preset-desc {
    font-size: 12px;
    color: var(--st-text-dim);
    line-height: 1.35;
    margin-top: 2px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}
.st-modal-root .st-m-preset-actions {
    display: flex;
    gap: 6px;
    padding: 0 12px 10px;
    margin-top: auto;
    flex-wrap: wrap;
}

.st-modal-root .st-m-save-preset {
    background: var(--st-bg-elev);
    border: 1px solid var(--st-border);
    border-radius: var(--st-radius);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.st-modal-root .st-m-save-row {
    display: grid;
    grid-template-columns: minmax(140px, 1fr) minmax(160px, 1.2fr) auto;
    gap: 8px;
}
.st-modal-root .st-m-save-row .st-m-text {
    min-width: 0;
}

.st-modal-root .st-m-mp-toolbar {
    position: sticky;
    top: -14px;
    z-index: 6;
    display: grid;
    grid-template-columns: minmax(180px, 1fr) auto;
    gap: 10px;
    align-items: center;
    padding: 10px 0;
    margin-bottom: 4px;
    background: transparent;
    -webkit-backdrop-filter: blur(14px) saturate(1.3);
    backdrop-filter: blur(14px) saturate(1.3);
}
.st-modal-root .st-m-mp-searchbar {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px 12px;
    border: 1px solid var(--st-border);
    border-radius: var(--st-radius);
    background: rgba(0, 0, 0, 0.3);
    transition: border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-mp-searchbar:focus-within {
    border-color: var(--st-accent);
}
.st-modal-root .st-m-mp-search {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--st-text);
    font-size: 13px;
    outline: none;
}
.st-modal-root .st-m-mp-search::placeholder {
    color: var(--st-text-dim);
}

.st-modal-root .st-sk {
    position: relative;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.05);
}
.st-modal-root .st-sk::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
    transform: translateX(-100%);
    animation: st-shimmer 1.25s ease-in-out infinite;
}
.st-modal-root .st-sk-line {
    height: 11px;
    border-radius: 4px;
    margin: 7px 0;
}
.st-modal-root .st-m-mp-skeleton {
    pointer-events: none;
}
@keyframes st-shimmer {
    100% { transform: translateX(100%); }
}
.st-modal-root .st-m-mp-sort {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
}
.st-modal-root .st-m-chip {
    background: transparent;
    border: 1px solid var(--st-border);
    color: var(--st-text-dim);
    padding: 6px 12px;
    border-radius: var(--st-radius-sm);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-chip:hover {
    color: var(--st-text);
    background: rgba(255, 255, 255, 0.05);
    transform: translateY(-1px);
}
.st-modal-root .st-m-chip.active {
    background: var(--st-accent-soft);
    border-color: var(--st-accent);
    color: var(--st-accent);
}

.st-modal-root .st-m-mp-status {
    font-size: 13px;
    color: var(--st-text-dim);
    text-align: center;
    padding: 28px 12px;
}

.st-modal-root .st-m-mp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 10px;
}
.st-modal-root .st-m-mp-card {
    background: var(--st-bg-elev);
    border: 1px solid var(--st-border);
    border-radius: var(--st-radius);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-width: 0;
    transition: border-color 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-mp-card:hover {
    border-color: rgba(255, 255, 255, 0.18);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.st-modal-root .st-m-mp-preview {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-height: 84px;
    background: linear-gradient(145deg, rgba(0, 0, 0, 0.55), rgba(8, 8, 10, 0.95));
}
.st-modal-root .st-m-mp-preview .st-prv-line {
    font-size: calc(13px * var(--st-prv-scale, 1));
    font-weight: 700;
}
.st-modal-root .st-m-mp-body {
    padding: 9px 12px 6px;
}
.st-modal-root .st-m-mp-name {
    font-weight: 700;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow-wrap: anywhere;
}
.st-modal-root .st-m-mp-featured {
    font-size: 9px;
    background: var(--st-accent);
    color: #000;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.08em;
    font-weight: 800;
}
.st-modal-root .st-m-mp-author {
    font-size: 12px;
    color: var(--st-text-dim);
    margin-top: 2px;
}
.st-modal-root .st-m-mp-desc {
    font-size: 12px;
    color: var(--st-text-dim);
    margin-top: 6px;
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}
.st-modal-root .st-m-mp-stats {
    font-size: 11px;
    color: var(--st-text-dim);
    margin-top: 8px;
}
.st-modal-root .st-m-mp-actions {
    display: flex;
    gap: 6px;
    padding: 0 12px 10px;
    margin-top: auto;
    flex-wrap: wrap;
}

.st-modal-root .st-m-mp-pagination {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: center;
    padding: 8px 0;
}
.st-modal-root .st-m-mp-page-info {
    font-size: 12px;
    color: var(--st-text-dim);
}

.st-modal-root .st-m-about-hero {
    display: flex;
    align-items: baseline;
    gap: 10px;
}
.st-modal-root .st-m-about-title {
    font-size: 18px;
    font-weight: 800;
}
.st-modal-root .st-m-about-version {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 12px;
    color: var(--st-accent);
    background: var(--st-accent-soft);
    padding: 2px 8px;
    border-radius: 4px;
}
.st-modal-root .st-m-about-hash {
    font-family: 'JetBrains Mono', 'Consolas', monospace;
    font-size: 11px;
    color: var(--st-text-dim);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--st-border);
    padding: 2px 7px;
    border-radius: 4px;
    user-select: all;
}
.st-modal-root .st-m-about-text {
    font-size: 13px;
    color: var(--st-text-dim);
    line-height: 1.5;
}
.st-modal-root .st-m-about-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
}
.st-modal-root .st-m-toggle-row {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    margin-left: auto;
}
.st-modal-root .st-m-about-links {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
}
.st-modal-root .st-m-about-links a {
    color: var(--st-accent);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
}
.st-modal-root .st-m-about-links a:hover {
    text-decoration: underline;
}

@keyframes st-modal-in {
    from {
        opacity: 0;
        transform: translateY(10px) scale(0.985);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

@keyframes st-tab-in {
    from {
        opacity: 0;
        transform: translateY(6px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (max-width: 760px) {
    .st-modal-root {
        width: calc(100vw - 24px);
        max-height: min(82vh, 720px);
        padding: 12px;
    }

    .st-modal-root .st-m-mp-toolbar,
    .st-modal-root .st-m-save-row {
        grid-template-columns: 1fr;
    }

    .st-modal-root .st-m-cz-body {
        grid-template-columns: 1fr;
    }
    .st-modal-root .st-m-cz-rail {
        position: static;
    }
    .st-modal-root .st-m-cz-nav {
        flex-direction: row;
        flex-wrap: wrap;
    }
    .st-modal-root .st-m-cz-nav-item {
        flex: 1 1 auto;
        justify-content: center;
    }
    .st-modal-root .st-m-enabled-bar {
        flex-wrap: wrap;
    }
    .st-modal-root .st-m-field-reset {
        visibility: visible;
        opacity: 0;
    }
    .st-modal-root .st-m-field-reset-on {
        opacity: 0.6;
    }

    .st-modal-root .st-m-field {
        grid-template-columns: 1fr;
        align-items: start;
        gap: 5px;
    }

    .st-modal-root .st-m-field-color,
    .st-modal-root .st-m-field-toggle {
        grid-template-columns: minmax(0, 1fr) max-content;
        align-items: center;
    }

    .st-modal-root .st-m-field-control {
        justify-content: stretch;
    }

    .st-modal-root .st-m-about-actions,
    .st-modal-root .st-m-preset-actions,
    .st-modal-root .st-m-mp-actions {
        align-items: stretch;
    }

    .st-modal-root .st-m-btn,
    .st-modal-root .st-m-about-actions .st-m-toggle-row {
        width: 100%;
        justify-content: center;
    }

    .st-modal-root .st-m-enabled-reset {
        width: auto;
    }
}

@media (prefers-reduced-motion: reduce) {
    .st-modal-root,
    .st-modal-root .st-m-tab-content {
        animation: none;
    }

    .st-modal-root *,
    .st-modal-root *::before,
    .st-modal-root *::after {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
    }
}
`;
