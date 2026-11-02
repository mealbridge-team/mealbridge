"""Generates public/music.wav: an original, royalty-free ambient bed for the video.

Warm pad chords (Am - F - C - G), a sub bass and a soft plucked pulse at 96 BPM, all
synthesised here from sine waves, so there are no samples and no licensing questions.
Usage: python make-music.py [seconds]
"""
import sys
import wave

import numpy as np

SR = 44100
SECS = float(sys.argv[1]) if len(sys.argv) > 1 else 150
BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
n = int(SR * SECS)
t = np.arange(n) / SR


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


# One chord per bar: A minor, F major, C major, G major (MIDI notes).
CHORDS = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]]
BASS = [45, 41, 36, 43]


def env(length, attack, release):
    e = np.ones(length)
    a, r = int(attack * SR), int(release * SR)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


left = np.zeros(n)
right = np.zeros(n)
bar_len = int(BAR * SR)
for b in range(int(SECS / BAR) + 1):
    start = b * bar_len
    if start >= n:
        break
    length = min(bar_len + int(1.5 * SR), n - start)  # chords overlap a little for smooth changes
    seg = t[:length]
    chord = CHORDS[b % 4]
    e = env(length, 1.2, 1.6)
    for note in chord:
        f = hz(note)
        # Two slightly detuned voices per note, panned apart, with a soft second harmonic.
        left[start : start + length] += e * (np.sin(2 * np.pi * f * 0.997 * seg) + 0.25 * np.sin(4 * np.pi * f * seg)) * 0.05
        right[start : start + length] += e * (np.sin(2 * np.pi * f * 1.003 * seg) + 0.25 * np.sin(4 * np.pi * f * seg)) * 0.05
    bass = e * np.sin(2 * np.pi * hz(BASS[b % 4]) * seg) * 0.11
    left[start : start + length] += bass
    right[start : start + length] += bass
    # Plucked pulse: chord tones an octave up on eighth notes, quick decay.
    eighth = int(BEAT / 2 * SR)
    for k in range(8):
        s = start + k * eighth
        if s >= n:
            break
        pl = min(int(0.6 * SR), n - s)
        pt = t[:pl]
        note = chord[[0, 2, 1, 3, 2, 1, 3, 2][k]] + 12
        pluck = np.sin(2 * np.pi * hz(note) * pt) * np.exp(-pt * 7) * 0.035
        pan = 0.35 if k % 2 else -0.35
        left[s : s + pl] += pluck * (1 - pan)
        right[s : s + pl] += pluck * (1 + pan)

# Gentle low-pass (one-pole) to soften the top end, then a slow swell over the first bars.
def lowpass(x, cutoff=3500):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y

left, right = lowpass(left), lowpass(right)
swell = np.clip(t / 6, 0, 1)
fade = np.clip((SECS - t) / 3, 0, 1)
mix = np.stack([left, right], axis=1) * (swell * fade)[:, None]
mix *= 0.7 / np.max(np.abs(mix))

with wave.open("public/music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print(f"public/music.wav: {SECS:.1f}s")
