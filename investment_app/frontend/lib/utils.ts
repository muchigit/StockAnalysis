export type RatingType = 'CR' | 'RS';

export function getRatingColor(score: number | undefined | null): string {
    const val = Number(score);
    if (!score && score !== 0) return 'text-gray-500 font-mono';

    if (val >= 95) return 'text-yellow-400 font-black text-lg font-mono drop-shadow-[0_1px_1px_rgba(34,197,94,0.8)]'; // Elite: Yellow/Green glow
    if (val >= 80) return 'text-green-400 font-bold font-mono';
    if (val >= 70) return 'text-yellow-500 font-bold font-mono';

    return 'text-gray-400 font-mono';
}
