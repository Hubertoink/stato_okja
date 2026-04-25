const BACKGROUND_STORAGE_KEY = 'stato:background' as const;

export type BackgroundId = 'stato' | 'bg2' | 'bg3';

type BackgroundOption = {
	id: BackgroundId;
	label: string;
	url: string;
};

const statoUrl = new URL('../../assets/Background_Stato.jpg', import.meta.url).href;
const bg2Url = new URL('../../assets/Background_2.jpg', import.meta.url).href;
const bg3Url = new URL('../../assets/Background_3.jpg', import.meta.url).href;

export const BACKGROUNDS: BackgroundOption[] = [
	{ id: 'stato', label: 'Stato', url: statoUrl },
	{ id: 'bg2', label: 'Hintergrund 2', url: bg2Url },
	{ id: 'bg3', label: 'Hintergrund 3', url: bg3Url },
];

function isBackgroundId(value: unknown): value is BackgroundId {
	return value === 'stato' || value === 'bg2' || value === 'bg3';
}

export function getStoredBackgroundId(): BackgroundId {
	try {
		const raw = localStorage.getItem(BACKGROUND_STORAGE_KEY);
		if (isBackgroundId(raw)) return raw;
	} catch {
		// ignore
	}
	return 'stato';
}

export function applyBackground(id: BackgroundId) {
	const bg = BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
	document.documentElement.style.setProperty('--app-bg-image', `url("${bg.url}")`);
	try {
		localStorage.setItem(BACKGROUND_STORAGE_KEY, bg.id);
	} catch {
		// ignore
	}
}

export function applyStoredBackground() {
	applyBackground(getStoredBackgroundId());
}
