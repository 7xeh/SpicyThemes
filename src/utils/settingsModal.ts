import { storage } from './storage';
import {
    themeState,
    saveThemeState,
    applyPreset,
    getAllPresets,
    saveCustomPreset,
    deleteCustomPreset,
    updateThemeProperty,
    DEFAULT_THEME,
    BUILTIN_PRESETS,
    ThemeConfig,
    ThemePreset,
} from './state';
import { injectThemeStyles } from './themeEngine';
import { checkForUpdates, getCurrentVersion, getUpdateInfo, isDevChannel } from './updater';
import * as Marketplace from './marketplace';

export type FieldType = 'toggle' | 'color' | 'slider' | 'dropdown' | 'text';

export interface FieldDef<K extends keyof ThemeConfig = keyof ThemeConfig> {
    id: K;
    label: string;
    type: FieldType;
    section: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    placeholder?: string;
    options?: { value: string; text: string }[];
    when?: (t: ThemeConfig) => boolean;
}

export const FONT_OPTIONS = [
    { value: '', text: 'Default (Spotify)' },
    { value: "'Inter', Arial, sans-serif", text: 'Inter' },
    { value: "'Roboto', Arial, sans-serif", text: 'Roboto' },
    { value: "'Noto Sans', Arial, sans-serif", text: 'Noto Sans' },
    { value: "'Open Sans', Arial, sans-serif", text: 'Open Sans' },
    { value: "'Montserrat', Arial, sans-serif", text: 'Montserrat' },
    { value: "'Poppins', Arial, sans-serif", text: 'Poppins' },
    { value: "'Lato', Arial, sans-serif", text: 'Lato' },
    { value: "'Source Sans 3', 'Source Sans Pro', Arial, sans-serif", text: 'Source Sans' },
    { value: "'Nunito Sans', Arial, sans-serif", text: 'Nunito Sans' },
    { value: "'Raleway', Arial, sans-serif", text: 'Raleway' },
    { value: "'Oswald', 'Arial Narrow', Arial, sans-serif", text: 'Oswald' },
    { value: "'Ubuntu', Arial, sans-serif", text: 'Ubuntu' },
    { value: "'Fira Sans', Arial, sans-serif", text: 'Fira Sans' },
    { value: "'IBM Plex Sans', Arial, sans-serif", text: 'IBM Plex Sans' },
    { value: "'Merriweather', Georgia, serif", text: 'Merriweather' },
    { value: "'JetBrains Mono', Consolas, monospace", text: 'JetBrains Mono' },
    { value: "'Fira Code', Consolas, monospace", text: 'Fira Code' },
    { value: "'Cascadia Code', Consolas, monospace", text: 'Cascadia Code' },
    { value: 'Arial', text: 'Arial' },
    { value: 'Helvetica Neue', text: 'Helvetica Neue' },
    { value: 'Georgia', text: 'Georgia' },
    { value: 'Verdana', text: 'Verdana' },
    { value: 'Segoe UI', text: 'Segoe UI' },
    { value: 'Trebuchet MS', text: 'Trebuchet MS' },
    { value: 'Courier New', text: 'Courier New' },
    { value: 'Consolas', text: 'Consolas' },
    { value: 'Impact', text: 'Impact' },
];

export const WEIGHT_OPTIONS = [
    { value: '300', text: 'Light (300)' },
    { value: '400', text: 'Regular (400)' },
    { value: '500', text: 'Medium (500)' },
    { value: '600', text: 'Semi-Bold (600)' },
    { value: '700', text: 'Bold (700)' },
    { value: '800', text: 'Extra-Bold (800)' },
    { value: '900', text: 'Black (900)' },
];

