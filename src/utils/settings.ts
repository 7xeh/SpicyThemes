import { storage } from './storage';
import { themeState, saveThemeState, applyPreset, getAllPresets, saveCustomPreset, deleteCustomPreset, updateThemeProperty, ThemeConfig, DEFAULT_THEME, BUILTIN_PRESETS } from './state';
import { injectThemeStyles } from './themeEngine';
import { debug, isDebugEnabled, setDebugMode } from './debug';
import { Icons } from './icons';

const SETTINGS_ID = 'spicy-themes-settings';

function createColorRow(id: string, label: string, currentValue: string, onChange: (value: string) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <div class="st-inline-group">
                <input type="color" id="${id}" class="st-color-swatch" value="${currentValue.startsWith('#') ? currentValue : '#ffffff'}">
            </div>
        </div>
    `;
    const input = row.querySelector('input') as HTMLInputElement;
    input?.addEventListener('input', () => {
        onChange(input.value);
        injectThemeStyles();
    });
    return row;
}

function createSliderRow(id: string, label: string, min: number, max: number, step: number, currentValue: number, unit: string, onChange: (value: number) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <div class="st-inline-group">
                <input type="range" id="${id}" class="st-slider" min="${min}" max="${max}" step="${step}" value="${currentValue}">
                <span class="st-value-display" id="${id}-value">${currentValue}${unit}</span>
            </div>
        </div>
    `;
    const input = row.querySelector('input[type="range"]') as HTMLInputElement;
    const display = row.querySelector('.st-value-display') as HTMLElement;
    input?.addEventListener('input', () => {
        const val = parseFloat(input.value);
        if (display) display.textContent = `${val}${unit}`;
        onChange(val);
        injectThemeStyles();
    });
    return row;
}

function createToggleRow(id: string, label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <label class="x-toggle-wrapper">
                <input id="${id}" class="x-toggle-input" type="checkbox" ${checked ? 'checked' : ''}>
                <span class="x-toggle-indicatorWrapper">
                    <span class="x-toggle-indicator"></span>
                </span>
            </label>
        </div>
    `;
    const input = row.querySelector('input') as HTMLInputElement;
    input?.addEventListener('change', () => {
        onChange(input.checked);
        injectThemeStyles();
    });
    return row;
}

function createDropdownRow(id: string, label: string, options: { value: string; text: string }[], currentValue: string, onChange: (value: string) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <span>
                <select class="main-dropDown-dropDown" id="${id}">
                    ${options.map(opt => `<option value="${opt.value}" ${opt.value === currentValue ? 'selected' : ''}>${opt.text}</option>`).join('')}
                </select>
            </span>
        </div>
    `;
    const select = row.querySelector('select') as HTMLSelectElement;
    select?.addEventListener('change', () => {
        onChange(select.value);
        injectThemeStyles();
    });
    return row;
}

function createButtonRow(id: string, label: string, buttonText: string, onClick: () => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <button id="${id}" class="Button-sc-y0gtbx-0 Button-buttonSecondary-small-useBrowserDefaultFocusStyle encore-text-body-small-bold e-91000-button--small" data-encore-id="buttonSecondary" type="button">${buttonText}</button>
        </div>
    `;
    const button = row.querySelector('button') as HTMLButtonElement;
    button?.addEventListener('click', onClick);
    return row;
}

function createTextInputRow(id: string, label: string, currentValue: string, placeholder: string, onChange: (value: string) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <input type="text" id="${id}" class="main-dropDown-dropDown" style="width: 200px;" value="${currentValue}" placeholder="${placeholder}">
        </div>
    `;
    const input = row.querySelector('input') as HTMLInputElement;
    input?.addEventListener('change', () => {
        onChange(input.value);
        injectThemeStyles();
    });
    return row;
}

function createSectionHeader(text: string): HTMLElement {
    const header = document.createElement('div');
    header.className = 'st-section-header';
    header.textContent = text;
    return header;
}

