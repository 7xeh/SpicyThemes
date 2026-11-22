import { storage } from './storage';
import { themeState, saveThemeState, applyPreset, getAllPresets, saveCustomPreset, deleteCustomPreset, updateThemeProperty, mergeThemeConfig, BUILTIN_PRESETS } from './state';
import { injectThemeStyles } from './themeEngine';
import { setVideoAuto } from './videoMode';
import { getCurrentVersion, runManualUpdateCheck, registerSettingLinker } from './updater';
import { createSettingsModal, destroySettingsModal, isSettingsOpen, revealSetting, goToSettings, matchSettingInText, settingById, SCHEMA, FONT_OPTIONS, FieldDef, TabId } from './settingsModal';
import { openDialog, el } from './surface';
import { toast } from './toast';
import { ThemeConfig } from './state';
import { Icons } from './icons';

const SETTINGS_ID = 'spicy-themes-settings';
const MODAL_SETTINGS_ID = 'spicy-themes-modal-settings';
const SETTINGS_WATCHER_FLAG = '__spicyThemesSettingsWatcherRegistered';
const MENU_ITEM_KEY = '__spicyThemesMenuItem';

const EXTENSION_SECTION_SELECTOR = `#${SETTINGS_ID}, #${MODAL_SETTINGS_ID}, .spicy-themes-settings, #spicy-lyrics-settings, #spicy-lyrics-dev-settings, #spicy-lyric-translator-settings, [id$="-settings"], .x-settings-section[id]`;
const SIBLING_EXTENSION_IDS = ['spicy-lyric-translator-settings', 'spicy-lyrics-dev-settings', 'spicy-lyrics-settings'];

function nativeElements(root: ParentNode, selector: string): HTMLElement[] {
    try {
        return Array.from(root.querySelectorAll<HTMLElement>(selector))
            .filter(el => !el.closest(EXTENSION_SECTION_SELECTOR));
    } catch (e) {
        return [];
    }
}

function nativeSettingsClass(selectors: string | string[], fallback: string): string {
    for (const selector of Array.isArray(selectors) ? selectors : [selectors]) {
        for (const el of nativeElements(document, selector)) {
            if (typeof el.className === 'string' && el.className.trim()) return el.className;
        }
    }
    return fallback;
}

function withClasses(...lists: (string | undefined)[]): string {
    return Array.from(new Set(lists.join(' ').split(/\s+/).filter(Boolean))).join(' ');
}

const SETTINGS_PAGE = '[data-testid="settings-page"]';

function settingsLabelClass(): string {
    return nativeSettingsClass(
        ['.x-settings-section .x-settings-firstColumn label', `${SETTINGS_PAGE} label.encore-text-body-small`],
        'encore-text-body-small encore-internal-color-text-subdued'
    );
}

function settingsButtonClass(): string {
    return nativeSettingsClass(
        [
            '.x-settings-section button.x-settings-button',
            `${SETTINGS_PAGE} button[data-encore-id="buttonSecondary"]:not([class*="--trailing"]):not([class*="--leading"])`,
        ],
        'encore-text-body-small-bold encore-internal-color-text-base x-settings-button'
    );
}

function settingsHeadingClass(): string {
    return nativeSettingsClass(
        ['.x-settings-section h2', `${SETTINGS_PAGE} h2.encore-text-body-medium-bold`],
        'encore-text-body-medium-bold encore-internal-color-text-base'
    );
}

function settingsSelectClass(): string {
    return withClasses('main-dropDown-dropDown', nativeSettingsClass(
        ['select.main-dropDown-dropDown', `${SETTINGS_PAGE} select`],
        ''
    ));
}

function settingsToggleClasses(): { wrapper: string; input: string; track: string; knob: string } {
    const input = nativeElements(document, `${SETTINGS_PAGE} label > input[type="checkbox"]`)
        .find(el => !el.classList.contains('x-toggle-input') && el.nextElementSibling?.firstElementChild);
    const track = input?.nextElementSibling;
    return {
        wrapper: withClasses('x-toggle-wrapper', input?.parentElement?.className),
        input: withClasses('x-toggle-input', input?.className),
        track: withClasses('x-toggle-indicatorWrapper', track?.className),
        knob: withClasses('x-toggle-indicator', track?.firstElementChild?.className),
    };
}