export const SCHEMA: FieldDef[] = [
    { id: 'activeLineColor', label: 'Active line color', type: 'color', section: 'Colors' },
    { id: 'sungLineColor', label: 'Sung line color', type: 'color', section: 'Colors' },
    { id: 'notSungLineColor', label: 'Unsung line color', type: 'color', section: 'Colors' },
    { id: 'activeLineOpacity', label: 'Active line opacity', type: 'slider', section: 'Opacity', min: 0.1, max: 1.0, step: 0.05 },
    { id: 'sungLineOpacity', label: 'Sung line opacity', type: 'slider', section: 'Opacity', min: 0.1, max: 1.0, step: 0.05 },
    { id: 'notSungLineOpacity', label: 'Unsung line opacity', type: 'slider', section: 'Opacity', min: 0.1, max: 1.0, step: 0.05 },
    { id: 'fontFamily', label: 'Font', type: 'dropdown', section: 'Typography', options: [...FONT_OPTIONS, { value: '__custom__', text: 'Custom...' }] },
    { id: 'fontFamily', label: 'Custom font', type: 'text', section: 'Typography', when: (t) => t.fontFamily !== '' && !FONT_OPTIONS.some(o => o.value === t.fontFamily) },
    { id: 'fontWeight', label: 'Font weight', type: 'dropdown', section: 'Typography', options: WEIGHT_OPTIONS },
    { id: 'letterSpacing', label: 'Letter spacing', type: 'slider', section: 'Typography', min: -0.1, max: 0.3, step: 0.01, unit: 'em' },
    { id: 'lineHeight', label: 'Line height', type: 'slider', section: 'Typography', min: 1.0, max: 2.5, step: 0.01 },
    { id: 'scaleActive', label: 'Active line scale', type: 'slider', section: 'Typography', min: 0.95, max: 1.12, step: 0.01, unit: 'x' },
    { id: 'gradientEnabled', label: 'Gradient text', type: 'toggle', section: 'Gradient' },
    { id: 'gradientStartColor', label: 'Gradient start', type: 'color', section: 'Gradient', when: (t) => t.gradientEnabled },
    { id: 'gradientEndColor', label: 'Gradient end', type: 'color', section: 'Gradient', when: (t) => t.gradientEnabled },
    { id: 'gradientAngle', label: 'Gradient angle', type: 'slider', section: 'Gradient', min: 0, max: 360, step: 5, unit: 'deg', when: (t) => t.gradientEnabled },
    { id: 'glowEnabled', label: 'Glow', type: 'toggle', section: 'Glow' },
    { id: 'glowColor', label: 'Glow color', type: 'color', section: 'Glow', when: (t) => t.glowEnabled },
    { id: 'glowIntensity', label: 'Glow intensity', type: 'slider', section: 'Glow', min: 0, max: 15, step: 1, unit: 'px', when: (t) => t.glowEnabled },
    { id: 'activeGlowColor', label: 'Active glow color', type: 'color', section: 'Glow', when: (t) => t.glowEnabled },
    { id: 'activeGlowIntensity', label: 'Active glow intensity', type: 'slider', section: 'Glow', min: 0, max: 15, step: 1, unit: 'px', when: (t) => t.glowEnabled },
    { id: 'bgGlowEnabled', label: 'Background text glow', type: 'toggle', section: 'Glow' },
    { id: 'bgGlowColor', label: 'BG glow color', type: 'color', section: 'Glow', when: (t) => t.bgGlowEnabled },
    { id: 'bgGlowIntensity', label: 'BG glow intensity', type: 'slider', section: 'Glow', min: 0, max: 30, step: 1, unit: 'px', when: (t) => t.bgGlowEnabled },
    { id: 'blurUnsung', label: 'Blur unsung lines', type: 'toggle', section: 'Effects' },
    { id: 'blurAmount', label: 'Blur amount', type: 'slider', section: 'Effects', min: 0, max: 8, step: 0.5, unit: 'px', when: (t) => t.blurUnsung },
    { id: 'blurPreviewLines', label: 'Preview lines', type: 'slider', section: 'Effects', min: 0, max: 5, step: 1, unit: ' lines', when: (t) => t.blurUnsung },
    { id: 'disableHighlight', label: 'Custom word highlight', type: 'toggle', section: 'Effects' },
    { id: 'highlightColor', label: 'Highlight color', type: 'color', section: 'Effects', when: (t) => t.disableHighlight },
    { id: 'popEffect', label: 'Word pop', type: 'toggle', section: 'Effects' },
    { id: 'popScale', label: 'Pop scale', type: 'slider', section: 'Effects', min: 1.0, max: 1.3, step: 0.01, unit: 'x', when: (t) => t.popEffect },
    { id: 'popDuration', label: 'Pop duration', type: 'slider', section: 'Effects', min: 0.1, max: 0.6, step: 0.05, unit: 's', when: (t) => t.popEffect },
    { id: 'waveEffect', label: 'Word wave', type: 'toggle', section: 'Effects' },
    { id: 'waveIntensity', label: 'Wave intensity', type: 'slider', section: 'Effects', min: 1, max: 10, step: 1, unit: 'px', when: (t) => t.waveEffect },
    { id: 'waveSpeed', label: 'Wave speed', type: 'slider', section: 'Effects', min: 0.3, max: 2.0, step: 0.1, unit: 's', when: (t) => t.waveEffect },
    { id: 'scaleInEffect', label: 'Active line scale-in', type: 'toggle', section: 'Effects' },
    { id: 'scaleInFrom', label: 'Scale-in start', type: 'slider', section: 'Effects', min: 0.85, max: 1.05, step: 0.01, unit: 'x', when: (t) => t.scaleInEffect },
    { id: 'scaleInDuration', label: 'Scale-in duration', type: 'slider', section: 'Effects', min: 0.1, max: 1.0, step: 0.05, unit: 's', when: (t) => t.scaleInEffect },
    { id: 'animationSpeed', label: 'Animation speed', type: 'slider', section: 'Effects', min: 0.3, max: 3.0, step: 0.1, unit: 'x' },
    { id: 'pageBgOverlay', label: 'Page background overlay', type: 'toggle', section: 'Background' },
    { id: 'pageBgColor', label: 'Overlay color', type: 'color', section: 'Background', when: (t) => t.pageBgOverlay },
    { id: 'pageBgOpacity', label: 'Overlay opacity', type: 'slider', section: 'Background', min: 0, max: 1, step: 0.05, when: (t) => t.pageBgOverlay },
    { id: 'playerStylingEnabled', label: 'Customize player', type: 'toggle', section: 'Player' },
    { id: 'playerArtRadius', label: 'Album art roundness', type: 'slider', section: 'Player', min: 0, max: 50, step: 1, unit: '%', when: (t) => t.playerStylingEnabled },
    { id: 'playerProgressThickness', label: 'Progress bar thickness', type: 'slider', section: 'Player', min: 0.5, max: 5, step: 0.5, unit: 'x', when: (t) => t.playerStylingEnabled },
    { id: 'playerControlsAnimation', label: 'Animate control buttons', type: 'toggle', section: 'Player', when: (t) => t.playerStylingEnabled },
    { id: 'playerHideShuffle', label: 'Hide shuffle button', type: 'toggle', section: 'Player', when: (t) => t.playerStylingEnabled },
    { id: 'playerHideRepeat', label: 'Hide repeat button', type: 'toggle', section: 'Player', when: (t) => t.playerStylingEnabled },
    { id: 'playerHideLike', label: 'Hide like (heart) button', type: 'toggle', section: 'Player', when: (t) => t.playerStylingEnabled },
    { id: 'videoBgEnabled', label: 'Video background', type: 'toggle', section: 'Video Background' },
    { id: 'videoBgUrl', label: 'Video URL', type: 'text', section: 'Video Background', placeholder: 'https://... .mp4 / .webm', when: (t) => t.videoBgEnabled },
    { id: 'videoBgBlur', label: 'Video blur', type: 'slider', section: 'Video Background', min: 0, max: 30, step: 1, unit: 'px', when: (t) => t.videoBgEnabled },
    { id: 'videoBgDim', label: 'Video dim', type: 'slider', section: 'Video Background', min: 0, max: 1, step: 0.05, when: (t) => t.videoBgEnabled },
    { id: 'sltStylingEnabled', label: 'Translation styling (SLT)', type: 'toggle', section: 'Translation' },
    { id: 'sltTranslationOpacity', label: 'Translation opacity', type: 'slider', section: 'Translation', min: 0.1, max: 1.0, step: 0.05, when: (t) => t.sltStylingEnabled },
    { id: 'sltTranslationFontSize', label: 'Translation font size', type: 'slider', section: 'Translation', min: 0.5, max: 2.0, step: 0.05, unit: 'x', when: (t) => t.sltStylingEnabled },
];

