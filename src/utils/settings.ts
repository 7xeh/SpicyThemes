import { storage } from './storage';
import { themeState, saveThemeState, applyPreset, getAllPresets, saveCustomPreset, deleteCustomPreset, updateThemeProperty, ThemeConfig, DEFAULT_THEME, BUILTIN_PRESETS } from './state';
import { injectThemeStyles } from './themeEngine';
import { debug, isDebugEnabled, setDebugMode } from './debug';
import { checkForUpdates, getCurrentVersion, getUpdateInfo } from './updater';
import { Icons } from './icons';

const SETTINGS_ID = 'spicy-themes-settings';
const MODAL_SETTINGS_ID = 'spicy-themes-modal-settings';

async function handleManualUpdateCheck(button: HTMLButtonElement, idleText: string): Promise<void> {
    button.disabled = true;
    button.textContent = 'Checking...';

    try {
        const info = await getUpdateInfo();
        if (!info) {
            throw new Error('Failed to fetch update metadata');
        }

        if (info.hasUpdate) {
            if (Spicetify.showNotification) {
                Spicetify.showNotification(`Update available: v${info.latestVersion}! Updating...`);
            }
            await checkForUpdates(true);
        } else if (Spicetify.showNotification) {
            Spicetify.showNotification('You\'re on the latest version!');
        }
    } catch (e) {
        if (Spicetify.showNotification) {
            Spicetify.showNotification('Failed to check for updates', true);
        }
    } finally {
        button.disabled = false;
        button.textContent = idleText;
    }
}

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

let isRefreshing = false;

function refreshById(id: string): void {
    const existing = document.getElementById(id);
    if (existing) {
        const parent = existing.parentElement;
        const nextSibling = existing.nextElementSibling;
        existing.remove();
        const newSection = createSettingsSection(id);
        if (parent) {
            if (nextSibling) {
                parent.insertBefore(newSection, nextSibling);
            } else {
                parent.appendChild(newSection);
            }
        }
    }
}

function refreshSettings(): void {
    if (isRefreshing) return;
    isRefreshing = true;

    refreshById(SETTINGS_ID);
    refreshById(MODAL_SETTINGS_ID);

    isRefreshing = false;
}