const VOLATILE_DATA_ATTR = /^data-(testid|key|collection|index|encore-id|rac|react-|hovered|focused|focus-visible|pressed|selected)/;

function nativeSectionClass(): string {
    return withClasses('x-settings-section', nativeSettingsClass(['.x-settings-section'], ''));
}

function nativeRowAttributes(): [string, string][] {
    const root = settingsPageContainer() || document;
    const row = nativeElements(root, '[data-settings-row]')[0] || nativeElements(root, '.x-settings-row')[0];
    const attrs = new Map<string, string>([['data-settings-row', 'true']]);
    if (row) {
        for (const attr of Array.from(row.attributes)) {
            if (attr.name.startsWith('data-') && !VOLATILE_DATA_ATTR.test(attr.name)) attrs.set(attr.name, attr.value);
        }
    }
    return Array.from(attrs.entries());
}

function stampNativeRows(section: HTMLElement): void {
    const attrs = nativeRowAttributes();
    section.querySelectorAll<HTMLElement>('.x-settings-row').forEach(row => {
        for (const [name, value] of attrs) row.setAttribute(name, value);
    });
}

function nativeClassSignature(): string {
    return [
        settingsLabelClass(),
        settingsButtonClass(),
        settingsHeadingClass(),
        settingsSelectClass(),
        settingsToggleClasses().input,
        nativeSectionClass(),
        nativeRowAttributes().map(([name, value]) => `${name}=${value}`).join(','),
    ].join('|');
}

