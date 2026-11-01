# crt-skin

Turn any website into a picture on an old tube TV. Scanlines, snow, hum bars, colour fringes, a channel button. Your page keeps its fonts, colours and buttons; the skin only puts the TV in front of it. No build step, no framework, nothing loaded from outside.

[![The demo page with the skin on: SMPTE colour bars behind the headline, scanlines and snow over everything, a green CH1 top right](screenshot.png)](https://tbx.github.io/crt-skin/demo/)

Demo: https://tbx.github.io/crt-skin/demo/

The look follows [GOROman's Famicom RF decoder](https://github.com/GOROman/famicom-rf-hackrf-decoder): a page received over the antenna, not rendered on a display.

## Install

Put `crt.css`, `crt.js` and the `fonts/` folder next to each other. Add two lines to your page:

```html
<html data-skin="crt">
  <link rel="stylesheet" href="crt.css">
  <script src="crt.js"></script>
```

Load the script in the `<head>` without `defer`. It is small, and that way the attribute is set before the first paint, so nothing jumps.

Leave `data-skin="crt"` out and the skin stays off until a visitor opens the page with `?skin=crt`. The choice is remembered in `localStorage`, `?skin=off` clears it. Both work whether the attribute is in your HTML or not.

The content that should wave during interference needs to sit inside a `<main>` element. Everything else works on any markup.

## What it does

- **Power on.** The picture comes in disturbed: snow, hum bar, the content waves. After three seconds it settles. Headings carry colour fringes and snap into focus as they enter the screen.
- **Reception.** Leave the page alone for ten seconds and the signal drifts for four. Any touch, key, scroll or mouse move brings it back. On Android a shake counts too. While you scroll, the fringes widen.
- **Channels.** The pulsing `CH1` top right switches channels. CH1 is your page. CH2 is static, every click returns, after ten seconds it returns by itself. CH3 shows an image or video of your choice and is off unless you set one. The last channel is your page with clean reception: no artifacts at all, only the occasional drift after ten quiet seconds. Number keys and the arrow keys switch too.
- **Weak hardware.** Reduced motion, data saver, little memory, few cores, or a short frame test under about 45 fps after load switch to a lite mode: scanlines and vignette stay, nothing animates, text stays sharp. The result is kept for the session. `?crt=lite` forces it, `?crt=full` turns it off.

## Your page stays your page

`crt.css` is only the signal. It makes the page dark (a screen is dark), lays scanlines, shadow mask, curvature, snow, hum bar and flicker over it, gives headings their colour fringes, saturates photos like NTSC chroma and adds the channel button. Fonts, sizes, colours, links, buttons and forms stay as your site styles them.

If your site has a dark mode, point the skin at it:

```css
html[data-skin="crt"] { --crt-bg: #101010; --crt-fg: #f3f1ee; }
```

## Device look (optional)

`crt-look.css` adds the look of the device itself: NES palette, Press Start 2P (SIL Open Font License, included in `fonts/`) for `h1`, `h2` and anything marked `data-crt="title"`, lime links, buttons and form fields with thick frames, pixel markers. Add it after `crt.css`:

```html
  <link rel="stylesheet" href="crt.css">
  <link rel="stylesheet" href="crt-look.css">
```

Heading sizes are fixed pixel steps (40, 32, 24 for `h1`, 24 and 16 for `h2`) because the font is an 8 px grid and fractional sizes make the pixels uneven. The demo has a button that switches the look on and off.

## Hooks

A few optional attributes give the skin more to work with:

| Attribute | Effect |
| --- | --- |
| `data-crt="hero"` | A section with a photo: saturated like NTSC chroma, darkened from below, a second layer of scanlines. Children other than the image are raised above the gradient. |
| `data-crt="photo"` | A figure with a second layer of scanlines and a colour fringe. With `crt-look.css` also a frame. |
| `data-crt="title"` | Any element that carries fringes and snaps into focus like a heading, for example a quote. With `crt-look.css` it also gets the pixel font. |
| `data-crt="marker"` | Small pixel labels like A, B, C. `crt-look.css` only. |
| `data-crt="button"` | A link that looks like a button. `crt-look.css` only. |
| `data-crt="muted"` | Dimmed text. `crt-look.css` only. |

## Channel 3

Give the script tag an image or video and CH3 appears:

```html
<script src="crt.js" data-ch3="late-night.mp4" data-ch3-label="Channel 3: late night"></script>
```

The file is only loaded when someone switches to CH3. Videos play muted and looped. `data-label` sets the screen reader text of the channel button (default "Switch channel"). With CH3 set, the clean channel is CH4; without it, CH3.

## JavaScript API

`window.crtSkin` has `on()`, `off()`, `toggle()`, `isOn()` and `channel(n)`. The demo uses `toggle()` for its on/off switch.

## Adjusting

Colours and the position of the channel button are custom properties on `html[data-skin="crt"]`:

```css
html[data-skin="crt"] {
  --crt-ch-top: 20px;
  --crt-ch-right: 20px;
  --crt-lime: #39ff14;
}
```

Every rule in `crt.css` sits under `html[data-skin="crt"]:not(#_)`, which gives it ID specificity so it wins over your component styles without `!important`. To override something, use the same prefix.

## States

The script sets these attributes on `html`; the CSS reacts to them:

| Attribute | Meaning |
| --- | --- |
| `data-crt="stable"` | The picture stands. Without it: snow, hum bar, waves. |
| `data-crt-scrolling` | Set while scrolling. |
| `data-crt-ch="static"` | CH2, static only. |
| `data-crt-ch="media"` | CH3, your image or video. |
| `data-crt-ch="clean"` | The clean channel: no artifacts while the picture stands. |
| `data-crt-lite` | Lite mode for weak hardware. |

## Things learned the hard way

- iOS Safari clips fixed layers at the status bar and the Safari bar, so there the page showed through without snow. Nothing in the skin is `position: fixed` except the channel button. The scanlines are an absolute, document sized layer on the content; snow, curvature, hum bar, flicker and channel 3 are absolute document layers with a `position: sticky` screen inside that reaches 10 vh beyond the viewport top and bottom.
- No `overflow: hidden` on `body` for full screen channels: on desktop the scrollbar disappears and fixed elements jump. `touch-action: none` on the layer does the job.
- Two quick taps on the channel button zoom the page on iOS. `touch-action: manipulation` on `body` and the button turns the double tap zoom off, pinch zoom stays.
- Waves are `translateX` only, never `skewX`. On a very tall `main`, half a degree tips the content by 60 px and creates horizontal scrolling. `overflow-x: clip` on `body` catches the rest.
- Scanlines over body text stay at about 12 percent opacity. Headings and photos get a second layer.

## Development

`crt.js` is built from `src/crt.ts` with esbuild and the built file is in the repo, so users need no tooling.

```bash
npm install
npm run build
```

`npm run demo` serves the repo on port 8765, the demo is at `/demo/`.

## License

MIT, see `LICENSE`. Made by [@tbx](https://x.com/tbx). Press Start 2P by CodeMan38 under the SIL Open Font License, see `fonts/LICENSE-OFL.txt`.