function createSettingsSection(id: string = SETTINGS_ID): HTMLElement {
    const section = document.createElement('div');
    section.id = id;
    section.className = 'spicy-themes-settings';
    section.innerHTML = `
        <div class="x-settings-section">
            <h2 class="e-91000-text encore-text-body-medium-bold encore-internal-color-text-base">Spicy Themes</h2>
        </div>
    `;

    const content = section.querySelector('.x-settings-section') as HTMLElement;

    const optionsContainer = document.createElement('div');
    optionsContainer.id = 'st-settings-options';
    optionsContainer.style.display = themeState.isEnabled ? '' : 'none';

    content.appendChild(createToggleRow(
        'st-settings.enabled',
        'Enable Spicy Themes',
        themeState.isEnabled,
        (checked) => {
            themeState.isEnabled = checked;
            saveThemeState();
            optionsContainer.style.display = checked ? '' : 'none';
        }
    ));

    optionsContainer.appendChild(createPresetSelector());

    optionsContainer.appendChild(createButtonRow(
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

    optionsContainer.appendChild(createSectionHeader('Colors'));

    optionsContainer.appendChild(createColorRow(
        'st-settings.active-line-color',
        'Active Line Color',
        themeState.activeTheme.activeLineColor,
        (v) => updateThemeProperty('activeLineColor', v)
    ));

    optionsContainer.appendChild(createColorRow(
        'st-settings.sung-line-color',
        'Sung Line Color',
        themeState.activeTheme.sungLineColor,
        (v) => updateThemeProperty('sungLineColor', v)
    ));

    optionsContainer.appendChild(createColorRow(
        'st-settings.notsungline-color',
        'Unsung Line Color',
        themeState.activeTheme.notSungLineColor,
        (v) => updateThemeProperty('notSungLineColor', v)
    ));

    optionsContainer.appendChild(createSectionHeader('Opacity'));

    optionsContainer.appendChild(createSliderRow(
        'st-settings.active-opacity',
        'Active Line Opacity',
        0.1, 1.0, 0.05,
        themeState.activeTheme.activeLineOpacity,
        '',
        (v) => updateThemeProperty('activeLineOpacity', v)
    ));

    optionsContainer.appendChild(createSliderRow(
        'st-settings.sung-opacity',
        'Sung Line Opacity',
        0.1, 1.0, 0.05,
        themeState.activeTheme.sungLineOpacity,
        '',
        (v) => updateThemeProperty('sungLineOpacity', v)
    ));

    optionsContainer.appendChild(createSliderRow(
        'st-settings.notsungopacity',
        'Unsung Line Opacity',
        0.1, 1.0, 0.05,
        themeState.activeTheme.notSungLineOpacity,
        '',
        (v) => updateThemeProperty('notSungLineOpacity', v)
    ));

    optionsContainer.appendChild(createSectionHeader('Glow'));

    const glowSubContainer = document.createElement('div');
    glowSubContainer.style.display = themeState.activeTheme.glowEnabled ? '' : 'none';

    optionsContainer.appendChild(createToggleRow(
        'st-settings.glow-enabled',
        'Enable Glow Effect',
        themeState.activeTheme.glowEnabled,
        (v) => {
            updateThemeProperty('glowEnabled', v);
            glowSubContainer.style.display = v ? '' : 'none';
        }
    ));

    glowSubContainer.appendChild(createColorRow(
        'st-settings.glow-color',
        'Glow Color',
        themeState.activeTheme.glowColor,
        (v) => updateThemeProperty('glowColor', v)
    ));

    glowSubContainer.appendChild(createSliderRow(
        'st-settings.glow-intensity',
        'Glow Intensity',
        0, 20, 1,
        themeState.activeTheme.glowIntensity,
        'px',
        (v) => updateThemeProperty('glowIntensity', v)
    ));

    glowSubContainer.appendChild(createColorRow(
        'st-settings.active-glow-color',
        'Active Line Glow Color',
        themeState.activeTheme.activeGlowColor,
        (v) => updateThemeProperty('activeGlowColor', v)
    ));

    glowSubContainer.appendChild(createSliderRow(
        'st-settings.active-glow-intensity',
        'Active Glow Intensity',
        0, 30, 1,
        themeState.activeTheme.activeGlowIntensity,
        'px',
        (v) => updateThemeProperty('activeGlowIntensity', v)
    ));

    optionsContainer.appendChild(glowSubContainer);

    optionsContainer.appendChild(createSectionHeader('Font'));

    optionsContainer.appendChild(createTextInputRow(
        'st-settings.font-family',
        'Font Family',
        themeState.activeTheme.fontFamily,
        'Leave empty for default',
        (v) => updateThemeProperty('fontFamily', v)
    ));

    optionsContainer.appendChild(createDropdownRow(
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

    optionsContainer.appendChild(createSliderRow(
        'st-settings.font-size',
        'Font Size Scale',
        0.5, 2.0, 0.05,
        themeState.activeTheme.fontSize,
        'x',
        (v) => updateThemeProperty('fontSize', v)
    ));

    optionsContainer.appendChild(createSliderRow(
        'st-settings.letter-spacing',
        'Letter Spacing',
        -0.1, 0.3, 0.01,
        themeState.activeTheme.letterSpacing,
        'em',
        (v) => updateThemeProperty('letterSpacing', v)
    ));

    optionsContainer.appendChild(createSectionHeader('Effects'));

    const blurAmountContainer = createSliderRow(
        'st-settings.blur-amount',
        'Blur Amount',
        0, 8, 0.5,
        themeState.activeTheme.blurAmount,
        'px',
        (v) => updateThemeProperty('blurAmount', v)
    );
    blurAmountContainer.style.display = themeState.activeTheme.blurUnsung ? '' : 'none';

    optionsContainer.appendChild(createToggleRow(
        'st-settings.blur-unsung',
        'Blur Unsung Lines',
        themeState.activeTheme.blurUnsung,
        (v) => {
            updateThemeProperty('blurUnsung', v);
            blurAmountContainer.style.display = v ? '' : 'none';
        }
    ));

    optionsContainer.appendChild(blurAmountContainer);

    optionsContainer.appendChild(createSliderRow(
        'st-settings.scale-active',
        'Active Line Scale',
        0.8, 1.5, 0.05,
        themeState.activeTheme.scaleActive,
        'x',
        (v) => updateThemeProperty('scaleActive', v)
    ));

    optionsContainer.appendChild(createSliderRow(
        'st-settings.animation-speed',
        'Animation Speed',
        0.3, 3.0, 0.1,
        themeState.activeTheme.animationSpeed,
        'x',
        (v) => updateThemeProperty('animationSpeed', v)
    ));

    optionsContainer.appendChild(createSectionHeader('Background'));

    const bgSubContainer = document.createElement('div');
    bgSubContainer.style.display = themeState.activeTheme.pageBgOverlay ? '' : 'none';

    optionsContainer.appendChild(createToggleRow(
        'st-settings.pagebg-overlay',
        'Page Background Overlay',
        themeState.activeTheme.pageBgOverlay,
        (v) => {
            updateThemeProperty('pageBgOverlay', v);
            bgSubContainer.style.display = v ? '' : 'none';
        }
    ));

    bgSubContainer.appendChild(createColorRow(
        'st-settings.pagebg-color',
        'Background Overlay Color',
        themeState.activeTheme.pageBgColor,
        (v) => updateThemeProperty('pageBgColor', v)
    ));

    bgSubContainer.appendChild(createSliderRow(
        'st-settings.pagebg-opacity',
        'Background Overlay Opacity',
        0, 1, 0.05,
        themeState.activeTheme.pageBgOpacity,
        '',
        (v) => updateThemeProperty('pageBgOpacity', v)
    ));

    optionsContainer.appendChild(bgSubContainer);

    optionsContainer.appendChild(createSectionHeader('Translation Styling (SLT)'));

    optionsContainer.appendChild(createColorRow(
        'st-settings.slt-color',
        'Translation Text Color',
        themeState.activeTheme.sltTranslationColor,
        (v) => updateThemeProperty('sltTranslationColor', v)
    ));

    optionsContainer.appendChild(createSliderRow(
        'st-settings.slt-opacity',
        'Translation Opacity',
        0.1, 1.0, 0.05,
        themeState.activeTheme.sltTranslationOpacity,
        '',
        (v) => updateThemeProperty('sltTranslationOpacity', v)
    ));

    optionsContainer.appendChild(createSliderRow(
        'st-settings.slt-font-size',
        'Translation Font Size Scale',
        0.5, 2.0, 0.05,
        themeState.activeTheme.sltTranslationFontSize,
        'x',
        (v) => updateThemeProperty('sltTranslationFontSize', v)
    ));

    optionsContainer.appendChild(createSectionHeader('Miscellaneous'));

    optionsContainer.appendChild(createToggleRow(
        'st-settings.hide-scrollbar',
        'Hide Lyrics Scrollbar',
        themeState.activeTheme.hideScrollbar,
        (v) => updateThemeProperty('hideScrollbar', v)
    ));

    optionsContainer.appendChild(createButtonRow(
        'st-settings.check-updates',
        `Check for Updates (v${getCurrentVersion().text})`,
        'Check Now',
        async () => {
            const btn = document.getElementById('st-settings.check-updates') as HTMLButtonElement | null;
            if (!btn) return;
            await handleManualUpdateCheck(btn, 'Check Now');
        }
    ));

    optionsContainer.appendChild(createButtonRow(
        'st-settings.reset',
        'Reset All Settings',
        'Reset to Default',
        () => {
            applyPreset(BUILTIN_PRESETS.find(p => p.name === 'Minimal') || BUILTIN_PRESETS[0]);
            injectThemeStyles();
            refreshSettings();
            if (Spicetify.showNotification) {
                Spicetify.showNotification('Theme reset to default!');
            }
        }
    ));

    optionsContainer.appendChild(createButtonRow(
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

    optionsContainer.appendChild(createButtonRow(
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
    optionsContainer.appendChild(githubRow);

    content.appendChild(optionsContainer);

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
    } catch (e) {}

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
                    setTimeout(injectSettingsIntoPage, 100);
                    setTimeout(injectSettingsIntoPage, 300);
                    setTimeout(injectSettingsIntoPage, 500);
                }
            });
            debug('History listener registered');
        }
    } catch (e) {
        debug('Failed to register history listener:', e);
    }

    let settingsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
        if (!document.getElementById(SETTINGS_ID) && isOnSettingsPage()) {
            if (settingsDebounceTimer) clearTimeout(settingsDebounceTimer);
            settingsDebounceTimer = setTimeout(() => {
                injectSettingsIntoPage();
                settingsDebounceTimer = null;
            }, 150);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function createSettingsUI(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'st-modal-settings';
    container.innerHTML = `
        <style>
            .st-modal-settings {
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 18px;
                width: min(760px, 92vw);
                max-width: 100%;
                max-height: 78vh;
                box-sizing: border-box;
                overflow-x: hidden;
                overflow-y: auto;
            }
            .st-modal-settings .st-m-row {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .st-modal-settings .st-m-row label {
                font-size: 15px;
                font-weight: 500;
                color: var(--spice-text);
            }
            .st-modal-settings .st-m-row select,
            .st-modal-settings .st-m-row input[type="text"],
            .st-modal-settings .st-m-row input[type="number"] {
                padding: 10px 14px;
                border-radius: 4px;
                border: 1px solid var(--spice-button-disabled);
                background: var(--spice-card);
                color: var(--spice-text);
                font-size: 15px;
            }
            .st-modal-settings .st-m-row select:focus,
            .st-modal-settings .st-m-row input:focus {
                outline: none;
                border-color: var(--spice-button);
            }
            .st-modal-settings .st-m-toggle-row {
                flex-direction: row;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            .st-modal-settings .st-m-toggle-row > label:first-child {
                margin: 0;
                line-height: 1.35;
                flex: 1;
            }
            .st-modal-settings .st-m-toggle-row .st-m-toggle {
                margin-left: auto;
                flex-shrink: 0;
            }
            .st-modal-settings .st-m-toggle {
                position: relative;
                width: 40px;
                height: 20px;
            }
            .st-modal-settings .st-m-toggle input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .st-modal-settings .st-m-toggle-slider {
                position: absolute;
                cursor: pointer;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: var(--spice-button-disabled);
                transition: .3s;
                border-radius: 20px;
            }
            .st-modal-settings .st-m-toggle-slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 2px;
                bottom: 2px;
                background-color: white;
                transition: .3s;
                border-radius: 50%;
            }
            .st-modal-settings .st-m-toggle input:checked + .st-m-toggle-slider {
                background-color: var(--spice-button);
            }
            .st-modal-settings .st-m-toggle input:checked + .st-m-toggle-slider:before {
                transform: translateX(20px);
            }
            .st-modal-settings .st-m-button {
                padding: 11px 22px;
                border-radius: 500px;
                border: none;
                background: var(--spice-button);
                color: var(--spice-text);
                font-size: 15px;
                font-weight: 700;
                cursor: pointer;
                transition: transform 0.1s, background 0.2s;
            }
            .st-modal-settings .st-m-button:hover {
                transform: scale(1.02);
                background: var(--spice-button-active);
            }
            .st-modal-settings .st-m-button:active {
                transform: scale(0.98);
            }
            .st-modal-settings .st-m-section {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: var(--spice-subtext);
                margin: 6px 0 0;
                padding-bottom: 4px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            .st-modal-settings .st-m-description {
                font-size: 13px;
                color: var(--spice-subtext);
                margin-top: 0;
                line-height: 1.35;
            }
            .st-modal-settings .st-m-color-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            .st-modal-settings .st-m-color-swatch {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 2px solid rgba(255,255,255,0.2);
                cursor: pointer;
                padding: 0;
                appearance: none;
                -webkit-appearance: none;
                background: none;
                outline: none;
            }
            .st-modal-settings .st-m-color-swatch::-webkit-color-swatch-wrapper { padding: 0; }
            .st-modal-settings .st-m-color-swatch::-webkit-color-swatch { border: none; border-radius: 50%; }
            .st-modal-settings .st-m-slider-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            .st-modal-settings .st-m-slider-row label { flex: 1; }
            .st-modal-settings .st-m-slider-group {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .st-modal-settings .st-m-slider {
                -webkit-appearance: none;
                appearance: none;
                width: 120px;
                height: 4px;
                border-radius: 2px;
                background: rgba(255,255,255,0.2);
                outline: none;
                cursor: pointer;
            }
            .st-modal-settings .st-m-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: var(--spice-button-active, #1db954);
                cursor: pointer;
            }
            .st-modal-settings .st-m-value {
                font-family: 'JetBrains Mono', 'Consolas', monospace;
                font-size: 11px;
                color: var(--spice-subtext);
                min-width: 40px;
                text-align: right;
            }
            .st-modal-settings .st-m-preset-wrap {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
            }
            .st-modal-settings .st-m-preset {
                display: inline-block;
                padding: 8px 16px;
                border-radius: 20px;
                background: rgba(255,255,255,0.07);
                color: var(--spice-text);
                cursor: pointer;
                transition: background 0.2s, transform 0.15s;
                border: 1px solid transparent;
                font-size: 13px;
            }
            .st-modal-settings .st-m-preset:hover {
                background: rgba(255,255,255,0.12);
                transform: scale(1.03);
            }
            .st-modal-settings .st-m-preset.active {
                border-color: var(--spice-button-active, #1db954);
                background: rgba(29,185,84,0.15);
            }
            .st-modal-settings .st-m-preset .st-m-preset-del {
                margin-left: 8px;
                opacity: 0.5;
                cursor: pointer;
                font-size: 11px;
            }
            .st-modal-settings .st-m-preset .st-m-preset-del:hover {
                opacity: 1;
                color: #e74c3c;
            }
        </style>
    `;

    const toggle = (label: string, id: string, checked: boolean, onChange: (v: boolean) => void) => {
        const row = document.createElement('div');
        row.className = 'st-m-row st-m-toggle-row';
        row.innerHTML = `
            <label for="${id}">${label}</label>
            <label class="st-m-toggle">
                <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
                <span class="st-m-toggle-slider"></span>
            </label>
        `;
        (row.querySelector('input') as HTMLInputElement)?.addEventListener('change', function () {
            onChange(this.checked);
            injectThemeStyles();
        });
        return row;
    };

    const color = (label: string, id: string, value: string, onChange: (v: string) => void) => {
        const row = document.createElement('div');
        row.className = 'st-m-row st-m-color-row';
        row.innerHTML = `
            <label for="${id}">${label}</label>
            <input type="color" id="${id}" class="st-m-color-swatch" value="${value.startsWith('#') ? value : '#ffffff'}">
        `;
        (row.querySelector('input') as HTMLInputElement)?.addEventListener('input', function () {
            onChange(this.value);
            injectThemeStyles();
        });
        return row;
    };

    const slider = (label: string, id: string, min: number, max: number, step: number, value: number, unit: string, onChange: (v: number) => void) => {
        const row = document.createElement('div');
        row.className = 'st-m-row st-m-slider-row';
        row.innerHTML = `
            <label for="${id}">${label}</label>
            <div class="st-m-slider-group">
                <input type="range" id="${id}" class="st-m-slider" min="${min}" max="${max}" step="${step}" value="${value}">
                <span class="st-m-value">${value}${unit}</span>
            </div>
        `;
        const inp = row.querySelector('input') as HTMLInputElement;
        const disp = row.querySelector('.st-m-value') as HTMLElement;
        inp?.addEventListener('input', function () {
            const v = parseFloat(this.value);
            if (disp) disp.textContent = `${v}${unit}`;
            onChange(v);
            injectThemeStyles();
        });
        return row;
    };

    const dropdown = (label: string, id: string, options: { value: string; text: string }[], current: string, onChange: (v: string) => void) => {
        const row = document.createElement('div');
        row.className = 'st-m-row';
        row.innerHTML = `
            <label for="${id}">${label}</label>
            <select id="${id}">
                ${options.map(o => `<option value="${o.value}" ${o.value === current ? 'selected' : ''}>${o.text}</option>`).join('')}
            </select>
        `;
        (row.querySelector('select') as HTMLSelectElement)?.addEventListener('change', function () {
            onChange(this.value);
            injectThemeStyles();
        });
        return row;
    };

    const textInput = (label: string, id: string, value: string, placeholder: string, onChange: (v: string) => void) => {
        const row = document.createElement('div');
        row.className = 'st-m-row';
        row.innerHTML = `
            <label for="${id}">${label}</label>
            <input type="text" id="${id}" value="${value}" placeholder="${placeholder}">
        `;
        (row.querySelector('input') as HTMLInputElement)?.addEventListener('change', function () {
            onChange(this.value);
            injectThemeStyles();
        });
        return row;
    };

    const btn = (label: string, id: string, onClick: () => void) => {
        const row = document.createElement('div');
        row.className = 'st-m-row';
        row.innerHTML = `<button class="st-m-button" id="${id}">${label}</button>`;
        (row.querySelector('button') as HTMLButtonElement)?.addEventListener('click', onClick);
        return row;
    };

    const section = (text: string) => {
        const h = document.createElement('div');
        h.className = 'st-m-section';
        h.textContent = text;
        return h;
    };

    const modalOptionsContainer = document.createElement('div');
    modalOptionsContainer.style.display = themeState.isEnabled ? 'flex' : 'none';
    modalOptionsContainer.style.flexDirection = 'column';
    modalOptionsContainer.style.gap = '18px';

    container.appendChild(toggle('Enable Spicy Themes', 'st-m-enabled', themeState.isEnabled, (v) => {
        themeState.isEnabled = v;
        saveThemeState();
        modalOptionsContainer.style.display = v ? 'flex' : 'none';
    }));

    const presetsRow = document.createElement('div');
    presetsRow.className = 'st-m-row';
    const presetsLabel = document.createElement('label');
    presetsLabel.textContent = 'Theme Presets';
    presetsLabel.style.marginBottom = '4px';
    presetsRow.appendChild(presetsLabel);
    const presetsWrap = document.createElement('div');
    presetsWrap.className = 'st-m-preset-wrap';
    const allPresets = getAllPresets();
    for (const preset of allPresets) {
        const card = document.createElement('span');
        card.className = `st-m-preset${preset.name === themeState.activePresetName ? ' active' : ''}`;
        card.title = preset.description;
        let cardHTML = preset.name;
        const isCustom = !BUILTIN_PRESETS.some(b => b.name === preset.name);
        if (isCustom) {
            cardHTML += `<span class="st-m-preset-del" title="Delete preset">\u00D7</span>`;
        }
        card.innerHTML = cardHTML;
        card.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).classList.contains('st-m-preset-del')) {
                deleteCustomPreset(preset.name);
                Spicetify.PopupModal?.hide();
                setTimeout(() => openSettingsModal(), 120);
                injectThemeStyles();
                return;
            }
            applyPreset(preset);
            injectThemeStyles();
            Spicetify.PopupModal?.hide();
            setTimeout(() => openSettingsModal(), 120);
        });
        presetsWrap.appendChild(card);
    }
    presetsRow.appendChild(presetsWrap);
    modalOptionsContainer.appendChild(presetsRow);

    modalOptionsContainer.appendChild(btn('Save Current as Preset', 'st-m-save-preset', () => {
        const name = prompt('Enter preset name:');
        if (name && name.trim()) {
            const desc = prompt('Enter description (optional):') || '';
            saveCustomPreset(name.trim(), desc.trim());
            Spicetify.PopupModal?.hide();
            setTimeout(() => openSettingsModal(), 120);
            if (Spicetify.showNotification) {
                Spicetify.showNotification(`Preset "${name.trim()}" saved!`);
            }
        }
    }));

    modalOptionsContainer.appendChild(section('Colors'));
    modalOptionsContainer.appendChild(color('Active Line Color', 'st-m-active-color', themeState.activeTheme.activeLineColor, (v) => updateThemeProperty('activeLineColor', v)));
    modalOptionsContainer.appendChild(color('Sung Line Color', 'st-m-sung-color', themeState.activeTheme.sungLineColor, (v) => updateThemeProperty('sungLineColor', v)));
    modalOptionsContainer.appendChild(color('Unsung Line Color', 'st-m-notsungline-color', themeState.activeTheme.notSungLineColor, (v) => updateThemeProperty('notSungLineColor', v)));

    modalOptionsContainer.appendChild(section('Opacity'));
    modalOptionsContainer.appendChild(slider('Active Line Opacity', 'st-m-active-opacity', 0.1, 1.0, 0.05, themeState.activeTheme.activeLineOpacity, '', (v) => updateThemeProperty('activeLineOpacity', v)));
    modalOptionsContainer.appendChild(slider('Sung Line Opacity', 'st-m-sung-opacity', 0.1, 1.0, 0.05, themeState.activeTheme.sungLineOpacity, '', (v) => updateThemeProperty('sungLineOpacity', v)));
    modalOptionsContainer.appendChild(slider('Unsung Line Opacity', 'st-m-notsungopacity', 0.1, 1.0, 0.05, themeState.activeTheme.notSungLineOpacity, '', (v) => updateThemeProperty('notSungLineOpacity', v)));

    modalOptionsContainer.appendChild(section('Glow'));
    const glowSubSettings = document.createElement('div');
    glowSubSettings.style.display = themeState.activeTheme.glowEnabled ? 'flex' : 'none';
    glowSubSettings.style.flexDirection = 'column';
    glowSubSettings.style.gap = '18px';
    modalOptionsContainer.appendChild(toggle('Enable Glow Effect', 'st-m-glow-enabled', themeState.activeTheme.glowEnabled, (v) => {
        updateThemeProperty('glowEnabled', v);
        glowSubSettings.style.display = v ? 'flex' : 'none';
    }));
    glowSubSettings.appendChild(color('Glow Color', 'st-m-glow-color', themeState.activeTheme.glowColor, (v) => updateThemeProperty('glowColor', v)));
    glowSubSettings.appendChild(slider('Glow Intensity', 'st-m-glow-intensity', 0, 20, 1, themeState.activeTheme.glowIntensity, 'px', (v) => updateThemeProperty('glowIntensity', v)));
    glowSubSettings.appendChild(color('Active Line Glow Color', 'st-m-active-glow-color', themeState.activeTheme.activeGlowColor, (v) => updateThemeProperty('activeGlowColor', v)));
    glowSubSettings.appendChild(slider('Active Glow Intensity', 'st-m-active-glow-intensity', 0, 30, 1, themeState.activeTheme.activeGlowIntensity, 'px', (v) => updateThemeProperty('activeGlowIntensity', v)));
    modalOptionsContainer.appendChild(glowSubSettings);

    modalOptionsContainer.appendChild(section('Font'));
    modalOptionsContainer.appendChild(textInput('Font Family', 'st-m-font-family', themeState.activeTheme.fontFamily, 'Leave empty for default', (v) => updateThemeProperty('fontFamily', v)));
    modalOptionsContainer.appendChild(dropdown('Font Weight', 'st-m-font-weight', [
        { value: '300', text: 'Light (300)' },
        { value: '400', text: 'Regular (400)' },
        { value: '500', text: 'Medium (500)' },
        { value: '600', text: 'Semi-Bold (600)' },
        { value: '700', text: 'Bold (700)' },
        { value: '800', text: 'Extra-Bold (800)' },
        { value: '900', text: 'Black (900)' },
    ], String(themeState.activeTheme.fontWeight), (v) => updateThemeProperty('fontWeight', parseInt(v, 10))));
    modalOptionsContainer.appendChild(slider('Font Size Scale', 'st-m-font-size', 0.5, 2.0, 0.05, themeState.activeTheme.fontSize, 'x', (v) => updateThemeProperty('fontSize', v)));
    modalOptionsContainer.appendChild(slider('Letter Spacing', 'st-m-letter-spacing', -0.1, 0.3, 0.01, themeState.activeTheme.letterSpacing, 'em', (v) => updateThemeProperty('letterSpacing', v)));

    modalOptionsContainer.appendChild(section('Effects'));
    const blurAmountRow = slider('Blur Amount', 'st-m-blur-amount', 0, 8, 0.5, themeState.activeTheme.blurAmount, 'px', (v) => updateThemeProperty('blurAmount', v));
    blurAmountRow.style.display = themeState.activeTheme.blurUnsung ? '' : 'none';
    modalOptionsContainer.appendChild(toggle('Blur Unsung Lines', 'st-m-blur-unsung', themeState.activeTheme.blurUnsung, (v) => {
        updateThemeProperty('blurUnsung', v);
        blurAmountRow.style.display = v ? '' : 'none';
    }));
    modalOptionsContainer.appendChild(blurAmountRow);
    modalOptionsContainer.appendChild(slider('Active Line Scale', 'st-m-scale-active', 0.8, 1.5, 0.05, themeState.activeTheme.scaleActive, 'x', (v) => updateThemeProperty('scaleActive', v)));
    modalOptionsContainer.appendChild(slider('Animation Speed', 'st-m-animation-speed', 0.3, 3.0, 0.1, themeState.activeTheme.animationSpeed, 'x', (v) => updateThemeProperty('animationSpeed', v)));

    modalOptionsContainer.appendChild(section('Background'));
    const bgSubSettings = document.createElement('div');
    bgSubSettings.style.display = themeState.activeTheme.pageBgOverlay ? 'flex' : 'none';
    bgSubSettings.style.flexDirection = 'column';
    bgSubSettings.style.gap = '18px';
    modalOptionsContainer.appendChild(toggle('Page Background Overlay', 'st-m-pagebg-overlay', themeState.activeTheme.pageBgOverlay, (v) => {
        updateThemeProperty('pageBgOverlay', v);
        bgSubSettings.style.display = v ? 'flex' : 'none';
    }));
    bgSubSettings.appendChild(color('Background Overlay Color', 'st-m-pagebg-color', themeState.activeTheme.pageBgColor, (v) => updateThemeProperty('pageBgColor', v)));
    bgSubSettings.appendChild(slider('Background Overlay Opacity', 'st-m-pagebg-opacity', 0, 1, 0.05, themeState.activeTheme.pageBgOpacity, '', (v) => updateThemeProperty('pageBgOpacity', v)));
    modalOptionsContainer.appendChild(bgSubSettings);

    modalOptionsContainer.appendChild(section('Translation Styling (SLT)'));
    modalOptionsContainer.appendChild(color('Translation Text Color', 'st-m-slt-color', themeState.activeTheme.sltTranslationColor, (v) => updateThemeProperty('sltTranslationColor', v)));
    modalOptionsContainer.appendChild(slider('Translation Opacity', 'st-m-slt-opacity', 0.1, 1.0, 0.05, themeState.activeTheme.sltTranslationOpacity, '', (v) => updateThemeProperty('sltTranslationOpacity', v)));
    modalOptionsContainer.appendChild(slider('Translation Font Size Scale', 'st-m-slt-font-size', 0.5, 2.0, 0.05, themeState.activeTheme.sltTranslationFontSize, 'x', (v) => updateThemeProperty('sltTranslationFontSize', v)));

    modalOptionsContainer.appendChild(section('Miscellaneous'));
    modalOptionsContainer.appendChild(toggle('Hide Lyrics Scrollbar', 'st-m-hide-scrollbar', themeState.activeTheme.hideScrollbar, (v) => updateThemeProperty('hideScrollbar', v)));

    modalOptionsContainer.appendChild(btn('Reset to Default', 'st-m-reset', () => {
        applyPreset(BUILTIN_PRESETS.find(p => p.name === 'Minimal') || BUILTIN_PRESETS[0]);
        injectThemeStyles();
        Spicetify.PopupModal?.hide();
        setTimeout(() => openSettingsModal(), 120);
        if (Spicetify.showNotification) {
            Spicetify.showNotification('Theme reset to default!');
        }
    }));

    const ioRow = document.createElement('div');
    ioRow.className = 'st-m-row';
    ioRow.style.cssText = 'flex-direction: row; gap: 8px; flex-wrap: wrap;';
    const exportBtn = document.createElement('button');
    exportBtn.className = 'st-m-button';
    exportBtn.style.cssText = 'padding: 9px 18px; font-size: 13px;';
    exportBtn.textContent = 'Export';
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
    });
    const importBtn = document.createElement('button');
    importBtn.className = 'st-m-button';
    importBtn.style.cssText = 'padding: 9px 18px; font-size: 13px;';
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', () => {
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
                    Spicetify.PopupModal?.hide();
                    setTimeout(() => openSettingsModal(), 120);
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
    });
    ioRow.appendChild(exportBtn);
    ioRow.appendChild(importBtn);
    modalOptionsContainer.appendChild(ioRow);

    const footerRow = document.createElement('div');
    footerRow.className = 'st-m-row';
    footerRow.style.cssText = 'flex-direction: row; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;';
    footerRow.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; opacity: 0.7;">
            <span style="font-size: 14px; color: var(--spice-subtext);">Version v${getCurrentVersion().text}</span>
            <span style="color: var(--spice-subtext);">•</span>
            <a href="https://github.com/7xeh/SpicyThemes" target="_blank" style="font-size: 14px; color: var(--spice-button);">GitHub</a>
        </div>
        <button class="st-m-button" id="st-m-check-updates" style="padding: 9px 18px; font-size: 13px; white-space: nowrap;">Check for Updates</button>
    `;

    const modalCheckUpdatesButton = footerRow.querySelector('#st-m-check-updates') as HTMLButtonElement | null;
    modalCheckUpdatesButton?.addEventListener('click', async () => {
        if (!modalCheckUpdatesButton) return;
        await handleManualUpdateCheck(modalCheckUpdatesButton, 'Check for Updates');
    });

    modalOptionsContainer.appendChild(footerRow);

    container.appendChild(modalOptionsContainer);

    return container;
}

export function openSettingsModal(): void {
    if (Spicetify.PopupModal) {
        Spicetify.PopupModal.display({
            title: 'Spicy Themes',
            content: createSettingsUI(),
            isLarge: true
        });
    }
}

export async function registerSettings(): Promise<void> {
    while (typeof Spicetify === 'undefined' || !Spicetify.Platform) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    watchForSettingsPage();

    const registerMenuItem = () => {
        if ((Spicetify as any).Menu) {
            try {
                new (Spicetify as any).Menu.Item(
                    'Spicy Themes',
                    false,
                    openSettingsModal
                ).register();
                debug('Menu item registered');
                return true;
            } catch (e) {
                debug('Menu.Item not available:', e);
            }
        }
        return false;
    };

    if (!registerMenuItem()) {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (registerMenuItem() || attempts > 20) {
                clearInterval(interval);
            }
        }, 500);
    }

    debug('Settings registered');
}