function createColorRow(id: string, label: string, currentValue: string, onChange: (value: string) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="${settingsLabelClass()}" for="${id}">${label}</label>
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
            <label class="${settingsLabelClass()}" for="${id}">${label}</label>
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
    const toggle = settingsToggleClasses();
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="${settingsLabelClass()}" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <label class="${toggle.wrapper}">
                <input id="${id}" class="${toggle.input}" type="checkbox" ${checked ? 'checked' : ''}>
                <span class="${toggle.track}">
                    <span class="${toggle.knob}"></span>
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

function createDropdownRow(id: string, label: string, options: { value: string; text: string; hint?: string }[], currentValue: string, onChange: (value: string) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="${settingsLabelClass()}" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <span>
                <select class="${settingsSelectClass()}" id="${id}">
                    ${options.map(opt => `<option value="${opt.value}" ${opt.value === currentValue ? 'selected' : ''}${opt.hint ? ` title="${opt.hint.replace(/"/g, '&quot;')}"` : ''}>${opt.text}</option>`).join('')}
                </select>
            </span>
        </div>
    `;
    const select = row.querySelector('select') as HTMLSelectElement;
    const showHint = () => {
        if (select) select.title = options.find(o => o.value === select.value)?.hint || '';
    };
    showHint();
    select?.addEventListener('change', () => {
        onChange(select.value);
        injectThemeStyles();
        showHint();
    });
    return row;
}

function createButtonRow(id: string, label: string, buttonText: string, onClick: () => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="${settingsLabelClass()}" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <button id="${id}" class="${settingsButtonClass()}" data-encore-id="buttonSecondary" type="button">${buttonText}</button>
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
            <label class="${settingsLabelClass()}" for="${id}">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <input type="text" id="${id}" class="${settingsSelectClass()}" style="width: 200px;" value="" placeholder="${placeholder}">
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

function createComingSoonRow(id: string, label: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'x-settings-row';
    row.innerHTML = `
        <div class="x-settings-firstColumn">
            <label class="${settingsLabelClass()}" for="${id}" style="opacity: 0.5;">${label}</label>
        </div>
        <div class="x-settings-secondColumn">
            <span class="st-coming-soon">Coming soon</span>
        </div>
    `;
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
    label.className = settingsLabelClass();
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
                deleteCustomPreset(preset.name, preset.sourceId);
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
            const container = settingsPageContainer();
            if (container?.contains(newSection)) keepSectionVisible(container, newSection);
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

        if (def.comingSoon) {
            row = createComingSoonRow(id, def.label);
            if (def.when) {
                row.style.display = def.when(themeState.activeTheme) ? '' : 'none';
                conditionalRows.push({ def, row });
            }
            container.appendChild(row);
            return;
        }

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
                if (opts.some(o => o.value === '__custom__')) {
                    const namedOptions = opts.filter(o => o.value !== '__custom__');
                    const isCustom = !namedOptions.some(o => o.value === cur);
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
                        updateConditionalVisibility();
                    });
                }
                break;
            }
            case 'text': {
                const curText = String(cur || '');
                row = createTextInputRow(id, def.label, curText === 'Custom Font' ? '' : curText, 'Enter font name', (v) => setProp(v));
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
    section.className = withClasses(nativeSectionClass(), 'spicy-themes-settings');
    section.dataset.stNative = nativeClassSignature();
    section.innerHTML = `<h2 class="${settingsHeadingClass()}">Spicy Themes</h2>`;

    const content = section;

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

    optionsContainer.appendChild(createToggleRow(
        'st-settings.video-auto',
        'Switch to music video automatically',
        themeState.videoAuto,
        (checked) => {
            setVideoAuto(checked);
            injectThemeStyles();
        }
    ));

    optionsContainer.appendChild(createPresetSelector());

    optionsContainer.appendChild(createButtonRow(
        'st-settings.save-preset',
        'Save Current as Preset',
        'Save Preset',
        () => askPresetName((name, desc) => {
            saveCustomPreset(name, desc);
            refreshSettings();
            toast({ kind: 'success', title: `Saved “${name}”`, description: 'You can find it in your presets.' });
        })
    ));

    renderSchemaFields(optionsContainer);

    optionsContainer.appendChild(createSectionHeader('Miscellaneous'));

    optionsContainer.appendChild(createButtonRow(
        'st-settings.check-updates',
        `Check for Updates (v${getCurrentVersion().text})`,
        'Check Now',
        async () => {
            const btn = document.getElementById('st-settings.check-updates') as HTMLButtonElement | null;
            if (!btn) return;
            await runManualUpdateCheck(btn);
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
            toast({ kind: 'success', title: 'Theme reset to Default' });
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
                presetName: themeState.activeBasePreset || themeState.activePresetName,
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
                            themeState.activeTheme = mergeThemeConfig(data.theme);
                        }
                        if (data.presets && Array.isArray(data.presets)) {
                            themeState.customPresets = data.presets;
                        }
                        if (data.presetName) {
                            themeState.activePresetName = data.presetName;
                            themeState.activeBasePreset = data.presetName;
                        }
                        saveThemeState();
                        injectThemeStyles();
                        refreshSettings();
                        toast({ kind: 'success', title: 'Theme imported', description: file.name });
                    } catch (e) {
                        toast({ kind: 'error', title: "That file isn't a Spicy Themes config", description: file.name });
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
            <label class="${settingsLabelClass()}">GitHub Repository</label>
        </div>
        <div class="x-settings-secondColumn">
            <a href="https://github.com/7xeh/SpicyThemes" target="_blank" class="${settingsButtonClass()}" data-encore-id="buttonSecondary">View<span aria-hidden="true" style="display: inline-flex; margin-left: 6px; vertical-align: middle;"><svg data-encore-id="icon" role="img" aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1 2.75A.75.75 0 0 1 1.75 2H7v1.5H2.5v11h10.219V9h1.5v6.25a.75.75 0 0 1-.75.75H1.75a.75.75 0 0 1-.75-.75z"></path><path d="M15 1v4.993a.75.75 0 1 1-1.5 0V3.56L8.78 8.28a.75.75 0 0 1-1.06-1.06l4.72-4.72h-2.433a.75.75 0 0 1 0-1.5z"></path></svg></span></a>
        </div>
    `;
    optionsContainer.appendChild(githubRow);

    content.appendChild(optionsContainer);
    stampNativeRows(section);

    return section;
}

function settingsPageContainer(): HTMLElement | null {
    const known = document.querySelector<HTMLElement>('.x-settings-container, [data-testid="settings-page"]');
    if (known) return known;
    if (!SETTINGS_ROUTE.test(currentRoutePath())) return null;
    const nativeSection = nativeElements(document, '.x-settings-section')[0];
    return nativeSection?.closest<HTMLElement>('main') || nativeSection?.parentElement || null;
}

function settingsSearchActive(container: HTMLElement): boolean {
    return Array.from(container.querySelectorAll<HTMLInputElement>('input[role="searchbox"], input[type="search"]'))
        .some(input => input.value.trim() !== '');
}

function keepSectionVisible(container: HTMLElement, section: HTMLElement): void {
    section.style.removeProperty('display');
    if (getComputedStyle(section).display !== 'none' || settingsSearchActive(container)) return;
    const shown = nativeElements(container, '.x-settings-section').find(el => getComputedStyle(el).display !== 'none');
    section.style.display = shown ? getComputedStyle(shown).display : 'block';
}

function inFlowHost(container: HTMLElement, section: HTMLElement): HTMLElement {
    let host = container;

    for (let depth = 0; depth < 4; depth++) {
        const children = (Array.from(host.children) as HTMLElement[]).filter(child => child !== section);
        if (children.length === 0) break;

        const allOutOfFlow = children.every(child => {
            const position = getComputedStyle(child).position;
            return position === 'absolute' || position === 'fixed';
        });
        if (!allOutOfFlow) break;

        host = children[children.length - 1];
    }

    return host;
}

function placeSettingsSection(container: HTMLElement, section: HTMLElement): void {
    const nativeSection = nativeElements(container, '.x-settings-section').pop() ||
                          nativeElements(container, 'section').pop() ||
                          null;

    section.classList.toggle('st-standalone', !nativeSection);

    const host = nativeSection?.parentElement || inFlowHost(container, section);
    if (section.parentElement !== host) {
        const anchor = SIBLING_EXTENSION_IDS
            .map(id => document.getElementById(id))
            .find(el => el?.parentElement === host);
        if (anchor) anchor.after(section);
        else host.appendChild(section);
    }

    keepSectionVisible(container, section);
}

function injectSettingsIntoPage(): void {
    const settingsContainer = settingsPageContainer();
    if (!settingsContainer) {
        return;
    }

    const existingSections = Array.from(document.querySelectorAll(`#${SETTINGS_ID}`)) as HTMLElement[];
    if (existingSections.length === 0 && nativeElements(settingsContainer, 'input[type="checkbox"], select').length === 0) {
        return;
    }
    const inContainerSections = existingSections.filter(section => settingsContainer.contains(section));
    const existingSection = inContainerSections[0] || existingSections[0] || null;

    for (const section of existingSections) {
        if (section !== existingSection) {
            section.remove();
        }
    }

    placeSettingsSection(settingsContainer, existingSection || createSettingsSection());
}

function removeInjectedSettings(): void {
    for (const section of Array.from(document.querySelectorAll(`#${SETTINGS_ID}`))) {
        section.remove();
    }
}

const SETTINGS_ROUTE = /(^|\/)(preferences|settings)(\/|$)/;

function currentRoutePath(): string {
    try {
        const path = Spicetify.Platform?.History?.location?.pathname;
        if (typeof path === 'string') return path;
    } catch (e) {}
    return window.location.pathname || '';
}

function isOnSettingsPage(): boolean {
    return SETTINGS_ROUTE.test(currentRoutePath()) || !!settingsPageContainer();
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
                } else {
                    removeInjectedSettings();
                }
            });
        }
    } catch (e) {
    }

    let settingsTimer: ReturnType<typeof setTimeout> | null = null;
    let settingsTask: (() => void) | null = null;
    const schedule = (task: () => void) => {
        settingsTask = task;
        if (settingsTimer) return;
        settingsTimer = setTimeout(() => {
            settingsTimer = null;
            const run = settingsTask;
            settingsTask = null;
            run?.();
        }, 150);
    };

    const observer = new MutationObserver(() => {
        const existing = document.getElementById(SETTINGS_ID);

        if (!isOnSettingsPage()) {
            if (existing) schedule(removeInjectedSettings);
            return;
        }

        const container = settingsPageContainer();
        if (existing && container && container.contains(existing)) {
            schedule(() => {
                const current = document.getElementById(SETTINGS_ID);
                if (current && current.dataset.stNative !== nativeClassSignature()) refreshSettings();
            });
            return;
        }

        schedule(injectSettingsIntoPage);
    });
    observer.observe(document.body, { childList: true, subtree: true });
}


