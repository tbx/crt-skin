/*! crt-skin, Laufzeit (Quelle von crt.js, gebaut mit esbuild). https://github.com/tbx/crt-skin, MIT.

   Einschalten: html trägt data-skin="crt". Das Skript setzt es bei ?skin=crt und merkt sich die
   Wahl in localStorage ("crt-skin"), ?skin=off nimmt es weg. Steht das Attribut schon im HTML,
   ist das Skin immer an, bis jemand ?skin=off aufruft. Am besten im <head> ohne defer einbinden,
   dann ist das Attribut vor dem ersten Paint gesetzt und nichts springt um.

   Hardware-Weiche: data-crt-lite schaltet die laufenden Animationen ab. Sofort bei reduzierter
   Bewegung, Datensparmodus, wenig Speicher oder wenigen Kernen; sonst misst ein kurzer Frame-Test
   nach dem Laden, ob der Browser die Overlays flüssig schafft. Das Ergebnis bleibt für die Sitzung
   (sessionStorage "crt-lite"). ?crt=lite erzwingt den Modus, ?crt=full schaltet ihn ab.

   Störung: beim Einschalten gestört, nach 3 s steht das Bild. Nach 10 s ohne Tippen, Scrollen,
   Mausbewegung oder Taste kommt die Störung für 4 s zurück, dann wieder Ruhe und von vorn; die
   nächste Berührung beendet sie sofort. Auf Android zählt Schütteln ebenfalls (iOS fragt für den
   Sensor per Dialog nach, das lassen wir bewusst weg).

   Einrasten: h1, h2 und Elemente mit data-crt="title" tragen Farbsäume, solange das Bild gestört
   ist oder gescrollt wird. Steht ein Titel im Bild und ist Ruhe, bekommt er .crt-sharp und wird
   scharf (Übergang in crt.css). data-crt-scrolling liegt auf html, solange gescrollt wird.

   Kanäle: CH1 ist die Seite, CH2 nur Rauschen, CH3 ein eigenes Bild oder Video, der letzte Kanal
   die Seite mit sauberem Empfang (keine Artefakte, keine Einschaltstörung, nur die Störung nach der
   Ruhe). Das Skript baut Schirm, Kanalknopf und Kanal 3 selbst in den body. CH3 gibt es nur, wenn
   das Skript-Tag data-ch3="bild.gif" oder data-ch3="film.mp4" trägt; die Adresse wird erst beim
   ersten Umschalten geladen. Ohne CH3 ist der saubere Kanal CH3, sonst CH4. html trägt auf den
   anderen Kanälen data-crt-ch="static", "media" oder "clean". Auf Rauschen und Bild geht jeder
   Klick außerhalb des Knopfs zurück auf CH1, Rauschen nach 10 s auch von allein. Pfeiltasten und
   Zifferntasten schalten ebenfalls.

   Attribute am Skript-Tag:
     data-ch3        Adresse für Kanal 3 (gif, jpg, png, webp, mp4, webm). Ohne: nur CH1 und CH2.
     data-ch3-label  Beschreibung von Kanal 3 für Screenreader.
     data-label      Beschriftung des Kanalknopfs für Screenreader (Standard "Switch channel").

   Öffentlich: window.crtSkin mit on(), off(), toggle(), isOn(), channel(n). */

interface CrtSkin {
	on(): void;
	off(): void;
	toggle(): boolean;
	isOn(): boolean;
	channel(n?: number): number;
}
declare global { interface Window { crtSkin: CrtSkin; } }

const html = document.documentElement;
const script = (document.currentScript as HTMLScriptElement | null) ?? document.querySelector<HTMLScriptElement>('script[src*="crt"]');
const cfg = {
	ch3: script?.dataset.ch3 ?? '',
	ch3Label: script?.dataset.ch3Label ?? 'Channel 3',
	label: script?.dataset.label ?? 'Switch channel',
};
const KEY_SKIN = 'crt-skin', KEY_LITE = 'crt-lite';
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} } };
const session = { get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch {} } };

/* ---------- Einschalten ---------- */
const params = new URLSearchParams(location.search);
const q = params.get('skin');
if (q === 'crt') store.set(KEY_SKIN, 'crt');
else if (q === 'off') store.set(KEY_SKIN, 'off');
const saved = store.get(KEY_SKIN);
if (saved === 'crt') html.setAttribute('data-skin', 'crt');
else if (saved === 'off') html.removeAttribute('data-skin');

