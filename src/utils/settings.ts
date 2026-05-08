import { storage } from './storage';
import { themeState, saveThemeState, applyPreset, getAllPresets, saveCustomPreset, deleteCustomPreset, updateThemeProperty, DEFAULT_THEME, BUILTIN_PRESETS } from './state';
import { injectThemeStyles } from './themeEngine';
import { checkForUpdates, getCurrentVersion, getUpdateInfo, isDevChannel } from './updater';
import { createSettingsModal, SCHEMA, FONT_OPTIONS, FieldDef } from './settingsModal';
import { ThemeConfig } from './state';

const SETTINGS_ID = 'spicy-themes-settings';
const MODAL_SETTINGS_ID = 'spicy-themes-modal-settings';
const SETTINGS_WATCHER_FLAG = '__spicyThemesSettingsWatcherRegistered';
const MENU_REGISTERED_FLAG = '__spicyThemesMenuRegistered';

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
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
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
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
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
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
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
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
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
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <button id="${id}" class="encore-text-body-small-bold e-10310-legacy-button--small e-10310-legacy-button-secondary--text-base encore-internal-color-text-base e-10310-legacy-button e-10310-legacy-button-secondary e-10310-overflow-wrap-anywhere x-settings-button" data-encore-id="buttonSecondary" type="button">${buttonText}</button>
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
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <input type="text" id="${id}" class="main-dropDown-dropDown" style="width: 200px;" value="" placeholder="${placeholder}">
        </div>
    `;
    const input = row.querySelector('input') as HTMLInputElement;
    if (input) input.value = currentValue;
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
    label.className = 'e-10310-text encore-text-body-small encore-internal-color-text-subdued';
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

function slugifyId(key: string): string {
    return `st-settings.${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

function renderSchemaFields(container: HTMLElement): void {
    let lastSection = '';
    const conditionalRows: { def: FieldDef; row: HTMLElement }[] = [];

    const updateConditionalVisibility = () => {
        conditionalRows.forEach(({ def, row }) => {
            if (def.when) {
                row.style.display = def.when(themeState.activeTheme) ? '' : 'none';
            }
        });
    };

    SCHEMA.forEach((def) => {
        if (def.section !== lastSection) {
            container.appendChild(createSectionHeader(def.section));
            lastSection = def.section;
        }

        const id = slugifyId(def.id);
        const cur = themeState.activeTheme[def.id];
        let row: HTMLElement | null = null;

        const setProp = (v: any) => updateThemeProperty(def.id as keyof ThemeConfig, v);

        switch (def.type) {
            case 'color': {
                row = createColorRow(id, def.label, String(cur || '#ffffff'), (v) => setProp(v));
                break;
            }
            case 'slider': {
                row = createSliderRow(
                    id,
                    def.label,
                    def.min ?? 0,
                    def.max ?? 1,
                    def.step ?? 0.05,
                    Number(cur),
                    def.unit || '',
                    (v) => setProp(v)
                );
                break;
            }
            case 'toggle': {
                row = createToggleRow(id, def.label, Boolean(cur), (v) => {
                    setProp(v);
                    updateConditionalVisibility();
                });
                break;
            }
            case 'dropdown': {
                const opts = def.options || [];
                if (def.id === 'fontFamily' && opts.some(o => o.value === '__custom__')) {
                    const isCustom = !FONT_OPTIONS.some(o => o.value === cur);
                    const currentVal = isCustom && cur !== '' ? '__custom__' : String(cur);
                    row = createDropdownRow(id, def.label, opts, currentVal, (v) => {
                        if (v === '__custom__') {
                            setProp('Custom Font' as any);
                            updateConditionalVisibility();
                        } else {
                            setProp(v);
                            updateConditionalVisibility();
                        }
                    });
                } else {
                    row = createDropdownRow(id, def.label, opts, String(cur), (v) => {
                        const parsed: any = def.id === 'fontWeight' ? parseInt(v, 10) : v;
                        setProp(parsed);
                    });
                }
                break;
            }
            case 'text': {
                row = createTextInputRow(id, def.label, String(cur || ''), 'Enter font name', (v) => setProp(v));
                break;
            }
        }

        if (!row) return;

        if (def.when) {
            row.style.display = def.when(themeState.activeTheme) ? '' : 'none';
            conditionalRows.push({ def, row });
        }

        container.appendChild(row);
    });
}

function createSettingsSection(id: string = SETTINGS_ID): HTMLElement {
    const section = document.createElement('div');
    section.id = id;
    section.className = 'spicy-themes-settings';
    section.innerHTML = `
        <div class="x-settings-section fNaaQ0Cp8Yzy19j8">
            <h2 class="e-10310-text encore-text-body-medium-bold encore-internal-color-text-base">Spicy Themes</h2>
        </div>
    `;

    const content = section.querySelector('.x-settings-section.fNaaQ0Cp8Yzy19j8') as HTMLElement;

    const optionsContainer = document.createElement('div');
    optionsContainer.id = 'st-settings-options';
    optionsContainer.style.display = themeState.isEnabled ? '' : 'none';

    content.appendChild(createToggleRow(
        'st-settings.enabled',
        'Spicy Themes',
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

    renderSchemaFields(optionsContainer);

    optionsContainer.appendChild(createSectionHeader('Miscellaneous'));

    optionsContainer.appendChild(createToggleRow(
        'st-settings.dev-channel',
        'Dev Channel',
        isDevChannel(),
        (v) => {
            if (v) {
                storage.set('dev-channel', 'ST_D3V_7xeh');
            } else {
                storage.remove('dev-channel');
            }
            if (Spicetify.showNotification) {
                Spicetify.showNotification(v ? 'Dev channel enabled. Reload to apply' : 'Dev channel disabled. Reload to apply');
            }
        }
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
            applyPreset(BUILTIN_PRESETS.find(p => p.name === 'Default') || BUILTIN_PRESETS[0]);
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
            <label class="e-10310-text encore-text-body-small encore-internal-color-text-subdued">GitHub Repository</label>
        </div>
        <div class="x-settings-secondColumn">
            <a href="https://github.com/7xeh/SpicyThemes" target="_blank" class="encore-text-body-small-bold e-10310-legacy-button--small e-10310-legacy-button-secondary--text-base encore-internal-color-text-base e-10310-legacy-button e-10310-legacy-button-secondary e-10310-overflow-wrap-anywhere x-settings-button e-10310-legacy-button--trailing" data-encore-id="buttonSecondary">View<span aria-hidden="true" class="e-10310-button__icon-wrapper"><svg data-encore-id="icon" role="img" aria-hidden="true" class="e-10310-icon e-10310-baseline" viewBox="0 0 16 16" style="--encore-icon-height: var(--encore-graphic-size-decorative-smaller); --encore-icon-width: var(--encore-graphic-size-decorative-smaller);"><path d="M1 2.75A.75.75 0 0 1 1.75 2H7v1.5H2.5v11h10.219V9h1.5v6.25a.75.75 0 0 1-.75.75H1.75a.75.75 0 0 1-.75-.75z"></path><path d="M15 1v4.993a.75.75 0 1 1-1.5 0V3.56L8.78 8.28a.75.75 0 0 1-1.06-1.06l4.72-4.72h-2.433a.75.75 0 0 1 0-1.5z"></path></svg></span></a>
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
        return;
    }

    const existingSections = Array.from(document.querySelectorAll(`#${SETTINGS_ID}`)) as HTMLElement[];
    const inContainerSections = existingSections.filter(section => settingsContainer.contains(section));
    const existingSection = inContainerSections[0] || existingSections[0] || null;

    for (const section of existingSections) {
        if (section !== existingSection) {
            section.remove();
        }
    }

    const alreadyInContainer = !!existingSection && settingsContainer.contains(existingSection);
    if (alreadyInContainer) return;

    const settingsSection = existingSection || createSettingsSection();

    const sltSettings = document.getElementById('spicy-lyric-translator-settings');
    const spicyLyricsSettings = document.getElementById('spicy-lyrics-settings');
    const spicyLyricsDevSettings = document.getElementById('spicy-lyrics-dev-settings');

    if (sltSettings) {
        sltSettings.after(settingsSection);
    } else if (spicyLyricsDevSettings) {
        spicyLyricsDevSettings.after(settingsSection);
    } else if (spicyLyricsSettings) {
        spicyLyricsSettings.after(settingsSection);
    } else {
        const pageSections = settingsContainer.querySelectorAll('.x-settings-section');
        if (pageSections.length > 0) {
            const lastSection = pageSections[pageSections.length - 1];
            const lastSectionParent = lastSection.closest('div:not(.x-settings-section):not(.x-settings-container)') || lastSection;
            lastSectionParent.after(settingsSection);
        } else {
            settingsContainer.appendChild(settingsSection);
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
    const globalWindow = window as typeof window & { [SETTINGS_WATCHER_FLAG]?: boolean };
    if (globalWindow[SETTINGS_WATCHER_FLAG]) {
        return;
    }
    globalWindow[SETTINGS_WATCHER_FLAG] = true;

    if (isOnSettingsPage()) {
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
        }
    } catch (e) {
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


export function openSettingsModal(): void {
    if (Spicetify.PopupModal) {
        Spicetify.PopupModal.display({
            title: 'Spicy Themes',
            content: createSettingsModal(),
            isLarge: true
        });
    }
}

export async function registerSettings(): Promise<void> {
    while (
        typeof Spicetify === 'undefined' ||
        !Spicetify.Platform ||
        !Spicetify.Player
    ) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    watchForSettingsPage();

    const registerMenuItem = () => {
        const globalWindow = window as typeof window & { [MENU_REGISTERED_FLAG]?: boolean };
        if (globalWindow[MENU_REGISTERED_FLAG]) {
            return true;
        }

        if ((Spicetify as any).Menu) {
            try {
                new (Spicetify as any).Menu.Item(
                    'Spicy Themes',
                    false,
                    openSettingsModal
                ).register();
                globalWindow[MENU_REGISTERED_FLAG] = true;
                return true;
            } catch (e) {
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

}
