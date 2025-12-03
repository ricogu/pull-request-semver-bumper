import { parse } from 'parse-commit-message';

export type VersionLevel = 'major' | 'minor' | 'patch';

export function determineVersionLevelFromPRTitle(
    title: string
): VersionLevel {
    const result = parse(title);
    const { header } = result[0];
    const { type, subject } = header;

    if (type.includes('!') || (subject && subject.includes('BREAKING CHANGE'))) {
        return 'major';
    }

    if (type === 'feat') return 'minor';

    return 'patch';
}