let liveContainer: HTMLElement | null = null;

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function notify(message: string, isError = false): void {
    if (typeof Spicetify !== 'undefined' && Spicetify.showNotification) {
        Spicetify.showNotification(message, isError);
    }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    if (hex.startsWith('rgb')) {
        const m = hex.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (m) return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
    }
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return {
        r: parseInt(h.substring(0, 2), 16) || 0,
        g: parseInt(h.substring(2, 4), 16) || 0,
        b: parseInt(h.substring(4, 6), 16) || 0,
    };
}

function renderPreview(host: HTMLElement, theme: Partial<ThemeConfig>): void {
    const t = { ...DEFAULT_THEME, ...theme } as ThemeConfig;
    host.innerHTML = `
        <div class="st-prv-line st-prv-sung">Waiting for this moment</div>
        <div class="st-prv-line st-prv-active">Feel the rhythm in my heartbeat</div>
        <div class="st-prv-line st-prv-unsung">Dancing underneath the starlight</div>
    `;

    const fontFamily = t.fontFamily || 'inherit';
    const fontWeight = String(t.fontWeight || 700);
    const letterSpacing = `${t.letterSpacing}em`;
    const lineHeight = String(t.lineHeight);

    const lines = host.querySelectorAll<HTMLElement>('.st-prv-line');
    lines.forEach(line => {
        line.style.fontFamily = fontFamily;
        line.style.fontWeight = fontWeight;
        line.style.letterSpacing = letterSpacing;
        line.style.lineHeight = lineHeight;
        line.style.background = '';
        line.style.backgroundClip = '';
        line.style.webkitBackgroundClip = '';
        (line.style as any).webkitTextFillColor = '';
        line.style.color = '';
        line.style.opacity = '';
        line.style.filter = '';
        line.style.transform = '';
        line.style.textShadow = '';
    });

    const active = host.querySelector<HTMLElement>('.st-prv-active');
    const sung = host.querySelector<HTMLElement>('.st-prv-sung');
    const unsung = host.querySelector<HTMLElement>('.st-prv-unsung');

    if (active) {
        active.style.opacity = String(t.activeLineOpacity);
        active.style.transform = `scale(${t.scaleActive})`;
        if (t.gradientEnabled) {
            active.style.background = `linear-gradient(${t.gradientAngle}deg, ${t.gradientStartColor}, ${t.gradientEndColor})`;
            active.style.backgroundClip = 'text';
            active.style.webkitBackgroundClip = 'text';
            (active.style as any).webkitTextFillColor = 'transparent';
        } else {
            active.style.color = t.activeLineColor;
        }
        if (t.glowEnabled) {
            const c = hexToRgb(t.activeGlowColor);
            active.style.textShadow = `0 0 ${t.activeGlowIntensity}px rgba(${c.r}, ${c.g}, ${c.b}, 0.85)`;
        }
        if (t.bgGlowEnabled) {
            const c = hexToRgb(t.bgGlowColor);
            const existing = active.style.textShadow;
            const bg = `0 0 ${t.bgGlowIntensity}px rgba(${c.r}, ${c.g}, ${c.b}, 1)`;
            active.style.textShadow = existing ? `${existing}, ${bg}` : bg;
        }
    }
    if (sung) {
        sung.style.opacity = String(t.sungLineOpacity);
        if (t.gradientEnabled) {
            sung.style.background = `linear-gradient(${t.gradientAngle}deg, ${t.gradientStartColor}, ${t.gradientEndColor})`;
            sung.style.backgroundClip = 'text';
            sung.style.webkitBackgroundClip = 'text';
            (sung.style as any).webkitTextFillColor = 'transparent';
        } else {
            sung.style.color = t.sungLineColor;
        }
        if (t.glowEnabled) {
            const c = hexToRgb(t.glowColor);
            sung.style.textShadow = `0 0 ${t.glowIntensity}px rgba(${c.r}, ${c.g}, ${c.b}, 0.6)`;
        }
    }
    if (unsung) {
        unsung.style.opacity = String(t.notSungLineOpacity);
        if (t.gradientEnabled) {
            unsung.style.background = `linear-gradient(${t.gradientAngle}deg, ${t.gradientStartColor}, ${t.gradientEndColor})`;
            unsung.style.backgroundClip = 'text';
            unsung.style.webkitBackgroundClip = 'text';
            (unsung.style as any).webkitTextFillColor = 'transparent';
        } else {
            unsung.style.color = t.notSungLineColor;
        }
        if (t.blurUnsung && t.blurPreviewLines === 0) {
            unsung.style.filter = `blur(${t.blurAmount}px)`;
        }
        if (t.glowEnabled) {
            const c = hexToRgb(t.glowColor);
            const existing = unsung.style.textShadow;
            const sh = `0 0 ${t.glowIntensity}px rgba(${c.r}, ${c.g}, ${c.b}, 0.45)`;
            unsung.style.textShadow = existing ? `${existing}, ${sh}` : sh;
        }
    }

    if (t.pageBgOverlay) {
        const c = hexToRgb(t.pageBgColor);
        host.style.background = `linear-gradient(145deg, rgba(${c.r}, ${c.g}, ${c.b}, ${t.pageBgOpacity}), rgba(8, 8, 10, 0.95))`;
    } else {
        host.style.background = '';
    }
}