function createPresetSelector(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'st-preset-container';
    container.className = 'x-settings-row';
    container.style.cssText = 'flex-direction: column; align-items: flex-start;';

    const label = document.createElement('label');
    label.className = 'e-91000-text encore-text-body-small encore-internal-color-text-subdued';
    label.textContent = 'Theme Presets';
    label.style.marginBottom = '8px';
    container.appendChild(label);

    const presetsWrap = document.createElement('div');
    presetsWrap.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';

    const allPresets = getAllPresets();
    for (const preset of allPresets) {
        const card = document.createElement('span');
        card.className = `st-preset-card${preset.name === themeState.activePresetName ? ' active' : ''}`;
        card.title = preset.description;

        let cardHTML = preset.name;
        const isCustom = !BUILTIN_PRESETS.some(b => b.name === preset.name);
        if (isCustom) {
            cardHTML += `<span class="st-preset-delete" title="Delete preset">\u00D7</span>`;
        }
        card.innerHTML = cardHTML;

        card.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).classList.contains('st-preset-delete')) {
                deleteCustomPreset(preset.name);
                refreshSettings();
                injectThemeStyles();
                return;
            }
            applyPreset(preset);
            injectThemeStyles();
            refreshSettings();
        });
        presetsWrap.appendChild(card);
    }

    container.appendChild(presetsWrap);
    return container;
}

function refreshSettings(): void {
    const existing = document.getElementById(SETTINGS_ID);
    if (existing) {
        const parent = existing.parentElement;
        const nextSibling = existing.nextElementSibling;
        existing.remove();
        const newSection = createSettingsSection();
        if (parent) {
            if (nextSibling) {
                parent.insertBefore(newSection, nextSibling);
            } else {
                parent.appendChild(newSection);
            }
        }
    }
}

