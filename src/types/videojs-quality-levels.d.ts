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
        on(event: string | symbol, listener: (...args: any[]) => void): this;
        off(event: string | symbol, listener: (...args: any[]) => void): this;
        trigger(event: string | symbol, ...args: any[]): boolean;
    }

    export interface Player {
        qualityLevels(): QualityLevelList;
    }
}