function askPresetName(onSave: (name: string, description: string) => void): void {
    const nameInput = el('input', { class: 'st-ui-input', type: 'text', placeholder: 'Preset name', maxlength: '60', 'data-st-autofocus': true });
    const descInput = el('input', { class: 'st-ui-input', type: 'text', placeholder: 'Description (optional)', maxlength: '200' });
    const error = el('p', { class: 'st-ui-text st-ui-text-quiet', hidden: true, text: 'Give the preset a name first.' });
    const submit = () => {
        const name = nameInput.value.trim();
        if (!name) {
            error.hidden = false;
            nameInput.focus();
            return false;
        }
        onSave(name, descInput.value.trim());
        return true;
    };
    const form = el('div', { class: 'st-ui-form' },
        el('label', { class: 'st-ui-field' }, el('span', { text: 'Name' }), nameInput),
        el('label', { class: 'st-ui-field' }, el('span', { text: 'Description' }), descInput),
        error,
    );
    const dialog = openDialog({
        title: 'Save as preset',
        size: 'sm',
        body: [el('p', { class: 'st-ui-text', text: 'Keep the look you have now so you can come back to it any time.' }), form],
        actions: [
            { label: 'Cancel', kind: 'quiet' },
            { label: 'Save preset', kind: 'primary', keepOpen: true, onClick: (handle) => { if (submit()) handle.close(); } },
        ],
    });
    [nameInput, descInput].forEach(input => input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && submit()) dialog.close();
    }));
}