function createSettingsSection(): HTMLElement {
    const section = document.createElement('div');
    section.id = SETTINGS_ID;
    section.className = 'spicy-themes-settings';
    section.innerHTML = `
        <div class="x-settings-section">
            <h2 class="e-91000-text encore-text-body-medium-bold encore-internal-color-text-base">Spicy Themes</h2>
        </div>
    `;

    const content = section.querySelector('.x-settings-section') as HTMLElement;

    // Enable/Disable toggle
    content.appendChild(createToggleRow(
        'st-settings.enabled',
        'Enable Spicy Themes',
        themeState.isEnabled,
        (checked) => {
            themeState.isEnabled = checked;
            saveThemeState();
        }
    ));

    // Preset selector
    content.appendChild(createPresetSelector());

    // Save as preset
    content.appendChild(createButtonRow(
        'st-settings.save-preset',
        'Save Current as Preset',
        'Save Preset',
        () => {
            const name = prompt('Enter preset name:');
            if (name && name.trim()) {
                const desc = prompt('Enter description (optional):') || '';
                saveCustomPreset(name.trim(), desc.trim());
                refreshSettings();
                if (Spicetify.showNotification) {
                    Spicetify.showNotification(`Preset "${name.trim()}" saved!`);
                }
            }
        }
    ));

    // --- Colors Section ---
    content.appendChild(createSectionHeader('Colors'));

    content.appendChild(createColorRow(
        'st-settings.active-line-color',
        'Active Line Color',
        themeState.activeTheme.activeLineColor,
        (v) => updateThemeProperty('activeLineColor', v)
    ));

    content.appendChild(createColorRow(
        'st-settings.sung-line-color',
        'Sung Line Color',
        themeState.activeTheme.sungLineColor,
        (v) => updateThemeProperty('sungLineColor', v)
    ));

    content.appendChild(createColorRow(
        'st-settings.notsungline-color',
        'Unsung Line Color',
        themeState.activeTheme.notSungLineColor,
        (v) => updateThemeProperty('notSungLineColor', v)
    ));

    // --- Opacity Section ---
    content.appendChild(createSectionHeader('Opacity'));

    content.appendChild(createSliderRow(
        'st-settings.active-opacity',
        'Active Line Opacity',
        0.1, 1.0, 0.05,
        themeState.activeTheme.activeLineOpacity,
        '',
        (v) => updateThemeProperty('activeLineOpacity', v)
    ));

    content.appendChild(createSliderRow(
        'st-settings.sung-opacity',
        'Sung Line Opacity',
        0.1, 1.0, 0.05,
        themeState.activeTheme.sungLineOpacity,
        '',
        (v) => updateThemeProperty('sungLineOpacity', v)
    ));

    content.appendChild(createSliderRow(
        'st-settings.notsungopacity',
        'Unsung Line Opacity',
        0.1, 1.0, 0.05,
        themeState.activeTheme.notSungLineOpacity,
        '',
        (v) => updateThemeProperty('notSungLineOpacity', v)
    ));

    // --- Glow Section ---
    content.appendChild(createSectionHeader('Glow'));

    content.appendChild(createToggleRow(
        'st-settings.glow-enabled',
        'Enable Glow Effect',
        themeState.activeTheme.glowEnabled,
        (v) => updateThemeProperty('glowEnabled', v)
    ));

    content.appendChild(createColorRow(
        'st-settings.glow-color',
        'Glow Color',
        themeState.activeTheme.glowColor,
        (v) => updateThemeProperty('glowColor', v)
    ));

    content.appendChild(createSliderRow(
        'st-settings.glow-intensity',
        'Glow Intensity',
        0, 20, 1,
        themeState.activeTheme.glowIntensity,
        'px',
        (v) => updateThemeProperty('glowIntensity', v)
    ));

    content.appendChild(createColorRow(
        'st-settings.active-glow-color',
        'Active Line Glow Color',
        themeState.activeTheme.activeGlowColor,
        (v) => updateThemeProperty('activeGlowColor', v)
    ));

    content.appendChild(createSliderRow(
        'st-settings.active-glow-intensity',
        'Active Glow Intensity',
        0, 30, 1,
        themeState.activeTheme.activeGlowIntensity,
        'px',
        (v) => updateThemeProperty('activeGlowIntensity', v)
    ));

    // --- Font Section ---
    content.appendChild(createSectionHeader('Font'));

    content.appendChild(createTextInputRow(
        'st-settings.font-family',
        'Font Family',
        themeState.activeTheme.fontFamily,
        'Leave empty for default',
        (v) => updateThemeProperty('fontFamily', v)
    ));

    content.appendChild(createDropdownRow(
        'st-settings.font-weight',
        'Font Weight',
        [
            { value: '300', text: 'Light (300)' },
            { value: '400', text: 'Regular (400)' },
            { value: '500', text: 'Medium (500)' },
            { value: '600', text: 'Semi-Bold (600)' },
            { value: '700', text: 'Bold (700)' },
            { value: '800', text: 'Extra-Bold (800)' },
            { value: '900', text: 'Black (900)' },
        ],
        String(themeState.activeTheme.fontWeight),
        (v) => updateThemeProperty('fontWeight', parseInt(v, 10))
    ));

    content.appendChild(createSliderRow(
        'st-settings.font-size',
        'Font Size Scale',
        0.5, 2.0, 0.05,
        themeState.activeTheme.fontSize,
        'x',
        (v) => updateThemeProperty('fontSize', v)
    ));

    content.appendChild(createSliderRow(
        'st-settings.letter-spacing',
        'Letter Spacing',
        -0.1, 0.3, 0.01,
        themeState.activeTheme.letterSpacing,
        'em',
        (v) => updateThemeProperty('letterSpacing', v)
    ));

    // --- Effects Section ---
    content.appendChild(createSectionHeader('Effects'));

    content.appendChild(createToggleRow(
        'st-settings.blur-unsung',
        'Blur Unsung Lines',
        themeState.activeTheme.blurUnsung,
        (v) => updateThemeProperty('blurUnsung', v)
    ));

    content.appendChild(createSliderRow(
        'st-settings.blur-amount',
        'Blur Amount',
        0, 8, 0.5,
        themeState.activeTheme.blurAmount,
        'px',
        (v) => updateThemeProperty('blurAmount', v)
    ));

    content.appendChild(createSliderRow(
        'st-settings.scale-active',
        'Active Line Scale',
        0.8, 1.5, 0.05,
        themeState.activeTheme.scaleActive,
        'x',
        (v) => updateThemeProperty('scaleActive', v)
    ));

    content.appendChild(createSliderRow(
        'st-settings.animation-speed',
        'Animation Speed',
        0.3, 3.0, 0.1,
        themeState.activeTheme.animationSpeed,
        'x',
        (v) => updateThemeProperty('animationSpeed', v)
    ));

    // --- Background Section ---
    content.appendChild(createSectionHeader('Background'));

    content.appendChild(createToggleRow(
        'st-settings.pagebg-overlay',
        'Page Background Overlay',
        themeState.activeTheme.pageBgOverlay,
        (v) => updateThemeProperty('pageBgOverlay', v)
    ));

    content.appendChild(createColorRow(
        'st-settings.pagebg-color',
        'Background Overlay Color',
        themeState.activeTheme.pageBgColor,
        (v) => updateThemeProperty('pageBgColor', v)
    ));

    content.appendChild(createSliderRow(
        'st-settings.pagebg-opacity',
        'Background Overlay Opacity',
        0, 1, 0.05,
        themeState.activeTheme.pageBgOpacity,
        '',
        (v) => updateThemeProperty('pageBgOpacity', v)
    ));

    // --- SLT Compatibility Section ---
    content.appendChild(createSectionHeader('Translation Styling (SLT)'));

    content.appendChild(createColorRow(
        'st-settings.slt-color',
        'Translation Text Color',
        themeState.activeTheme.sltTranslationColor,
        (v) => updateThemeProperty('sltTranslationColor', v)
    ));

    content.appendChild(createSliderRow(
        'st-settings.slt-opacity',
        'Translation Opacity',
        0.1, 1.0, 0.05,
        themeState.activeTheme.sltTranslationOpacity,
        '',
        (v) => updateThemeProperty('sltTranslationOpacity', v)
    ));

    content.appendChild(createSliderRow(
        'st-settings.slt-font-size',
        'Translation Font Size Scale',
        0.5, 2.0, 0.05,
        themeState.activeTheme.sltTranslationFontSize,
        'x',
        (v) => updateThemeProperty('sltTranslationFontSize', v)
    ));

    // --- Misc Section ---
    content.appendChild(createSectionHeader('Miscellaneous'));

    content.appendChild(createToggleRow(
        'st-settings.hide-scrollbar',
        'Hide Lyrics Scrollbar',
        themeState.activeTheme.hideScrollbar,
        (v) => updateThemeProperty('hideScrollbar', v)
    ));

    // Reset button
    content.appendChild(createButtonRow(
        'st-settings.reset',
        'Reset All Settings',
        'Reset to Default',
        () => {
            applyPreset(BUILTIN_PRESETS[0]);
            injectThemeStyles();
            refreshSettings();
            if (Spicetify.showNotification) {
                Spicetify.showNotification('Theme reset to default!');
            }
        }
    ));

    // Export / Import
    content.appendChild(createButtonRow(
        'st-settings.export',
        'Export Theme Configuration',
        'Export',
        () => {
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
        }
    ));

    content.appendChild(createButtonRow(
        'st-settings.import',
        'Import Theme Configuration',
        'Import',
        () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
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
                        if (data.presets && Array.isArray(data.presets)) {
                            themeState.customPresets = data.presets;
                        }
                        if (data.presetName) {
                            themeState.activePresetName = data.presetName;
                        }
                        saveThemeState();
                        injectThemeStyles();
                        refreshSettings();
                        if (Spicetify.showNotification) {
                            Spicetify.showNotification('Theme imported successfully!');
                        }
                    } catch (e) {
                        if (Spicetify.showNotification) {
                            Spicetify.showNotification('Invalid theme file', true);
                        }
                    }
                };
                reader.readAsText(file);
            });
            input.click();
        }
    ));

    // GitHub link
    const githubRow = document.createElement('div');
    githubRow.className = 'x-settings-row';
    githubRow.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="e-91000-text encore-text-body-small encore-internal-color-text-subdued">GitHub Repository</label>
        </div>
        <div class="x-settings-secondColumn">
            <a href="https://github.com/7xeh/SpicyThemes" target="_blank" class="Button-sc-y0gtbx-0 Button-buttonSecondary-small-iconTrailing-useBrowserDefaultFocusStyle encore-text-body-small-bold e-91000-button--small e-91000-button--trailing" data-encore-id="buttonSecondary">View<span aria-hidden="true" class="e-91000-button__icon-wrapper"><svg data-encore-id="icon" role="img" aria-hidden="true" class="e-91000-icon e-91000-baseline" viewBox="0 0 16 16" style="--encore-icon-height: var(--encore-graphic-size-decorative-smaller); --encore-icon-width: var(--encore-graphic-size-decorative-smaller);"><path d="M1 2.75A.75.75 0 0 1 1.75 2H7v1.5H2.5v11h10.219V9h1.5v6.25a.75.75 0 0 1-.75.75H1.75a.75.75 0 0 1-.75-.75z"></path><path d="M15 1v4.993a.75.75 0 1 1-1.5 0V3.56L8.78 8.28a.75.75 0 0 1-1.06-1.06l4.72-4.72h-2.433a.75.75 0 0 1 0-1.5z"></path></svg></span></a>
        </div>
    `;
    content.appendChild(githubRow);

    return section;
}

function injectSettingsIntoPage(): void {
    const settingsContainer = document.querySelector('.x-settings-container') ||
                              document.querySelector('[data-testid="settings-page"]') ||
                              document.querySelector('main.x-settings-container');
    if (!settingsContainer) {
        debug('Settings container not found');
        return;
    }

    const existingSection = document.getElementById(SETTINGS_ID);
    const alreadyInContainer = !!existingSection && settingsContainer.contains(existingSection);
    if (alreadyInContainer) return;

    debug('Found settings container, injecting settings...');

    const settingsSection = existingSection || createSettingsSection();

    // Try to place after SLT settings, then after Spicy Lyrics settings
    const sltSettings = document.getElementById('spicy-lyric-translator-settings');
    const spicyLyricsSettings = document.getElementById('spicy-lyrics-settings');
    const spicyLyricsDevSettings = document.getElementById('spicy-lyrics-dev-settings');

    if (sltSettings) {
        sltSettings.after(settingsSection);
        debug('Settings injected after SLT settings');
    } else if (spicyLyricsDevSettings) {
        spicyLyricsDevSettings.after(settingsSection);
        debug('Settings injected after spicy-lyrics-dev-settings');
    } else if (spicyLyricsSettings) {
        spicyLyricsSettings.after(settingsSection);
        debug('Settings injected after spicy-lyrics-settings');
    } else {
        const allSections = settingsContainer.querySelectorAll('.x-settings-section');
        if (allSections.length > 0) {
            const lastSection = allSections[allSections.length - 1];
            const lastSectionParent = lastSection.closest('div:not(.x-settings-section):not(.x-settings-container)') || lastSection;
            lastSectionParent.after(settingsSection);
            debug('Settings injected after last settings section');
        } else {
            settingsContainer.appendChild(settingsSection);
            debug('Settings appended to settings container');
        }
    }
}

function isOnSettingsPage(): boolean {
    const hasSettingsContainer = !!document.querySelector('.x-settings-container');
    const hasSettingsTestId = !!document.querySelector('[data-testid="settings-page"]');
    const pathCheck = window.location.pathname.includes('preferences') ||
                      window.location.pathname.includes('settings') ||
                      window.location.href.includes('preferences') ||
                      window.location.href.includes('settings');

    let historyCheck = false;
    try {
        const location = Spicetify.Platform?.History?.location;
        if (location) {
            historyCheck = location.pathname?.includes('preferences') ||
                          location.pathname?.includes('settings') ||
                          false;
        }
    } catch (e) { /* ignore */ }

    return hasSettingsContainer || hasSettingsTestId || pathCheck || historyCheck;
}

function watchForSettingsPage(): void {
    debug('Starting settings page watcher...');

    if (isOnSettingsPage()) {
        debug('Already on settings page, injecting...');
        setTimeout(injectSettingsIntoPage, 100);
    }

    try {
        if (Spicetify.Platform?.History?.listen) {
            Spicetify.Platform.History.listen(() => {
                if (isOnSettingsPage()) {
                    setTimeout(injectSettingsIntoPage, 200);
                }
            });
            debug('History listener registered');
        }
    } catch (e) {
        debug('Failed to register history listener:', e);
    }

    const observer = new MutationObserver(() => {
        if (isOnSettingsPage()) {
            injectSettingsIntoPage();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

export function registerSettings(): void {
    watchForSettingsPage();
    debug('Settings registered');
}