function refreshPreview(): void {
    const preview = liveContainer?.querySelector<HTMLElement>('.st-modal-preview');
    if (preview) renderPreview(preview, themeState.activeTheme);
}

function liveUpdate<K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]): void {
    updateThemeProperty(key, value);
    injectThemeStyles();
    refreshPreview();
    refreshCustomizeVisibility();
}

function refreshCustomizeVisibility(): void {
    const fields = liveContainer?.querySelectorAll<HTMLElement>('[data-st-when]');
    fields?.forEach(el => {
        const idx = parseInt(el.dataset.stWhen || '-1', 10);
        const def = SCHEMA[idx];
        if (!def?.when) return;
        el.style.display = def.when(themeState.activeTheme) ? '' : 'none';
    });
}

function formatFieldValue(value: unknown, unit = ''): string {
    if (typeof value === 'number') {
        const rounded = Math.round(value * 100) / 100;
        return `${rounded}${unit}`;
    }
    return `${value ?? ''}${unit}`;
}

function buildField(def: FieldDef, index: number): HTMLElement {
    const row = document.createElement('div');
    row.className = `st-m-field st-m-field-${def.type}`;
    if (def.when) {
        row.dataset.stWhen = String(index);
        row.style.display = def.when(themeState.activeTheme) ? '' : 'none';
    }

    const label = document.createElement('label');
    label.className = 'st-m-field-label';
    label.textContent = def.label;
    row.appendChild(label);

    const control = document.createElement('div');
    control.className = 'st-m-field-control';
    row.appendChild(control);

    const cur = themeState.activeTheme[def.id];

    switch (def.type) {
        case 'toggle': {
            const wrap = document.createElement('label');
            wrap.className = 'st-m-toggle';
            wrap.innerHTML = `<input type="checkbox" ${cur ? 'checked' : ''}><span class="st-m-toggle-slider"></span>`;
            const input = wrap.querySelector('input') as HTMLInputElement;
            input.addEventListener('change', () => liveUpdate(def.id, input.checked as any));
            control.appendChild(wrap);
            break;
        }
        case 'color': {
            const input = document.createElement('input');
            input.type = 'color';
            input.className = 'st-m-color';
            const v = String(cur || '#ffffff');
            input.value = v.startsWith('#') ? v : '#ffffff';
            input.addEventListener('input', () => liveUpdate(def.id, input.value as any));
            control.appendChild(input);
            break;
        }
        case 'slider': {
            const wrap = document.createElement('div');
            wrap.className = 'st-m-slider-wrap';
            const input = document.createElement('input');
            input.type = 'range';
            input.className = 'st-m-slider';
            input.min = String(def.min ?? 0);
            input.max = String(def.max ?? 1);
            input.step = String(def.step ?? 0.05);
            input.value = String(cur);
            const value = document.createElement('span');
            value.className = 'st-m-slider-value';
            value.textContent = formatFieldValue(cur, def.unit);
            input.addEventListener('input', () => {
                const v = parseFloat(input.value);
                value.textContent = formatFieldValue(v, def.unit);
                liveUpdate(def.id, v as any);
            });
            wrap.appendChild(input);
            wrap.appendChild(value);
            control.appendChild(wrap);
            break;
        }
        case 'dropdown': {
            const select = document.createElement('select');
            select.className = 'st-m-select';
            const opts = def.options || [];

            if (def.id === 'fontFamily' && def.options?.some(o => o.value === '__custom__')) {
                const isCustom = !FONT_OPTIONS.some(o => o.value === cur);
                const currentVal = isCustom && cur !== '' ? '__custom__' : (cur as string);
                opts.forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.value;
                    opt.textContent = o.text;
                    if (o.value === currentVal) opt.selected = true;
                    select.appendChild(opt);
                });
                select.addEventListener('change', () => {
                    if (select.value === '__custom__') {
                        liveUpdate(def.id, 'Custom Font' as any);
                    } else {
                        liveUpdate(def.id, select.value as any);
                    }
                });
            } else {
                opts.forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.value;
                    opt.textContent = o.text;
                    if (String(cur) === o.value) opt.selected = true;
                    select.appendChild(opt);
                });
                select.addEventListener('change', () => {
                    const v: any = def.id === 'fontWeight' ? parseInt(select.value, 10) : select.value;
                    liveUpdate(def.id, v);
                });
            }
            control.appendChild(select);
            break;
        }
        case 'text': {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'st-m-text';
            input.value = String(cur || '');
            input.placeholder = def.placeholder || 'Enter font name';
            input.addEventListener('change', () => liveUpdate(def.id, input.value as any));
            control.appendChild(input);
            break;
        }
    }

    return row;
}

