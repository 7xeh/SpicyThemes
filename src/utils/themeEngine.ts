import { themeState, ThemeConfig } from './state';


const STYLE_ID = 'spicy-themes-injected-styles';
const BASE_STYLE_ID = 'spicy-themes-base-styles';
const VIDEO_BG_ID = 'spicy-themes-video-bg';

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

function gradientRule(r: number, g: number, b: number, r2?: number, g2?: number, b2?: number): string {
    const er = r2 ?? r, eg = g2 ?? g, eb = b2 ?? b;
    return `background-image: linear-gradient(
        var(--gradient-degrees, 180deg),
        rgba(${r}, ${g}, ${b}, var(--gradient-alpha, 1)) var(--gradient-position, 0%),
        rgba(${er}, ${eg}, ${eb}, var(--gradient-alpha-end, 1)) calc(var(--gradient-position, 0%) + 20% + var(--gradient-offset, 0%))
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
        'body.SpicySidebarLyrics__Active #SpicyLyricsPage.SpicyRenderer .LyricsContainer .LyricsContent',
    ];
    const PIP = [
        '.spicy-pip-wrapper #SpicyLyricsPage .LyricsContainer .LyricsContent',
        '.spicy-pip-wrapper #SpicyLyricsPage .SpicyLyricsScrollContainer',
        '.spicy-pip-wrapper #SpicyLyricsPage .LyricsContent',
    ];
    const ALL = [...BASES, ...PIP];

    const activeGrad = config.gradientEnabled
        ? gradientRule(gradStartRgb.r, gradStartRgb.g, gradStartRgb.b, gradEndRgb.r, gradEndRgb.g, gradEndRgb.b)
        : colorRule(config.activeLineColor);
    const sungGrad = colorRule(config.sungLineColor);
    const notSungGrad = colorRule(config.notSungLineColor);

    const clampedActiveGlow = Math.min(config.activeGlowIntensity, 15);
    const clampedGlow = Math.min(config.glowIntensity, 15);
    const clampedSidebarGlow = Math.min(Math.round(config.activeGlowIntensity * 0.7), 15);
    const glowActive = config.glowEnabled && `filter: drop-shadow(0 0 ${clampedActiveGlow}px ${config.activeGlowColor}) !important;`;
    const glowNormal = config.glowEnabled && `filter: drop-shadow(0 0 ${clampedGlow}px ${config.glowColor}) !important;`;
    const glowSidebar = config.glowEnabled && `filter: drop-shadow(0 0 ${clampedSidebarGlow}px ${config.activeGlowColor}) !important;`;
    const scaleEffect = !config.scaleInEffect && config.scaleActive !== 1.0 && `transform: scale3d(${config.scaleActive}, ${config.scaleActive}, 1) !important; transform-origin: left center !important;`;
    const bgGlowRgb = hexToRgb(config.bgGlowColor);
    const clampedBgGlow = Math.min(config.bgGlowIntensity, 30);
    const bgGlowDecl = config.bgGlowEnabled
        ? `text-shadow: 0 0 ${clampedBgGlow}px rgba(${bgGlowRgb.r}, ${bgGlowRgb.g}, ${bgGlowRgb.b}, var(--text-shadow-opacity, 1)) !important;`
        : '';
    const karaokeGlowDecl = `text-shadow: 0 0 7px ${hexToRgba(config.activeLineColor, 0.5)} !important;`;
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

    css.push(`
${ALL.map(b => `${b} .line.Active`).join(',\n')} {
    will-change: opacity, filter, transform !important;
}
`);

    css.push(`
${lineSelectors(ALL, 'Active')} {
    ${buildProps(activeGrad, scaleEffect)}
}
`);

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

    if (config.lineWindowEnabled) {
        const sungN = Math.min(Math.max(Math.round(config.lineWindowSungLines), 0), 10);
        const unsungN = Math.min(Math.max(Math.round(config.lineWindowUnsungLines), 0), 10);

        const hideTargets = ALL.flatMap(b => [
            `${b} [data-index]:has(> .line.Sung)`,
            `${b} [data-index]:has(> .line.NotSung)`,
        ]).join(',\n');
        css.push(`
${hideTargets} {
    visibility: hidden !important;
    pointer-events: none !important;
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
    visibility: visible !important;
    pointer-events: auto !important;
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
#SpicyLyricsPage .LyricsContainer::before,
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
    const sltHlStartRgb = hexToRgb(config.sltHighlightStartColor);
    const sltHlEndRgb = hexToRgb(config.sltHighlightEndColor);
    const sltHlGrad = gradientRule(sltHlStartRgb.r, sltHlStartRgb.g, sltHlStartRgb.b, sltHlEndRgb.r, sltHlEndRgb.g, sltHlEndRgb.b);
    const activeGrad = sltHlGrad;
    const sungGrad = sltHlGrad;
    const notSungGrad = colorRule(sltBaseColor);
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
    ${buildProps(activeGrad, `opacity: ${config.activeLineOpacity} !important;`, glowActive)}
}

.slt-replace-line.active .slt-replace-word.word-active,
.slt-replace-line.Active .slt-replace-word.word-active {
    ${buildProps(activeGrad, scaleEffect, bgGlowDecl || karaokeGlowDecl)}
}

.line.Active + .slt-interleaved-translation:not(.slt-sync-translation),
.slt-interleaved-translation.active:not(.slt-sync-translation),
.slt-interleaved-translation.Active:not(.slt-sync-translation) {
    ${buildProps(
        activeGrad,
        `opacity: ${config.activeLineOpacity} !important;`,
        glowActive,
    )}
}

.line.Active + .slt-sync-translation.slt-interleaved-translation,
.slt-sync-translation.slt-interleaved-translation.active {
    ${buildProps(
        activeGrad,
        `opacity: ${config.activeLineOpacity} !important;`,
        `background-size: 100% 100% !important;`,
        `background-repeat: no-repeat !important;`,
        `-webkit-box-decoration-break: slice !important;`,
        `box-decoration-break: slice !important;`,
        glowActive || `filter: none !important;`,
    )}
}

.slt-sync-word.slt-word-active {
    ${buildProps(activeGrad, scaleEffect, bgGlowDecl || karaokeGlowDecl)}
}

.slt-replace-line.Sung,
.line.Sung + .slt-replace-line {
    ${buildProps(sungGrad, `opacity: ${config.sungLineOpacity} !important;`)}
}

.slt-replace-word.word-sung {
    ${sungGrad}
}

.line.Sung + .slt-interleaved-translation:not(.slt-sync-translation) {
    ${buildProps(
        sungGrad,
        `opacity: ${config.sungLineOpacity} !important;`,
    )}
}

.line.Sung + .slt-sync-translation.slt-interleaved-translation {
    ${buildProps(
        sungGrad,
        `opacity: ${config.sungLineOpacity} !important;`,
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
    ${buildProps(notSungGrad, `opacity: ${config.notSungLineOpacity} !important;`)}
}

.slt-replace-word.word-notsung,
.slt-replace-word.word-notsng {
    ${notSungGrad}
}

.line.NotSung + .slt-interleaved-translation:not(.slt-sync-translation) {
    ${buildProps(
        notSungGrad,
        `opacity: ${config.notSungLineOpacity} !important;`,
    )}
}

.line.NotSung + .slt-sync-translation.slt-interleaved-translation {
    ${buildProps(
        notSungGrad,
        `opacity: ${config.notSungLineOpacity} !important;`,
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

    if (config.popEffect) {
        const popActiveTargets = [
            ...ALL.flatMap(b => [
                `${b} .line.Active .word`,
                `${b} .line.Active .letterGroup`,
            ]),
            '.slt-sync-word.slt-word-active',
            '.slt-replace-word.word-active',
        ].join(',\n');
        css.push(`
@keyframes st-word-pop {
    0% { transform: scale3d(1, 1, 1); }
    40% { transform: scale3d(${config.popScale}, ${config.popScale}, 1); }
    100% { transform: scale3d(1, 1, 1); }
}
${popActiveTargets} {
    display: inline-block !important;
    animation: st-word-pop ${config.popDuration}s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
    will-change: transform, opacity !important;
    backface-visibility: hidden !important;
}
`);
    }

    if (config.waveEffect) {
        const waveTargets = [
            ...ALL.flatMap(b => [
                `${b} .line.Active .word`,
                `${b} .line.Active .letterGroup`,
            ]),
            '.slt-interleaved-translation.Active .slt-sync-word',
            '.slt-replace-line.Active .slt-replace-word',
        ].join(',\n');
        css.push(`
@keyframes st-word-wave {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(0, -${config.waveIntensity}px, 0); }
}
${waveTargets} {
    display: inline-block !important;
    animation: st-word-wave ${config.waveSpeed}s ease-in-out infinite !important;
    will-change: transform, opacity !important;
    backface-visibility: hidden !important;
}
`);
        for (let i = 0; i < 20; i++) {
            const nthTargets = [
                ...ALL.flatMap(b => [
                    `${b} .line.Active .word:nth-child(${i + 1})`,
                    `${b} .line.Active .letterGroup:nth-child(${i + 1})`,
                ]),
                `.slt-interleaved-translation.Active .slt-sync-word:nth-child(${i + 1})`,
                `.slt-replace-line.Active .slt-replace-word:nth-child(${i + 1})`,
            ].join(',\n');
            css.push(`
${nthTargets} {
    animation-delay: ${(i * 0.08).toFixed(2)}s !important;
}
`);
        }
    }

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
    transform-origin: left center !important;
    animation: st-line-scale-in ${config.scaleInDuration}s cubic-bezier(0.16, 1, 0.3, 1) both !important;
    will-change: transform !important;
}
`);
    }

    css.push(`
${lineSelectors(SIDEBAR, 'Sung')} {
    ${sungGrad}
}
${lineSelectors(SIDEBAR, 'NotSung')} {
    ${notSungGrad}
}
`);

    if (config.glowEnabled) {
        css.push(`
${SIDEBAR.map(b => `${b} .line.Active`).join(',\n')} {
    ${glowSidebar}
}
`);
    }

    const PLAYER = ['#SpicyLyricsPage', '.spicy-pip-wrapper #SpicyLyricsPage'];

    if (config.playerStylingEnabled) {
        const radius = Math.min(Math.max(config.playerArtRadius, 0), 50);
        const barH = (1.3 * config.playerProgressThickness).toFixed(2);

        css.push(`
${PLAYER.map(p => `${p} .ContentBox .NowBar .MediaImageContainer`).join(',\n')} {
    border-radius: ${radius}% !important;
    --BorderRadius: ${radius}% !important;
}
`);

        css.push(`
${PLAYER.map(p => `${p} .Timeline .SliderBar`).join(',\n')} {
    height: ${barH}cqh !important;
}
`);

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
            css.push(`
${PLAYER.map(p => `${p} .PlaybackControls .PlaybackControl`).join(',\n')} {
    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.175s ease-out, opacity 0.175s cubic-bezier(0.37, 0, 0.63, 1) !important;
}
${PLAYER.map(p => `${p} .PlaybackControls .PlaybackControl:hover`).join(',\n')} {
    transform: scale(1.18) !important;
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.55)) !important;
}
${PLAYER.map(p => `${p} .PlaybackControls .PlaybackControl.Pressed`).join(',\n')} {
    transform: scale(0.86) !important;
}
`);
        }
    }

    if (config.videoBgEnabled && config.videoBgUrl.trim()) {
        const blur = Math.min(Math.max(config.videoBgBlur, 0), 30);
        const dim = Math.min(Math.max(config.videoBgDim, 0), 1);

        css.push(`
${PLAYER.map(p => `${p} #${VIDEO_BG_ID}`).join(',\n')} {
    position: absolute !important;
    inset: 0 !important;
    z-index: -1 !important;
    overflow: hidden !important;
    pointer-events: none !important;
}
${PLAYER.map(p => `${p} #${VIDEO_BG_ID} video`).join(',\n')} {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    display: block !important;
    ${blur > 0 ? `filter: blur(${blur}px) !important;\n    transform: scale(1.1) !important;` : ''}
}
${PLAYER.map(p => `${p} #${VIDEO_BG_ID}::after`).join(',\n')} {
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    background: rgba(0, 0, 0, ${dim}) !important;
    pointer-events: none !important;
}
`);
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

function updateVideoBackgroundIn(doc: Document): void {
    const config = themeState.activeTheme;
    const enabled = themeState.isEnabled && config.videoBgEnabled && !!config.videoBgUrl.trim();

    let wrap = doc.getElementById(VIDEO_BG_ID) as HTMLElement | null;

    if (!enabled) {
        if (wrap) wrap.remove();
        return;
    }

    const parent = doc.querySelector('#SpicyLyricsPage') as HTMLElement | null;
    if (!parent) {
        if (wrap) wrap.remove();
        return;
    }

    if (!wrap) {
        wrap = doc.createElement('div');
        wrap.id = VIDEO_BG_ID;
        const video = doc.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.setAttribute('playsinline', '');
        (video as HTMLVideoElement).playsInline = true;
        wrap.appendChild(video);
    }

    if (wrap.parentElement !== parent) {
        parent.appendChild(wrap);
    }

    const video = wrap.querySelector('video') as HTMLVideoElement;
    const url = config.videoBgUrl.trim();
    if (video.getAttribute('src') !== url) {
        video.src = url;
        video.play?.().catch(() => {});
    }
}

export function updateVideoBackground(): void {
    try {
        updateVideoBackgroundIn(document);
        const pipWindow = getPIPWindow();
        if (pipWindow) updateVideoBackgroundIn(pipWindow.document);
    } catch (e) {}
}

function removeVideoBackground(): void {
    document.getElementById(VIDEO_BG_ID)?.remove();
    const pipWindow = getPIPWindow();
    if (pipWindow) pipWindow.document.getElementById(VIDEO_BG_ID)?.remove();
}

let blurPreviewObserver: MutationObserver | null = null;
let blurPreviewScheduled = false;

export function refreshBlurPreview(): void {
    blurPreviewScheduled = false;
    document.querySelectorAll('#SpicyLyricsPage [data-index].st-preview-line')
        .forEach(el => el.classList.remove('st-preview-line'));

    if (!themeState.isEnabled || !themeState.activeTheme.blurUnsung) return;
    const n = Math.max(0, Math.round(themeState.activeTheme.blurPreviewLines));
    if (n <= 0) return;

    const active = document.querySelector('#SpicyLyricsPage .line.Active');
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

function scheduleBlurPreview(): void {
    if (blurPreviewScheduled) return;
    blurPreviewScheduled = true;
    requestAnimationFrame(refreshBlurPreview);
}

export function startBlurPreviewObserver(): void {
    if (blurPreviewObserver) return;
    const target = document.querySelector('#SpicyLyricsPage');
    if (!target) return;
    blurPreviewObserver = new MutationObserver((muts) => {
        for (const m of muts) {
            const t = m.target as HTMLElement;
            if (t.classList && t.classList.contains('line')) {
                scheduleBlurPreview();
                return;
            }
        }
    });
    blurPreviewObserver.observe(target, { attributes: true, attributeFilter: ['class'], subtree: true });
    scheduleBlurPreview();
}

export function stopBlurPreviewObserver(): void {
    blurPreviewObserver?.disconnect();
    blurPreviewObserver = null;
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

    updateVideoBackground();
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

    removeVideoBackground();
}

export function injectBaseStyles(): void {
    if (document.getElementById(BASE_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = BASE_STYLE_ID;
    style.textContent = BASE_STYLES;
    document.head.appendChild(style);
}

const BASE_STYLES = `
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
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
    padding: 14px;
    color: var(--st-text);
    font-size: 13px;
    line-height: 1.35;
    animation: st-modal-in 0.34s cubic-bezier(0.16, 1, 0.3, 1);
    scrollbar-gutter: stable;
}

.st-modal-root *,
.st-modal-root *::before,
.st-modal-root *::after {
    box-sizing: border-box;
}

.st-modal-root .st-m-enabled-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--st-bg-elev);
    border: 1px solid var(--st-border);
    border-radius: var(--st-radius);
    margin-bottom: 12px;
    transition: background 0.24s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.st-modal-root .st-m-enabled-text {
    flex: 1;
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
    min-height: 200px;
}

.st-modal-root .st-m-tab-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: st-tab-in 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.st-modal-root .st-m-customize-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    align-items: start;
}

