import { themeState, ThemeConfig } from './state';
import { debug } from './debug';

const STYLE_ID = 'spicy-themes-injected-styles';
const BASE_STYLE_ID = 'spicy-themes-base-styles';

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
        var(--gradient-degrees),
        rgba(${r}, ${g}, ${b}, var(--gradient-alpha)) var(--gradient-position),
        rgba(${er}, ${eg}, ${eb}, var(--gradient-alpha-end)) calc(var(--gradient-position) + 20% + var(--gradient-offset))
    ) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    -webkit-text-fill-color: transparent !important;`;
}

function colorRule(color: string): string {
    return `color: ${color} !important;\n    -webkit-text-fill-color: ${color} !important;`;
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
    const bgRgb = hexToRgb(config.bgLineColor.startsWith('rgba') ? '#ffffff' : config.bgLineColor);
    const sltRgb = hexToRgb(config.sltTranslationColor);
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
    const sungGrad = config.gradientEnabled
        ? gradientRule(gradStartRgb.r, gradStartRgb.g, gradStartRgb.b, gradEndRgb.r, gradEndRgb.g, gradEndRgb.b)
        : colorRule(config.sungLineColor);
    const notSungGrad = config.gradientEnabled
        ? gradientRule(gradStartRgb.r, gradStartRgb.g, gradStartRgb.b, gradEndRgb.r, gradEndRgb.g, gradEndRgb.b)
        : colorRule(config.notSungLineColor);
    const sltGrad = config.gradientEnabled
        ? gradientRule(gradStartRgb.r, gradStartRgb.g, gradStartRgb.b, gradEndRgb.r, gradEndRgb.g, gradEndRgb.b)
        : colorRule(config.sltTranslationColor);

    const clampedActiveGlow = Math.min(config.activeGlowIntensity, 15);
    const clampedGlow = Math.min(config.glowIntensity, 15);
    const clampedSidebarGlow = Math.min(Math.round(config.activeGlowIntensity * 0.7), 15);
    const glowActive = config.glowEnabled && `filter: drop-shadow(0 0 ${clampedActiveGlow}px ${config.activeGlowColor}) !important;`;
    const glowNormal = config.glowEnabled && `filter: drop-shadow(0 0 ${clampedGlow}px ${config.glowColor}) !important;`;
    const glowSidebar = config.glowEnabled && `filter: drop-shadow(0 0 ${clampedSidebarGlow}px ${config.activeGlowColor}) !important;`;
    const scaleEffect = config.scaleActive !== 1.0 && `scale: ${config.scaleActive} !important;`;

    const sltFontOverrides = buildProps(
        config.sltTranslationFontSize !== 1.0 && `font-size: calc(1em * ${config.sltTranslationFontSize}) !important;`,
        config.fontFamily && `font-family: ${config.fontFamily}, system-ui, sans-serif !important;`,
        `font-weight: ${config.fontWeight} !important;`,
    );

    css.push(`
${sel(ALL, '.line')} {
    ${buildProps(
        `--Vocal-Active-opacity: ${config.activeLineOpacity} !important;`,
        `--Vocal-Sung-opacity: ${config.sungLineOpacity} !important;`,
        `--Vocal-NotSung-opacity: ${config.notSungLineOpacity} !important;`,
        `--gradient-degrees: ${config.gradientAngle}deg !important;`,
        config.fontFamily && `font-family: ${config.fontFamily}, system-ui, sans-serif !important;`,
        `font-weight: ${config.fontWeight} !important;`,
        config.letterSpacing !== 0 && `letter-spacing: ${config.letterSpacing}em !important;`,
        config.lineHeight !== 1.1818181818 && `--lyrics-line-height: ${config.lineHeight} !important;`,
    )}
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
        const blurTargets = ALL.flatMap(b => [`${b} .line.Sung`, `${b} .line.NotSung`]).join(',\n');
        const blurFilter = config.glowEnabled
            ? `filter: blur(${config.blurAmount}px) drop-shadow(0 0 ${clampedGlow}px ${config.glowColor}) !important;`
            : `filter: blur(${config.blurAmount}px) !important;`;
        css.push(`
${blurTargets} {
    ${blurFilter}
    will-change: filter;
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
        const sltHighlightTargets = [
            '.slt-replace-line',
            '.slt-replace-line .slt-replace-word',
            '.slt-interleaved-translation',
            '.slt-sync-translation.slt-interleaved-translation',
            '.slt-sync-translation.slt-interleaved-translation .slt-sync-word',
            '.slt-replace-line.Active',
            '.slt-replace-line.Sung',
            '.slt-replace-line.NotSung',
        ].join(',\n');
        css.push(`
${highlightTargets},
${sltHighlightTargets} {
    background-image: none !important;
    -webkit-background-clip: unset !important;
    background-clip: unset !important;
    color: ${config.highlightColor} !important;
    -webkit-text-fill-color: ${config.highlightColor} !important;
}
`);
    }

    if (config.gradientEnabled) {
        css.push(`
${sel(BASES, '.line.bg-line')},
${sel(BASES, '.line.bg-line .word')},
${sel(BASES, '.line.bg-line .letterGroup')},
${sel(BASES, '.line.bg-line .letterGroup .letter')} {
    background-image: linear-gradient(
        var(--gradient-degrees),
        rgba(${gradStartRgb.r}, ${gradStartRgb.g}, ${gradStartRgb.b}, 0.6) var(--gradient-position),
        rgba(${gradEndRgb.r}, ${gradEndRgb.g}, ${gradEndRgb.b}, 0.3) calc(var(--gradient-position) + 20% + var(--gradient-offset))
    ) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
}
`);
    } else {
        css.push(`
${sel(BASES, '.line.bg-line')},
${sel(BASES, '.line.bg-line .word')},
${sel(BASES, '.line.bg-line .letterGroup')},
${sel(BASES, '.line.bg-line .letterGroup .letter')} {
    ${gradientRule(bgRgb.r, bgRgb.g, bgRgb.b)}
}
`);
    }

    if (config.animationSpeed !== 1.0) {
        css.push(`
${sel(BASES, '.line')} {
    transition-duration: ${(0.3 / config.animationSpeed).toFixed(3)}s !important;
}
`);
    }

    if (config.pageBgOverlay) {
        css.push(`
#SpicyLyricsPage .LyricsContainer::before {
    content: '';
    position: absolute;
    inset: 0;
    background: ${hexToRgba(config.pageBgColor, config.pageBgOpacity)};
    pointer-events: none;
    z-index: 0;
}
#SpicyLyricsPage .LyricsContainer {
    position: relative;
}
${sel(BASES, '')} {
    position: relative;
    z-index: 1;
}
`);
    }

    if (config.sltStylingEnabled) {
    css.push(`