function buildCustomizeTab(): HTMLElement {
    const tab = document.createElement('div');
    tab.className = 'st-m-tab-content st-m-customize-grid';

    const sections = new Map<string, HTMLElement>();
    SCHEMA.forEach((def, i) => {
        let section = sections.get(def.section);
        if (!section) {
            section = document.createElement('div');
            section.className = 'st-m-section';
            const header = document.createElement('div');
            header.className = 'st-m-section-title';
            header.textContent = def.section;
            section.appendChild(header);
            tab.appendChild(section);
            sections.set(def.section, section);
        }
        section.appendChild(buildField(def, i));
    });

    return tab;
}

function buildPresetsTab(refresh: () => void): HTMLElement {
    const tab = document.createElement('div');
    tab.className = 'st-m-tab-content';

    const grid = document.createElement('div');
    grid.className = 'st-m-preset-grid';

    const all = getAllPresets();
    all.forEach(preset => {
        const card = document.createElement('div');
        const isActive = preset.name === themeState.activePresetName;
        card.className = `st-m-preset-card${isActive ? ' active' : ''}`;
        card.title = preset.description;

        const preview = document.createElement('div');
        preview.className = 'st-m-preset-preview';
        renderPreview(preview, preset.config);

        const meta = document.createElement('div');
        meta.className = 'st-m-preset-meta';
        const isCustom = !BUILTIN_PRESETS.some(b => b.name === preset.name);
        meta.innerHTML = `
            <div class="st-m-preset-name">${escapeHtml(preset.name)}${isCustom ? ' <span class="st-m-preset-tag">custom</span>' : ''}</div>
            <div class="st-m-preset-desc">${escapeHtml(preset.description || '')}</div>
        `;

        const actions = document.createElement('div');
        actions.className = 'st-m-preset-actions';

        const apply = document.createElement('button');
        apply.className = 'st-m-btn st-m-btn-primary';
        apply.textContent = isActive ? 'Active' : 'Apply';
        apply.disabled = isActive;
        apply.addEventListener('click', () => {
            applyPreset(preset);
            injectThemeStyles();
            refresh();
        });
        actions.appendChild(apply);

        if (isCustom) {
            const del = document.createElement('button');
            del.className = 'st-m-btn st-m-btn-danger';
            del.textContent = 'Delete';
            del.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteCustomPreset(preset.name);
                refresh();
            });
            actions.appendChild(del);
        }

        card.appendChild(preview);
        card.appendChild(meta);
        card.appendChild(actions);
        grid.appendChild(card);
    });

    const saveBox = document.createElement('div');
    saveBox.className = 'st-m-save-preset';
    saveBox.innerHTML = `
        <div class="st-m-section-title">Save current theme</div>
        <div class="st-m-save-row">
            <input type="text" class="st-m-text" id="st-m-save-name" placeholder="Preset name" maxlength="60">
            <input type="text" class="st-m-text" id="st-m-save-desc" placeholder="Description (optional)" maxlength="200">
            <button class="st-m-btn st-m-btn-primary" id="st-m-save-btn">Save</button>
        </div>
    `;

    const nameInput = saveBox.querySelector('#st-m-save-name') as HTMLInputElement;
    const descInput = saveBox.querySelector('#st-m-save-desc') as HTMLInputElement;
    const saveBtn = saveBox.querySelector('#st-m-save-btn') as HTMLButtonElement;
    saveBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) {
            notify('Enter a preset name', true);
            nameInput.focus();
            return;
        }
        saveCustomPreset(name, descInput.value.trim());
        notify(`Preset "${name}" saved`);
        refresh();
    });

    tab.appendChild(grid);
    tab.appendChild(saveBox);
    return tab;
}