export function openSettingsModal(options: { reveal?: string; tab?: TabId; category?: string } = {}): void {
    if (isSettingsOpen()) {
        if (options.reveal) revealSetting(options.reveal);
        else if (options.tab) goToSettings(options.tab, options.category);
        return;
    }
    openDialog({
        title: 'Spicy Themes settings',
        bare: true,
        size: 'xl',
        className: 'st-settings-dialog',
        content: createSettingsModal({ tab: options.tab, category: options.category }),
        onClose: () => destroySettingsModal(),
    });
    if (options.reveal) revealSetting(options.reveal);
}

registerSettingLinker({
    match: matchSettingInText,
    byId: settingById,
    reveal: (id) => openSettingsModal({ reveal: id }),
});


export async function registerSettings(): Promise<void> {
    while (
        typeof Spicetify === 'undefined' ||
        !Spicetify.Platform ||
        !Spicetify.Player
    ) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    watchForSettingsPage();
    watchProfileMenu();

    if (registerSpicetifyMenuItem()) return;
    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        if (registerSpicetifyMenuItem() || attempts > 20) clearInterval(interval);
    }, 500);
}

const MENU_LABEL = 'ST Settings';
const MENU_ROW_ID = 'st-profile-menu-item';
const PROFILE_BUTTON_SELECTORS = ['[data-testid="user-widget-link"]', '.main-userWidget-box'];
const MENU_FALLBACK_KEY = 'spicy-themes:menu-fallback';
const MENU_EMPTY_GRACE_MS = 1200;
const MENU_WAIT_MS = 2000;
const MENU_SCRUB_ATTR = /^data-(testid|key|collection|index|react-|hovered|focused|focus-visible|pressed|selected)/;

type SpicetifyMenuItem = { register(): void; deregister?(): void };
type MenuHost = typeof window & { [MENU_ITEM_KEY]?: SpicetifyMenuItem | null };

function clientSignature(): string {
    const platform = (Spicetify.Platform as { version?: unknown } | undefined)?.version;
    const cli = (Spicetify as { Config?: { version?: unknown } }).Config?.version;
    return `${String(platform ?? '?')}|${String(cli ?? '?')}`;
}

function spicetifyMenuDisabled(): boolean {
    try {
        return localStorage.getItem(MENU_FALLBACK_KEY) === clientSignature();
    } catch (e) {
        return false;
    }
}

function registerSpicetifyMenuItem(): boolean {
    const host = window as MenuHost;
    if (host[MENU_ITEM_KEY] || spicetifyMenuDisabled()) return true;
    const Menu = (Spicetify as { Menu?: { Item?: new (...args: unknown[]) => SpicetifyMenuItem } }).Menu;
    if (typeof Menu?.Item !== 'function') return false;
    try {
        const item = new Menu.Item(MENU_LABEL, false, () => openSettingsModal(), Icons.Palette);
        item.register();
        host[MENU_ITEM_KEY] = item;
        return true;
    } catch (e) {
        return false;
    }
}

