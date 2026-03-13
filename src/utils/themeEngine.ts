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

export function generateThemeCSS(config: ThemeConfig): string {
    const lines: string[] = [];

    // --- Active line styling ---
    lines.push(`
#SpicyLyricsPage .LyricsContainer .LyricsContent .line.Active,
.Cinema--Container .LyricsContent .line.Active {
    --Vocal-Active-opacity: ${config.activeLineOpacity} !important;
    color: ${config.activeLineColor} !important;
    -webkit-text-fill-color: ${config.activeLineColor} !important;
    ${config.glowEnabled ? `text-shadow: 0 0 ${config.activeGlowIntensity}px ${config.activeGlowColor} !important;` : ''}
    ${config.scaleActive !== 1.0 ? `scale: ${config.scaleActive} !important;` : ''}
    ${config.blurUnsung ? 'filter: none !important;' : ''}
}
`);

    // --- Sung line styling ---
    lines.push(`
#SpicyLyricsPage .LyricsContainer .LyricsContent .line.Sung,
.Cinema--Container .LyricsContent .line.Sung {
    --Vocal-Sung-opacity: ${config.sungLineOpacity} !important;
    color: ${config.sungLineColor} !important;
    -webkit-text-fill-color: ${config.sungLineColor} !important;
    ${config.glowEnabled ? `text-shadow: 0 0 ${config.glowIntensity}px ${config.glowColor} !important;` : ''}
    ${config.blurUnsung ? `filter: blur(${config.blurAmount}px) !important;` : ''}
}
`);

    // --- Not-sung line styling ---
    lines.push(`
#SpicyLyricsPage .LyricsContainer .LyricsContent .line.NotSung,
.Cinema--Container .LyricsContent .line.NotSung {
    --Vocal-NotSung-opacity: ${config.notSungLineOpacity} !important;
    color: ${config.notSungLineColor} !important;
    -webkit-text-fill-color: ${config.notSungLineColor} !important;
    ${config.glowEnabled ? `text-shadow: 0 0 ${config.glowIntensity}px ${config.glowColor} !important;` : ''}
    ${config.blurUnsung ? `filter: blur(${config.blurAmount}px) !important;` : ''}
}
`);

    // --- Background lyrics ---
    lines.push(`
#SpicyLyricsPage .LyricsContainer .LyricsContent .bg-line,
.Cinema--Container .LyricsContent .bg-line {
    color: ${config.bgLineColor} !important;
    -webkit-text-fill-color: ${config.bgLineColor} !important;
}
`);

    // --- Font customization ---
    if (config.fontFamily || config.fontWeight !== 900 || config.fontSize !== 1.0 || config.letterSpacing !== 0 || config.lineHeight !== 1.1818181818) {
        lines.push(`
#SpicyLyricsPage .LyricsContainer .LyricsContent .line,
.Cinema--Container .LyricsContent .line {
    ${config.fontFamily ? `font-family: ${config.fontFamily}, system-ui, sans-serif !important;` : ''}
    font-weight: ${config.fontWeight} !important;
    ${config.fontSize !== 1.0 ? `font-size: calc(1em * ${config.fontSize}) !important;` : ''}
    letter-spacing: ${config.letterSpacing}em !important;
    line-height: ${config.lineHeight} !important;
}
`);
    }

    // --- Gradient override ---
    if (config.gradientEnabled) {
        lines.push(`
#SpicyLyricsPage .LyricsContainer .LyricsContent .line .word .syllable,
#SpicyLyricsPage .LyricsContainer .LyricsContent .line .word .letterGroup,
.Cinema--Container .LyricsContent .line .word .syllable,
.Cinema--Container .LyricsContent .line .word .letterGroup {
    --gradient-degrees: ${config.gradientAngle}deg;
}
`);
    }

    // --- Animation speed ---
    if (config.animationSpeed !== 1.0) {
        const transitionDuration = (0.3 / config.animationSpeed).toFixed(3);
        lines.push(`
#SpicyLyricsPage .LyricsContainer .LyricsContent .line,
.Cinema--Container .LyricsContent .line {
    transition-duration: ${transitionDuration}s !important;
}
`);
    }

    // --- Page background overlay ---
    if (config.pageBgOverlay) {
        lines.push(`
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
#SpicyLyricsPage .LyricsContainer .LyricsContent {
    position: relative;
    z-index: 1;
}
`);
    }

    // --- SLT translation compatibility ---
    lines.push(`
.slt-replace-line,
.slt-interleaved-translation,
.slt-sync-translation {
    color: ${config.sltTranslationColor} !important;
    -webkit-text-fill-color: ${config.sltTranslationColor} !important;
    opacity: ${config.sltTranslationOpacity} !important;
    ${config.sltTranslationFontSize !== 1.0 ? `font-size: calc(1em * ${config.sltTranslationFontSize}) !important;` : ''}
    ${config.fontFamily ? `font-family: ${config.fontFamily}, system-ui, sans-serif !important;` : ''}
    font-weight: ${config.fontWeight} !important;
}

.slt-replace-line.Active,
.slt-replace-line.active,
.line.Active + .slt-replace-line {
    color: ${config.activeLineColor} !important;
    -webkit-text-fill-color: ${config.activeLineColor} !important;
    opacity: ${config.activeLineOpacity} !important;
    ${config.glowEnabled ? `text-shadow: 0 0 ${config.activeGlowIntensity}px ${config.activeGlowColor} !important;` : ''}
}

.slt-replace-line.Sung,
.line.Sung + .slt-replace-line {
    color: ${config.sungLineColor} !important;
    -webkit-text-fill-color: ${config.sungLineColor} !important;
    opacity: ${config.sungLineOpacity} !important;
}

.slt-replace-line.NotSung,
.line.NotSung + .slt-replace-line {
    color: ${config.notSungLineColor} !important;
    -webkit-text-fill-color: ${config.notSungLineColor} !important;
    opacity: ${config.notSungLineOpacity} !important;
}
`);

    // --- Hide scrollbar ---
    if (config.hideScrollbar) {
        lines.push(`
#SpicyLyricsPage .LyricsContainer .LyricsContent::-webkit-scrollbar {
    display: none !important;
}
#SpicyLyricsPage .LyricsContainer .LyricsContent {
    scrollbar-width: none !important;
}
`);
    }

    // --- PiP window support ---
    lines.push(`
.spicy-pip-wrapper .line.Active {
    color: ${config.activeLineColor} !important;
    -webkit-text-fill-color: ${config.activeLineColor} !important;
    ${config.glowEnabled ? `text-shadow: 0 0 ${config.activeGlowIntensity}px ${config.activeGlowColor} !important;` : ''}
}
.spicy-pip-wrapper .line.Sung {
    color: ${config.sungLineColor} !important;
    -webkit-text-fill-color: ${config.sungLineColor} !important;
}
.spicy-pip-wrapper .line.NotSung {
    color: ${config.notSungLineColor} !important;
    -webkit-text-fill-color: ${config.notSungLineColor} !important;
}
`);

    // --- Sidebar mode support ---
    lines.push(`
body.SpicySidebarLyrics__Active #SpicyLyricsPage .line.Active {
    color: ${config.activeLineColor} !important;
    -webkit-text-fill-color: ${config.activeLineColor} !important;
    ${config.glowEnabled ? `text-shadow: 0 0 ${Math.round(config.activeGlowIntensity * 0.7)}px ${config.activeGlowColor} !important;` : ''}
}
`);

    return lines.join('\n');
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
    debug('Theme styles injected');
}

export function removeThemeStyles(): void {
    const style = document.getElementById(STYLE_ID);
    if (style) {
        style.remove();
        debug('Theme styles removed');
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
/* SpicyThemes settings UI */
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
`;