function buildMarketplaceTab(refresh: () => void): HTMLElement {
    const tab = document.createElement('div');
    tab.className = 'st-m-tab-content';

    tab.innerHTML = `
        <div class="st-m-mp-toolbar">
            <input type="text" class="st-m-text st-m-mp-search" placeholder="Search themes by name, author or description...">
            <div class="st-m-mp-sort">
                <button class="st-m-chip active" data-sort="newest">Newest</button>
                <button class="st-m-chip" data-sort="popular">Popular</button>
                <button class="st-m-chip" data-sort="featured">Featured</button>
            </div>
        </div>
        <div class="st-m-mp-status"></div>
        <div class="st-m-mp-grid"></div>
        <div class="st-m-mp-pagination" style="display: none;">
            <button class="st-m-btn" id="st-m-mp-prev">Prev</button>
            <span class="st-m-mp-page-info"></span>
            <button class="st-m-btn" id="st-m-mp-next">Next</button>
        </div>
    `;

    const search = tab.querySelector('.st-m-mp-search') as HTMLInputElement;
    const grid = tab.querySelector('.st-m-mp-grid') as HTMLElement;
    const status = tab.querySelector('.st-m-mp-status') as HTMLElement;
    const pagination = tab.querySelector('.st-m-mp-pagination') as HTMLElement;
    const pageInfo = tab.querySelector('.st-m-mp-page-info') as HTMLElement;
    const prev = tab.querySelector('#st-m-mp-prev') as HTMLButtonElement;
    const next = tab.querySelector('#st-m-mp-next') as HTMLButtonElement;
    const sortChips = tab.querySelectorAll<HTMLButtonElement>('.st-m-chip[data-sort]');

    let page = 1;
    let sort: Marketplace.MarketplaceSort = 'newest';
    let query = '';
    let totalPages = 1;
    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    function renderCards(themes: Marketplace.MarketplaceTheme[]): void {
        grid.innerHTML = '';
        themes.forEach(t => {
            const card = document.createElement('div');
            card.className = 'st-m-mp-card';

            const preview = document.createElement('div');
            preview.className = 'st-m-mp-preview';
            renderPreview(preview, t.theme);

            const body = document.createElement('div');
            body.className = 'st-m-mp-body';
            body.innerHTML = `
                <div class="st-m-mp-name">${escapeHtml(t.name)}${t.featured ? ' <span class="st-m-mp-featured">FEATURED</span>' : ''}</div>
                <div class="st-m-mp-author">by ${escapeHtml(t.author)}</div>
                ${t.description ? `<div class="st-m-mp-desc">${escapeHtml(t.description)}</div>` : ''}
                <div class="st-m-mp-stats"><span>${t.downloads || 0} downloads</span></div>
            `;

            const actions = document.createElement('div');
            actions.className = 'st-m-mp-actions';

            const apply = document.createElement('button');
            apply.className = 'st-m-btn st-m-btn-primary';
            apply.textContent = 'Apply';
            apply.addEventListener('click', async () => {
                apply.disabled = true;
                apply.textContent = 'Applying...';
                try {
                    const data = await Marketplace.downloadTheme(t.id);
                    themeState.activeTheme = { ...DEFAULT_THEME, ...data.theme };
                    themeState.activePresetName = t.name;
                    saveThemeState();
                    injectThemeStyles();
                    refresh();
                    notify(`Applied "${t.name}" by ${t.author}`);
                } catch (e) {
                    notify(`Failed to apply: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
                    apply.disabled = false;
                    apply.textContent = 'Apply';
                }
            });

            const savePreset = document.createElement('button');
            savePreset.className = 'st-m-btn';
            savePreset.textContent = 'Save as preset';
            savePreset.addEventListener('click', async () => {
                savePreset.disabled = true;
                try {
                    const data = await Marketplace.downloadTheme(t.id);
                    const presetName = t.name;
                    const merged: ThemeConfig = { ...DEFAULT_THEME, ...data.theme };
                    const preset: ThemePreset = {
                        name: presetName,
                        description: t.description || `By ${t.author}`,
                        config: merged,
                    };
                    const existing = themeState.customPresets.findIndex(p => p.name === presetName);
                    if (existing >= 0) {
                        themeState.customPresets[existing] = preset;
                    } else {
                        themeState.customPresets.push(preset);
                    }
                    saveThemeState();
                    notify(`Saved preset "${presetName}"`);
                } catch (e) {
                    notify(`Failed to save: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
                } finally {
                    savePreset.disabled = false;
                }
            });

            actions.appendChild(apply);
            actions.appendChild(savePreset);

            card.appendChild(preview);
            card.appendChild(body);
            card.appendChild(actions);
            grid.appendChild(card);
        });
    }

    async function load(): Promise<void> {
        status.textContent = 'Loading themes...';
        status.style.display = '';
        grid.innerHTML = '';
        pagination.style.display = 'none';
        try {
            const res = await Marketplace.listThemes({ page, sort, query });
            status.style.display = 'none';
            if (!res.themes || res.themes.length === 0) {
                status.textContent = 'No themes found.';
                status.style.display = '';
                return;
            }
            renderCards(res.themes);
            totalPages = res.totalPages;
            if (totalPages > 1) {
                pagination.style.display = '';
                pageInfo.textContent = `Page ${res.page} of ${res.totalPages}`;
                prev.disabled = res.page <= 1;
                next.disabled = res.page >= res.totalPages;
            }
        } catch (e) {
            status.textContent = `Failed to load marketplace: ${e instanceof Error ? e.message : 'Unknown error'}. Make sure you're online.`;
        }
    }

    sortChips.forEach(chip => {
        chip.addEventListener('click', () => {
            sortChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            sort = (chip.dataset.sort || 'newest') as Marketplace.MarketplaceSort;
            page = 1;
            load();
        });
    });

    search.addEventListener('input', () => {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            query = search.value.trim();
            page = 1;
            load();
        }, 350);
    });

    prev.addEventListener('click', () => { if (page > 1) { page--; load(); } });
    next.addEventListener('click', () => { if (page < totalPages) { page++; load(); } });

    load();
    return tab;
}