.st-modal-root .st-m-cz {
    gap: 0;
}
.st-modal-root .st-m-cz-toolbar {
    position: sticky;
    top: -14px;
    z-index: 6;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    margin-bottom: 14px;
    border: 1px solid var(--st-border);
    border-radius: var(--st-radius);
    background: rgba(18, 18, 20, 0.82);
    -webkit-backdrop-filter: blur(14px) saturate(1.3);
    backdrop-filter: blur(14px) saturate(1.3);
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
    grid-template-columns: 158px minmax(0, 1fr);
    gap: 14px;
    align-items: start;
}
.st-modal-root .st-m-cz-rail {
    position: sticky;
    top: 44px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-self: start;
    min-width: 0;
}
.st-modal-root .st-m-cz-preview {
    border: 1px solid var(--st-border);
    border-radius: var(--st-radius);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 92px;
    overflow: hidden;
    background: linear-gradient(145deg, rgba(0, 0, 0, 0.55), rgba(8, 8, 10, 0.95));
}
.st-modal-root .st-m-cz-preview .st-prv-line {
    font-size: calc(16px * var(--st-prv-scale, 1));
    font-weight: 800;
}
.st-modal-root .st-m-cz-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.st-modal-root .st-m-cz-nav-item {
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
.st-modal-root .st-m-cz-nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--st-text);
}
.st-modal-root .st-m-cz-nav-item.active {
    background: var(--st-accent-soft);
    color: var(--st-accent);
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
    scroll-margin-top: 64px;
}
.st-modal-root .st-m-cz-cat-title {
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--st-text);
    padding-bottom: 7px;
    border-bottom: 1px solid var(--st-border);
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
.st-modal-root .st-m-field-label {
    min-width: 0;
    font-size: 13px;
    color: var(--st-text);
    overflow-wrap: normal;
    line-height: 1.3;
}
.st-modal-root .st-m-field-control {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;
    min-width: 0;
    width: 100%;
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
    background: rgba(18, 18, 20, 0.82);
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

    .st-modal-root .st-m-customize-grid,
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
        text-align: center;
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