.slt-replace-line {
    ${buildProps(sltGrad, `opacity: ${config.sltTranslationOpacity} !important;`, sltFontOverrides)}
}

.slt-replace-line:has(.slt-replace-word) {
    background-image: none !important;
}

.slt-replace-word {
    ${sltGrad}
}

.slt-interleaved-translation:not(.slt-sync-translation) {
    ${buildProps(
        sltGrad,
        `opacity: ${config.sltTranslationOpacity} !important;`,
        sltFontOverrides,
    )}
}

.slt-sync-translation.slt-interleaved-translation {
    ${buildProps(
        sltGrad,
        `opacity: ${config.sltTranslationOpacity} !important;`,
        `background-size: 100% 100% !important;`,
        `background-repeat: no-repeat !important;`,
        `-webkit-box-decoration-break: slice !important;`,
        `box-decoration-break: slice !important;`,
        sltFontOverrides,
    )}
}

.slt-sync-translation.slt-interleaved-translation:has(.slt-sync-word) {
    background-image: none !important;
}

.slt-sync-word {
    ${sltGrad}
}

.slt-replace-line.Active,
.slt-replace-line.active,
.line.Active + .slt-replace-line {
    ${buildProps(activeGrad, `opacity: ${config.activeLineOpacity} !important;`, glowActive)}
}

.slt-replace-line.active .slt-replace-word.word-active,
.slt-replace-line.Active .slt-replace-word.word-active {
    ${activeGrad}
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
    ${activeGrad}
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

    if (config.hideScrollbar) {
        const scrollTargets = [
            '#SpicyLyricsPage .LyricsContainer',
            '#SpicyLyricsPage .LyricsContainer .LyricsContent',
            '#SpicyLyricsPage .SpicyLyricsScrollContainer',
            '#SpicyLyricsPage .ContentBox',
            '.spicy-pip-wrapper #SpicyLyricsPage .LyricsContainer',
            '.spicy-pip-wrapper #SpicyLyricsPage .SpicyLyricsScrollContainer',
            'body.SpicySidebarLyrics__Active #SpicyLyricsPage .LyricsContainer',
        ];
        css.push(`
${scrollTargets.map(s => `${s}::-webkit-scrollbar`).join(',\n')} {
    display: none !important;
    width: 0 !important;
}
${scrollTargets.join(',\n')} {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
}
`);
    }

    if (config.popEffect) {
        const popActiveTargets = ALL.flatMap(b => [
            `${b} .line.Active .word`,
            `${b} .line.Active .letterGroup`,
        ]).join(',\n');
        css.push(`
@keyframes st-word-pop {
    0% { transform: scale(1); }
    40% { transform: scale(${config.popScale}); }
    100% { transform: scale(1); }
}
${popActiveTargets} {
    display: inline-block !important;
    animation: st-word-pop ${config.popDuration}s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
}
`);
    }

    css.push(`
${lineSelectors(SIDEBAR, 'Active')} {
    ${activeGrad}
}
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
    let style = pipDoc.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
        style = pipDoc.createElement('style');
        style.id = STYLE_ID;
        pipDoc.head.appendChild(style);
    }
    style.textContent = css;
}

export function injectThemeStyles(): void {
    if (!themeState.isEnabled) {
        removeThemeStyles();
        return;
    }

    const css = generateThemeCSS(themeState.activeTheme);

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }
    style.textContent = css;

    injectIntoPIPDocument(css);

    debug('Theme styles injected');
}

export function removeThemeStyles(): void {
    const style = document.getElementById(STYLE_ID);
    if (style) {
        style.remove();
        debug('Theme styles removed');
    }

    const pipWindow = getPIPWindow();
    if (pipWindow) {
        const pipStyle = pipWindow.document.getElementById(STYLE_ID);
        if (pipStyle) pipStyle.remove();
    }
}

export function injectBaseStyles(): void {
    if (document.getElementById(BASE_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = BASE_STYLE_ID;
    style.textContent = BASE_STYLES;
    document.head.appendChild(style);
    debug('Base styles injected');
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

#ThemeToggle.active svg {
    color: var(--spice-button-active, #1db954);
}

// .ST_ConnectionIndicator removed: no longer used
    align-items: center;
    margin-right: 8px;
    position: relative;
    z-index: 100;
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
`;
