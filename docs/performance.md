# Performance

[← Docs index](README.md)

If Spotify feels laggy or the lyric animations stutter, apply the **Raw Performance** preset — it turns every expensive effect off in one click.

To tune by hand, the costliest settings, roughly in order:

1. Synced music videos
2. Blur (especially with *Ramp blur with distance*)
3. Glow, active word glow, and glow pulse
4. Gradient text
5. The equalizer
6. Large active-line zoom and Wave word animation

Turning off a parent toggle disables everything under it, so switching **Line glow** off costs nothing extra to re-enable later — your colors and strengths are remembered.

Within the equalizer, the cost is mostly the same whichever style you pick — one animation frame drives them all. **Breathe** is the exception: its halos are blurred, which is the one genuinely expensive part. The equalizer also stops updating entirely while playback is paused, so leaving it on costs nothing when you are not listening.

---

See also: [Presets](presets.md) · [Settings reference](settings.md)