function buildAboutTab(): HTMLElement {
    const tab = document.createElement('div');
    tab.className = 'st-m-tab-content';

    const version = getCurrentVersion().text;

    tab.innerHTML = `
        <div class="st-m-section">
            <div class="st-m-about-hero">
                <div class="st-m-about-title">Spicy Themes</div>
                <div class="st-m-about-version">v${escapeHtml(version)}</div>
            </div>
            <div class="st-m-about-text">Customize Spicy Lyrics with colors, glow, gradients, blur, fonts and more.</div>
        </div>
        <div class="st-m-section">
            <div class="st-m-section-title">Configuration</div>
            <div class="st-m-about-actions">
                <button class="st-m-btn" id="st-m-export">Export theme as JSON</button>
                <button class="st-m-btn" id="st-m-import">Import theme JSON</button>
                <button class="st-m-btn st-m-btn-danger" id="st-m-reset">Reset to default</button>
            </div>
        </div>
        <div class="st-m-section">
            <div class="st-m-section-title">Updates</div>
            <div class="st-m-about-actions">
                <button class="st-m-btn" id="st-m-check">Check for updates</button>
                <label class="st-m-toggle-row">
                    <span>Dev channel</span>
                    <label class="st-m-toggle"><input type="checkbox" id="st-m-dev-channel" ${isDevChannel() ? 'checked' : ''}><span class="st-m-toggle-slider"></span></label>
                </label>
            </div>
        </div>
        <div class="st-m-section">
            <div class="st-m-about-links">
                <a href="https://github.com/7xeh/SpicyThemes" target="_blank" rel="noopener noreferrer">GitHub</a>
                <a href="https://7xeh.dev/apps/spicythemes/marketplace/" target="_blank" rel="noopener noreferrer">Marketplace</a>
                <a href="https://7xeh.dev/apps/spicythemes/create/" target="_blank" rel="noopener noreferrer">Theme Creator</a>
            </div>
        </div>
    `;

    const exportBtn = tab.querySelector('#st-m-export') as HTMLButtonElement;
    exportBtn.addEventListener('click', () => {
        const data = JSON.stringify({
            theme: themeState.activeTheme,
            presets: themeState.customPresets,
            presetName: themeState.activePresetName,
        }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'spicy-themes-config.json';
        a.click();
        URL.revokeObjectURL(url);
        notify('Theme exported');
    });

    const importBtn = tab.querySelector('#st-m-import') as HTMLButtonElement;
    importBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(reader.result as string);
                    if (data.theme) {
                        themeState.activeTheme = { ...DEFAULT_THEME, ...data.theme };
                    }
                    if (Array.isArray(data.presets)) {
                        themeState.customPresets = data.presets;
                    }
                    if (data.presetName) {
                        themeState.activePresetName = data.presetName;
                    }
                    saveThemeState();
                    injectThemeStyles();
                    refreshPreview();
                    notify('Theme imported');
                } catch {
                    notify('Invalid theme file', true);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    });

    const resetBtn = tab.querySelector('#st-m-reset') as HTMLButtonElement;
    resetBtn.addEventListener('click', () => {
        applyPreset(BUILTIN_PRESETS.find(p => p.name === 'Default') || BUILTIN_PRESETS[0]);
        injectThemeStyles();
        refreshPreview();
        notify('Theme reset to default');
    });

    const checkBtn = tab.querySelector('#st-m-check') as HTMLButtonElement;
    checkBtn.addEventListener('click', async () => {
        checkBtn.disabled = true;
        checkBtn.textContent = 'Checking...';
        try {
            const info = await getUpdateInfo();
            if (!info) throw new Error('No metadata');
            if (info.hasUpdate) {
                notify(`Update available: v${info.latestVersion}! Updating...`);
                await checkForUpdates(true);
            } else {
                let hotfix = false;
                try {
                    const metadata = (window as any)._spicy_themes_metadata;
                    if (metadata?.utils?.runHotfixCheck) {
                        hotfix = await metadata.utils.runHotfixCheck(true);
                    }
                } catch (_) {}
                if (hotfix) {
                    notify('Hotfix found! Reloading...');
                } else {
                    notify("You're on the latest version");
                }
            }
        } catch {
            notify('Failed to check for updates', true);
        } finally {
            checkBtn.disabled = false;
            checkBtn.textContent = 'Check for updates';
        }
    });

    const devToggle = tab.querySelector('#st-m-dev-channel') as HTMLInputElement;
    devToggle.addEventListener('change', () => {
        if (devToggle.checked) {
            storage.set('dev-channel', 'ST_D3V_7xeh');
            notify('Dev channel enabled. Reload to apply');
        } else {
            storage.remove('dev-channel');
            notify('Dev channel disabled. Reload to apply');
        }
    });

    return tab;
}