function dropSpicetifyMenuItem(): void {
    const host = window as MenuHost;
    const item = host[MENU_ITEM_KEY];
    if (!item) return;
    try {
        item.deregister?.();
    } catch (e) {}
    host[MENU_ITEM_KEY] = null;
    try {
        localStorage.setItem(MENU_FALLBACK_KEY, clientSignature());
    } catch (e) {}
}

function profileButton(): HTMLElement | null {
    for (const selector of PROFILE_BUTTON_SELECTORS) {
        const button = document.querySelector<HTMLElement>(selector);
        if (button) return button;
    }
    return null;
}

function menuItemsOf(menu: Element): HTMLElement[] {
    return Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]'))
        .filter(item => item.closest('[role="menu"]') === menu);
}

function linksToSettings(item: Element): boolean {
    const href = item.getAttribute('href') || item.querySelector('a[href]')?.getAttribute('href');
    if (!href) return false;
    try {
        return SETTINGS_ROUTE.test(new URL(href, window.location.origin).pathname);
    } catch (e) {
        return false;
    }
}

function findProfileMenu(): HTMLElement | null {
    const menus = Array.from(document.querySelectorAll<HTMLElement>('[role="menu"]'));
    const withSettings = menus.find(menu => menuItemsOf(menu).some(linksToSettings));
    if (withSettings) return withSettings;

    const button = profileButton();
    if (button?.getAttribute('aria-expanded') !== 'true') return null;
    const controlled = button.getAttribute('aria-controls');
    const target = controlled ? document.getElementById(controlled) : null;
    if (target) return target.matches('[role="menu"]') ? target : target.querySelector<HTMLElement>('[role="menu"]');
    return menus.length === 1 ? menus[0] : null;
}

function rowOf(item: HTMLElement, menu: HTMLElement): HTMLElement {
    let row = item;
    while (row.parentElement && row.parentElement !== menu) row = row.parentElement;
    return row;
}

function isOwned(node: Element): boolean {
    return !!node.closest(`#${CSS.escape(MENU_ROW_ID)}`);
}

function retag(el: HTMLElement, tag: string): HTMLElement {
    const next = document.createElement(tag);
    for (const attr of Array.from(el.attributes)) next.setAttribute(attr.name, attr.value);
    next.append(...Array.from(el.childNodes));
    el.replaceWith(next);
    return next;
}

function scrubClone(root: HTMLElement): void {
    for (const node of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
        for (const attr of Array.from(node.attributes)) {
            const name = attr.name;
            const volatileAria = name.startsWith('aria-') && name !== 'aria-hidden';
            if (name === 'id' || name === 'href' || name === 'target' || name === 'rel' || volatileAria || MENU_SCRUB_ATTR.test(name)) {
                node.removeAttribute(name);
            }
        }
    }
}

function textLeaf(root: HTMLElement): HTMLElement | null {
    for (const node of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
        if (node.closest('svg')) continue;
        if (Array.from(node.childNodes).some(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim())) return node;
    }
    return null;
}

function paletteGraphic(like: Element | null): Element {
    const graphic = document.importNode(new DOMParser().parseFromString(Icons.Palette, 'image/svg+xml').documentElement, true);
    for (const name of ['class', 'width', 'height', 'data-encore-id']) {
        const value = like?.getAttribute(name);
        if (value) graphic.setAttribute(name, value);
    }
    graphic.setAttribute('aria-hidden', 'true');
    return graphic;
}

function closeMenu(menu: HTMLElement): void {
    const escape = { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true };
    (menu.querySelector<HTMLElement>('[role^="menuitem"]') || menu).dispatchEvent(new KeyboardEvent('keydown', escape));
    requestAnimationFrame(() => {
        const button = profileButton();
        if (menu.isConnected && button?.getAttribute('aria-expanded') === 'true') button.click();
    });
}

