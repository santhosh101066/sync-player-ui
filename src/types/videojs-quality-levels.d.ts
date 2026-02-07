import 'video.js';

declare module 'video.js' {
    export interface QualityLevel {
        id: string;
        label: string;
        width?: number;
        height?: number;
        bitrate?: number;
        enabled: boolean;
    }

    export interface QualityLevelList extends Array<QualityLevel> {
        addQualityLevel(qualityLevel: QualityLevel): void;
        removeQualityLevel(qualityLevel: QualityLevel): void;
        selectedIndex: number;
        on(event: string | symbol, listener: (...args: unknown[]) => void): this;
        off(event: string | symbol, listener: (...args: unknown[]) => void): this;
        trigger(event: string | symbol, ...args: unknown[]): boolean;
    }

    export interface Player {
        qualityLevels(): QualityLevelList;
    }
}
