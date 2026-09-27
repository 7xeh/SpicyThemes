import { openDialog, topSurface, SurfaceHandle, SurfaceOptions } from './surface';

interface ModalOptions {
    title: string;
    content: HTMLElement | string;
    isLarge?: boolean;
    onClose?: (() => void) | null;
}

export function hideModal(): void {
    topSurface()?.close();
}

export function displayModal(options: ModalOptions): SurfaceHandle {
    const content = typeof options.content === 'string'
        ? Object.assign(document.createElement('div'), { innerHTML: options.content })
        : options.content;
    const surface: SurfaceOptions = {
        title: options.title,
        content,
        size: options.isLarge ? 'lg' : 'md',
        onClose: options.onClose || undefined,
    };
    return openDialog(surface);
}
