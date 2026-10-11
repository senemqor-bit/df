"""PiP 타이머 영상에 넣을 알림음 트랙(wav)을 만듭니다.

- 구간이 바뀌기 3, 2, 1초 전: 짧은 '삑' (마지막 1초 전은 더 높은 음)
- 구간이 바뀌는 순간: 긴 '삐-' (SPRINT 시작은 두 음으로 더 높게)
- 운동 종료: 세 음 상승
영상과 같은 시간축(준비 5초 포함)을 씁니다.

사용: python3 render_beeps.py beeps.wav
"""
import sys
import wave

import numpy as np

RATE = 22050
LEAD, TAIL = 5, 10
PROGRAM = [('warmup', 300), ('sprint', 60), ('recovery', 60), ('sprint', 120), ('recovery', 60),
           ('sprint', 60), ('recovery', 60), ('sprint', 120), ('recovery', 60), ('sprint', 180),
           ('recovery', 120), ('sprint', 120), ('recovery', 60), ('sprint', 120), ('cooldown', 300)]
TOTAL = sum(s for _, s in PROGRAM)
DUR = LEAD + TOTAL + TAIL

track = np.zeros(int(DUR * RATE), dtype=np.float32)


def tone(at, freq, dur, vol=0.6):
    n = int(dur * RATE)
    t = np.arange(n) / RATE
    env = np.minimum(1, t / 0.008) * np.exp(-t * (3.0 / dur))  # 짧은 어택, 자연스러운 감쇠
    wave_ = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 2 * t)
    i = int(at * RATE)
    seg = (wave_ * env * vol).astype(np.float32)
    track[i:i + n] += seg[:len(track) - i]


def countdown(boundary):
    for k in (3, 2, 1):
        tone(boundary - k, 990 if k == 1 else 740, 0.14)


def change(at, kind):
    if kind == 'sprint':
        tone(at, 880, 0.18)
        tone(at + 0.19, 1320, 0.6)
    else:
        tone(at, 660, 0.7)


# 준비 5초 → 워밍업 시작
countdown(LEAD)
change(LEAD, 'warmup')
t = LEAD
for i, (kind, sec) in enumerate(PROGRAM):
    t += sec
    if i + 1 < len(PROGRAM):
        countdown(t)
        change(t, PROGRAM[i + 1][0])
# 종료
countdown(t)
for j, f in enumerate((660, 880, 1100)):
    tone(t + j * 0.22, f, 0.6 if j == 2 else 0.2)

pcm = (np.clip(track, -1, 1) * 32767 * 0.9).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(pcm.tobytes())
