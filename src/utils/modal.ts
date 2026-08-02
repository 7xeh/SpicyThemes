interface ModalOptions {
    title: string;
    content: HTMLElement | string;
    isLarge?: boolean;
    onClose?: (() => void) | null;
}

const CLOSE_SVG = '<svg width="18" height="18" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><title>Close</title><path d="M31.098 29.794L16.955 15.65 31.097 1.51 29.683.093 15.54 14.237 1.4.094-.016 1.508 14.126 15.65-.016 29.795l1.414 1.414L15.54 17.065l14.144 14.143" fill="currentColor" fill-rule="evenodd"></path></svg>';

let activeModal: HTMLElement | null = null;
let activeOnClose: (() => void) | null = null;
let escapeHandler: ((event: KeyboardEvent) => void) | null = null;

function bindEscape(): void {
    unbindEscape();
    escapeHandler = (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        hideModal();
    };
    document.addEventListener('keydown', escapeHandler);
}

function unbindEscape(): void {
    if (!escapeHandler) return;
    document.removeEventListener('keydown', escapeHandler);
    escapeHandler = null;
}

function genericModalElement(): any {
    try {
        if (typeof customElements === 'undefined') return null;
        const Ctor = customElements.get('sl-generic-modal') as (new () => HTMLElement) | undefined;
        return Ctor ? new Ctor() : null;
    } catch {
        return null;
    }
}

function fallbackModalHost(): HTMLElement | null {
    try {
        if (typeof customElements !== 'undefined' && customElements.get('sl-generic-modal')) return null;
        return document.createElement('sl-generic-modal');
    } catch {
        return null;
    }
}

function escapeForHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function spicyLyricsAvailable(): boolean {
    try {
        if ((globalThis as any).SpicyLyrics) return true;
        if (typeof customElements !== 'undefined' && customElements.get('sl-generic-modal')) return true;
        if (typeof document !== 'undefined' && document.querySelector('#SpicyLyricsPage, sl-generic-modal, .sl-modal-overlay')) return true;
    } catch {}
    return false;
}

export function hideModal(): void {
    unbindEscape();

    if (activeModal) {
        const modal = activeModal as any;
        const onClose = activeOnClose;
        activeModal = null;
        activeOnClose = null;

        if (typeof modal.hide === 'function') {
            try {
                modal.hide();
                return;
            } catch {}
        }

        const finish = () => {
            try { modal.remove(); } catch {}
            if (typeof onClose === 'function') {
                try { onClose(); } catch {}
            }
        };

        const overlay = modal.querySelector('.sl-modal-overlay-animated');
        if (overlay) {
            overlay.classList.remove('Active');
            setTimeout(finish, 250);
        } else {
            finish();
        }
        return;
    }

    const spicetify = (globalThis as any).Spicetify;
    spicetify?.PopupModal?.hide();
}

export function displayModal(options: ModalOptions): void {
    if (activeModal) {
        try { activeModal.remove(); } catch {}
        activeModal = null;
        activeOnClose = null;
    }
    unbindEscape();

    const native = genericModalElement();
    if (native && typeof native.display === 'function') {
        activeModal = native;
        activeOnClose = null;
        try {
            native.display({
                title: options.title,
                content: options.content,
                isLarge: options.isLarge,
                onClose: () => {
                    if (activeModal === native) {
                        activeModal = null;
                        activeOnClose = null;
                    }
                    unbindEscape();
                    if (typeof options.onClose === 'function') {
                        try { options.onClose(); } catch {}
                    }
                }
            });
            bindEscape();
            return;
        } catch {
            activeModal = null;
        }
    }

    const host = spicyLyricsAvailable() ? fallbackModalHost() : null;
    if (!host) {
        const spicetify = (globalThis as any).Spicetify;
        spicetify?.PopupModal?.display({
            title: options.title,
            content: options.content,
            isLarge: options.isLarge
        });
        bindEscape();
        return;
    }

    host.classList.add('SpicyLyricsModal');
    const containerClass = options.isLarge ? 'sl-modal-container-large' : 'sl-modal-container';

    host.innerHTML = `
<div class="sl-modal-overlay sl-modal-overlay-animated" style="z-index: 100;">
    <div class="sl-modal" tabindex="-1" role="dialog" aria-modal="true" aria-label="${escapeForHtml(options.title || '')}">
        <div class="${containerClass}">
            <div class="sl-modal-header">
                <h1 class="sl-modal-title">${escapeForHtml(options.title || '')}</h1>
                <button aria-label="Close" class="sl-modal-close-btn" type="button">${CLOSE_SVG}</button>
            </div>
            <div class="sl-modal-main-section">
                <main class="sl-modal-content"></main>
            </div>
        </div>
    </div>
</div>`;

    const main = host.querySelector('main.sl-modal-content');
    if (main) {
        if (typeof options.content === 'string') {
            main.innerHTML = options.content;
        } else if (options.content instanceof Node) {
            main.append(options.content);
        }
    }

    activeModal = host;
    activeOnClose = options.onClose ?? null;

    host.querySelector('.sl-modal-close-btn')?.addEventListener('click', () => hideModal());

    const overlay = host.querySelector('.sl-modal-overlay');
    overlay?.addEventListener('click', (event) => {
        if (event.target === event.currentTarget) hideModal();
    });

    document.body.append(host);
    bindEscape();

    setTimeout(() => {
        host.querySelector('.sl-modal-overlay-animated')?.classList.add('Active');
    }, 50);
}