function buildMenuRow(menu: HTMLElement, items: HTMLElement[]): HTMLElement | null {
    const plain = items.filter(item =>
        item.getAttribute('role') === 'menuitem' && !item.hasAttribute('aria-haspopup') && !isOwned(item)
    );
    const template =
        plain.find(item => item.tagName !== 'A' && item.querySelector('svg')) ||
        plain.find(item => item.tagName !== 'A') ||
        plain.find(linksToSettings) ||
        plain[0];
    if (!template) return null;

    const holder = document.createElement('div');
    let row = holder.appendChild(rowOf(template, menu).cloneNode(true) as HTMLElement);
    scrubClone(row);
    let item = row.matches('[role^="menuitem"]') ? row : row.querySelector<HTMLElement>('[role^="menuitem"]');
    if (!item) return null;
    if (item.tagName === 'A') {
        const swapped = retag(item, 'button');
        if (item === row) row = swapped;
        item = swapped;
    }

    row.id = MENU_ROW_ID;
    item.setAttribute('role', 'menuitem');
    item.tabIndex = -1;
    if (item instanceof HTMLButtonElement) item.type = 'button';

    const label = textLeaf(item);
    if (label) label.textContent = MENU_LABEL;
    else item.append(Object.assign(document.createElement('span'), { textContent: MENU_LABEL }));

    const nativeIcon = item.querySelector('svg');
    if (nativeIcon) nativeIcon.replaceWith(paletteGraphic(nativeIcon));

    const setFlag = (name: string, on: boolean) => on ? item.setAttribute(name, 'true') : item.removeAttribute(name);
    item.addEventListener('pointerenter', () => setFlag('data-hovered', true));
    item.addEventListener('pointerleave', () => setFlag('data-hovered', false));
    item.addEventListener('focus', () => setFlag('data-focused', true));
    item.addEventListener('blur', () => setFlag('data-focused', false));

    const activate = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        closeMenu(menu);
        openSettingsModal();
    };
    item.addEventListener('click', activate);
    item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') activate(event);
    });
    return row;
}

function syncProfileMenu(menu: HTMLElement): void {
    const items = menuItemsOf(menu);
    const owned = document.getElementById(MENU_ROW_ID);
    if (items.some(item => !isOwned(item) && item.textContent?.trim() === MENU_LABEL)) {
        owned?.remove();
        return;
    }
    if (owned?.parentElement === menu) return;
    owned?.remove();

    const row = buildMenuRow(menu, items);
    if (!row) return;
    const settingsRow = items.find(item => !isOwned(item) && linksToSettings(item));
    if (settingsRow) rowOf(settingsRow, menu).after(row);
    else menu.append(row);
}

function watchProfileMenu(): void {
    let waitUntil = 0;
    let frame = 0;
    let expandedEmptySince = 0;
    let openMenu: HTMLElement | null = null;
    let menuObserver: MutationObserver | null = null;
    let closeTimer: ReturnType<typeof setInterval> | null = null;

    const release = () => {
        menuObserver?.disconnect();
        menuObserver = null;
        if (closeTimer) clearInterval(closeTimer);
        closeTimer = null;
        openMenu = null;
        document.getElementById(MENU_ROW_ID)?.remove();
    };

    const adopt = (menu: HTMLElement) => {
        if (openMenu === menu) return;
        release();
        openMenu = menu;
        menuObserver = new MutationObserver(() => {
            if (menu.isConnected && menuItemsOf(menu).length) syncProfileMenu(menu);
        });
        menuObserver.observe(menu, { childList: true });
        closeTimer = setInterval(() => {
            if (menu.isConnected) return;
            const replacement = findProfileMenu();
            if (replacement && menuItemsOf(replacement).length) {
                adopt(replacement);
                syncProfileMenu(replacement);
            } else {
                release();
            }
        }, 300);
    };

    const tick = () => {
        frame = 0;
        const menu = findProfileMenu();
        const items = menu ? menuItemsOf(menu) : [];
        const expanded = profileButton()?.getAttribute('aria-expanded') === 'true';

        if (menu && items.length) {
            expandedEmptySince = 0;
            adopt(menu);
            syncProfileMenu(menu);
            return;
        }

        if (expanded && (window as MenuHost)[MENU_ITEM_KEY]) {
            expandedEmptySince ||= performance.now();
            if (performance.now() - expandedEmptySince > MENU_EMPTY_GRACE_MS) {
                expandedEmptySince = 0;
                dropSpicetifyMenuItem();
                return;
            }
        } else {
            expandedEmptySince = 0;
        }

        if (performance.now() < waitUntil) frame = requestAnimationFrame(tick);
    };

    const arm = () => {
        waitUntil = performance.now() + MENU_WAIT_MS;
        if (!frame) frame = requestAnimationFrame(tick);
    };

    document.addEventListener('click', arm, true);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') arm();
    }, true);
    arm();
}