/* ---------- Hardware-Weiche ---------- */
const mode = params.get('crt');
if (mode === 'lite' || mode === 'full') session.set(KEY_LITE, mode === 'lite' ? '1' : '0');
const probeLite = () => {
	const known = session.get(KEY_LITE);
	if (known === '1') { html.setAttribute('data-crt-lite', ''); return; }
	if (known === '0') return;
	const n = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
	const weak = (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
		|| !!n.connection?.saveData
		|| (n.deviceMemory !== undefined && n.deviceMemory <= 2)
		|| (n.hardwareConcurrency !== undefined && n.hardwareConcurrency <= 2);
	if (weak) { html.setAttribute('data-crt-lite', ''); session.set(KEY_LITE, '1'); return; }
	/* Frame-Test: 800 ms Frames zählen, während Schnee, Brummstreifen und Wellen laufen. Unter 36 Frames (etwa 45 fps) wird es der Lite-Modus. */
	const probe = () => {
		let frames = 0;
		const start = performance.now();
		const tick = (t: number) => {
			frames++;
			if (t - start < 800) { requestAnimationFrame(tick); return; }
			const lite = frames < 36;
			if (lite) html.setAttribute('data-crt-lite', '');
			session.set(KEY_LITE, lite ? '1' : '0');
		};
		requestAnimationFrame(tick);
	};
	if (document.readyState === 'complete') setTimeout(probe, 300);
	else addEventListener('load', () => setTimeout(probe, 300), { once: true });
};

/* ---------- Laufzeit, einmal aufgebaut, läuft nur mit Skin ---------- */
let built = false;
let powerOn = () => {};
let setCh = (_n: number) => {};
let ch = 1;
const isOn = () => html.dataset.skin === 'crt';

const build = () => {
	if (built) return;
	built = true;

	/* Bedienung: Schirm (Wölbung, Schnee, Brummstreifen, Flackern), Kanalknopf, Kanal 3. Ohne Skin per CSS ausgeblendet.
	   Der Schirm ist eine absolute, dokumentgroße Ebene mit einem Bildschirm, der am Viewport klebt (crt.css):
	   iOS Safari beschneidet feste Ebenen an Statusleiste und Safari-Leiste, so nicht. */
	const ui = document.createElement('div');
	ui.className = 'crt-ui';
	const screenLayer = document.createElement('div');
	screenLayer.className = 'crt-screen';
	screenLayer.setAttribute('aria-hidden', 'true');
	const view = document.createElement('div');
	view.className = 'crt-screen-view';
	const hum = document.createElement('div');
	hum.className = 'crt-hum';
	const flick = document.createElement('div');
	flick.className = 'crt-flick';
	view.append(hum, flick);
	screenLayer.append(view);
	const chBtn = document.createElement('button');
	chBtn.className = 'crt-ch';
	chBtn.type = 'button';
	chBtn.setAttribute('aria-label', cfg.label);
	chBtn.textContent = 'CH1';
	ui.append(screenLayer, chBtn);
	let tv: HTMLElement | null = null;
	let media: HTMLImageElement | HTMLVideoElement | null = null;
	if (cfg.ch3) {
		tv = document.createElement('div');
		tv.className = 'crt-tv';
		tv.hidden = true;
		tv.setAttribute('role', 'img');
		tv.setAttribute('aria-label', cfg.ch3Label);
		const screen = document.createElement('div');
		screen.className = 'crt-tv-screen';
		if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(cfg.ch3)) {
			const v = document.createElement('video');
			v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.preload = 'none';
			v.setAttribute('playsinline', '');
			media = v;
		} else {
			const img = document.createElement('img');
			img.alt = '';
			media = img;
		}
		screen.append(media);
		tv.append(screen);
		ui.append(tv);
	}
	document.body.append(ui);
	/* Kanalliste: Seite, Rauschen, Bild (wenn gesetzt), sauber. Der Wert steht als data-crt-ch auf html. */
	const kinds: string[] = ['page', 'static', ...(tv ? ['media'] : []), 'clean'];
	const channels = kinds.length;
	/* Sender mit Bild: dort bleibt ein Klick ein Klick. */
	const isPage = (n: number) => kinds[n - 1] === 'page' || kinds[n - 1] === 'clean';

	/* ---------- Störung ---------- */
	/* Nach 10 s Ruhe stört es für 4 s, dann steht das Bild wieder, und der Zähler läuft von vorn. Jede Berührung beendet die Störung sofort. */
	const STABLE_AFTER = 3000, IDLE_AFTER = 10000, IDLE_NOISE = 4000;
	let idle: number | undefined, calm: number | undefined, warm: number | undefined;
	const setStable = (on: boolean) => { if (on) html.setAttribute('data-crt', 'stable'); else html.removeAttribute('data-crt'); };
	const armIdle = () => {
		clearTimeout(idle); clearTimeout(calm);
		idle = window.setTimeout(() => { setStable(false); calm = window.setTimeout(activity, IDLE_NOISE); }, IDLE_AFTER);
	};
	const activity = () => { if (!isOn()) return; setStable(true); armIdle(); };
	/* Einschalten: erst gestört, nach 3 s steht das Bild. Beim Laden und bei jeder Rückkehr auf CH1. */
	let clean = () => {};
	powerOn = () => { setStable(false); clearTimeout(idle); clearTimeout(calm); clearTimeout(warm); warm = window.setTimeout(activity, STABLE_AFTER); };
	/* Sauberer Kanal: steht sofort, nur der Zähler für die Störung nach der Ruhe läuft. */
	clean = () => { clearTimeout(warm); activity(); };
	let lastMove = 0;
	const onMove = () => { const t = Date.now(); if (t - lastMove > 400) { lastMove = t; activity(); } };
	['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach((e) => addEventListener(e, activity, { passive: true, capture: true }));
	addEventListener('pointermove', onMove, { passive: true });
	const DME = (window as any).DeviceMotionEvent;
	if (typeof DME !== 'undefined' && typeof DME.requestPermission !== 'function') {
		let last = 0;
		addEventListener('devicemotion', (e) => {
			const a = e.acceleration;
			if (!a || a.x == null || a.y == null || a.z == null) return;
			const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
			const now = Date.now();
			if (mag > 18 && now - last > 900) { last = now; activity(); }
		});
	}

	/* ---------- Einrasten ---------- */
	let scrollEnd: number | undefined;
	addEventListener('scroll', () => {
		onMove();
		html.setAttribute('data-crt-scrolling', '');
		clearTimeout(scrollEnd);
		scrollEnd = window.setTimeout(() => html.removeAttribute('data-crt-scrolling'), 220);
	}, { passive: true });
	const heads = document.querySelectorAll<HTMLElement>('h1, h2, [data-crt="title"]');
	if ('IntersectionObserver' in window) {
		const io = new IntersectionObserver((entries) => {
			entries.forEach((en) => {
				if (!en.isIntersecting) return;
				const el = en.target as HTMLElement;
				io.unobserve(el);
				/* Kurz nach dem Erscheinen einrasten, nicht mitten in der Bewegung. */
				setTimeout(() => el.classList.add('crt-sharp'), 300);
			});
		}, { threshold: 0.5 });
		heads.forEach((h) => io.observe(h));
	} else heads.forEach((h) => h.classList.add('crt-sharp'));

	/* ---------- Kanäle ---------- */
	let back: number | undefined;
	setCh = (n: number) => {
		if (n < 1 || n > channels || n === ch) return;
		clearTimeout(back);
		const from = ch;
		ch = n;
		const kind = kinds[n - 1];
		if (kind === 'page') html.removeAttribute('data-crt-ch'); else html.setAttribute('data-crt-ch', kind);
		chBtn.textContent = 'CH' + n;
		if (kind === 'static') back = window.setTimeout(() => setCh(1), 10000);
		if (tv && media) {
			if (kind === 'media') {
				if (!media.getAttribute('src')) media.src = cfg.ch3;
				tv.hidden = false;
				if (media instanceof HTMLVideoElement) media.play().catch(() => {});
			} else {
				tv.hidden = true;
				if (media instanceof HTMLVideoElement) media.pause();
			}
		}
		/* Zurück auf CH1: der Sender kommt wie beim ersten Besuch erst nach kurzer Störung rein. Der saubere Kanal steht sofort. */
		if (kind === 'page' && from !== 1) powerOn();
		else if (kind === 'clean') clean();
	};
	const next = () => setCh(ch === channels ? 1 : ch + 1);
	const prev = () => setCh(ch === 1 ? channels : ch - 1);
	chBtn.addEventListener('click', (e) => { e.stopPropagation(); next(); chBtn.blur(); });
	/* Tastatur: Ziffern direkt, Pfeil rechts und links zappen weiter und zurück. Nicht in Formularfeldern. */
	addEventListener('keydown', (e) => {
		if (!isOn()) return;
		const t = e.target as HTMLElement | null;
		if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t?.isContentEditable || e.altKey || e.ctrlKey || e.metaKey) return;
		if (e.key >= '1' && e.key <= '9') setCh(Number(e.key));
		else if (e.key === 'ArrowRight') next();
		else if (e.key === 'ArrowLeft') prev();
	});
	document.addEventListener('click', (e) => {
		if (isPage(ch) || e.target === chBtn) return;
		e.preventDefault(); e.stopPropagation();
		setCh(1);
	}, true);

	powerOn();
};

const start = () => {
	if (document.body) build();
	else addEventListener('DOMContentLoaded', build, { once: true });
};

/* ---------- Öffentliche Schnittstelle ---------- */
const api: CrtSkin = {
	on() {
		if (isOn()) return;
		store.set(KEY_SKIN, 'crt');
		html.setAttribute('data-skin', 'crt');
		probeLite();
		if (built) powerOn(); else start();
	},
	off() {
		if (!isOn()) return;
		store.set(KEY_SKIN, 'off');
		setCh(1);
		html.removeAttribute('data-skin');
		html.removeAttribute('data-crt');
		html.removeAttribute('data-crt-ch');
	},
	toggle() { if (isOn()) api.off(); else api.on(); return isOn(); },
	isOn,
	channel(n) { if (n !== undefined) setCh(n); return ch; },
};
window.crtSkin = api;

if (isOn()) { probeLite(); start(); }

export {};
