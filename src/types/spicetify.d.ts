declare const Spicetify: {
    Platform: {
        History: {
            location: { pathname: string };
            push: (path: string) => void;
            listen: (callback: (location: { pathname: string }) => void) => () => void;
        };
        PlaybackAPI: any;
    };
    Player: {
        data: {
            item: {
                uri: string;
                name: string;
                artists: Array<{ name: string; uri: string }>;
            };
            track: {
                uri: string;
            };
        };
        addEventListener: (event: string, callback: (...args: any[]) => void) => void;
        removeEventListener: (event: string, callback: (...args: any[]) => void) => void;
        getProgress: () => number;
        isPlaying: () => boolean;
    };
    getAudioData: (uri?: string) => Promise<any>;
    Playbar: {
        Button: any;
        Widget: any;
    };
    Tippy: (element: HTMLElement, options: any) => any;
    TippyProps: any;
    showNotification: (message: string, isError?: boolean, duration?: number) => void;
    PopupModal: {
        display: (options: { title: string; content: HTMLElement | string; isLarge?: boolean }) => void;
        hide: () => void;
    };
    LocalStorage: {
        get: (key: string) => string | null;
        set: (key: string, value: string) => void;
    };
    CosmosAsync: {
        get: (url: string) => Promise<any>;
        post: (url: string, body?: any) => Promise<any>;
        put: (url: string, body?: any) => Promise<any>;
        del: (url: string) => Promise<any>;
    };
    colorExtractor: (uri: string) => Promise<{ [key: string]: string }>;
    React: typeof React;
    ReactDOM: typeof ReactDOM;
};

declare interface Window {
    _spicy_lyrics?: any;
    _spicy_lyrics_metadata?: any;
    SpicyThemes?: any;
    SpicyLyricTranslater?: any;
}