export function createSettingsModal(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'st-modal-root';
    liveContainer = container;

    const enabledHeader = document.createElement('div');
    enabledHeader.className = 'st-m-enabled-bar';
    enabledHeader.innerHTML = `
        <div class="st-m-enabled-text">
            <span class="st-m-enabled-title">Theming</span>
            <span class="st-m-enabled-sub">Toggle themes on or off without losing your settings.</span>
        </div>
        <label class="st-m-toggle">
            <input type="checkbox" id="st-m-enabled-toggle" ${themeState.isEnabled ? 'checked' : ''}>
            <span class="st-m-toggle-slider"></span>
        </label>
    `;
    const enabledInput = enabledHeader.querySelector('#st-m-enabled-toggle') as HTMLInputElement;
    enabledInput.addEventListener('change', () => {
        themeState.isEnabled = enabledInput.checked;
        saveThemeState();
        injectThemeStyles();
    });

    const tabBar = document.createElement('div');
    tabBar.className = 'st-m-tabbar';

    const tabContent = document.createElement('div');
    tabContent.className = 'st-m-tab-host';

    const tabs: { id: string; label: string; render: () => HTMLElement }[] = [
        { id: 'customize', label: 'Customize', render: () => buildCustomizeTab() },
        { id: 'presets', label: 'Presets', render: () => buildPresetsTab(rerender) },
        { id: 'marketplace', label: 'Marketplace', render: () => buildMarketplaceTab(rerender) },
        { id: 'about', label: 'About', render: () => buildAboutTab() },
    ];
    let activeTab = tabs[0].id;

    function rerender(): void {
        const current = tabs.find(t => t.id === activeTab) || tabs[0];
        tabContent.innerHTML = '';
        tabContent.appendChild(current.render());
    }

    tabs.forEach(t => {
        const btn = document.createElement('button');
        btn.className = `st-m-tab${t.id === activeTab ? ' active' : ''}`;
        btn.textContent = t.label;
        btn.addEventListener('click', () => {
            activeTab = t.id;
            tabBar.querySelectorAll('.st-m-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            rerender();
        });
        tabBar.appendChild(btn);
    });

    container.appendChild(enabledHeader);
    container.appendChild(tabBar);
    container.appendChild(tabContent);

    rerender();

    return container;
}
