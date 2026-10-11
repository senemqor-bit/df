import sys, subprocess, math
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]
W, H, FPS, SS = 720, 240, 2, 2
LEAD, TAIL = 5, 10
PROGRAM = [('warmup',300),('sprint',60),('recovery',60),('sprint',120),('recovery',60),('sprint',60),('recovery',60),
           ('sprint',120),('recovery',60),('sprint',180),('recovery',120),('sprint',120),('recovery',60),('sprint',120),
           ('recovery',60),('sprint',90),('cooldown',150)]
KIND = {'warmup':('WARM UP',(95,141,255)),'sprint':('SPRINT',(255,61,87)),'recovery':('RECOVERY',(255,216,74)),'cooldown':('COOL DOWN',(95,141,255))}
starts=[];a=0
for k,s in PROGRAM: starts.append(a); a+=s
TOTAL=a
F='/usr/share/fonts/opentype/inter/'
f_time=ImageFont.truetype(F+'Inter-Bold.otf',46*SS)
f_label=ImageFont.truetype(F+'Inter-ExtraBold.otf',74*SS)
f_sub=ImageFont.truetype(F+'Inter-SemiBold.otf',25*SS)
BG=(11,13,20)
def mmss(s):
    s=max(0,math.ceil(s-1e-9)); return f'{s//60:02d}:{s%60:02d}'
def short(s): return f'{s//60}:{s%60:02d}'
def frame(t):
    im=Image.new('RGB',(W*SS,H*SS),BG); d=ImageDraw.Draw(im)
    cx,cy,r=120*SS,120*SS,104*SS
    if t<LEAD:
        col=(95,141,255); frac=t/LEAD; time=str(math.ceil(LEAD-t)); label='READY'; sub=f'1/{len(PROGRAM)} · NEXT WARM UP 5:00'; flash=None
    elif t>=LEAD+TOTAL:
        col=(79,227,161); frac=1; time='30:00'; label='FINISH'; sub='30 MIN COMPLETE'; flash=None
    else:
        e=t-LEAD; i=max(j for j in range(len(PROGRAM)) if starts[j]<=e)
        k,sec=PROGRAM[i]; into=e-starts[i]; rem=sec-into
        label,col=KIND[k]; frac=into/sec; time=mmss(rem)
        nxt=f'NEXT {KIND[PROGRAM[i+1][0]][0]} {short(PROGRAM[i+1][1])}' if i+1<len(PROGRAM) else 'LAST INTERVAL'
        sub=f'{i+1}/{len(PROGRAM)} · {nxt}'
        flash=None
        if into<2: flash=col                     # 구간 시작 2초: 배경 강조
        elif rem<=3 and i+1<len(PROGRAM) and int(rem*2)%2==1: flash=KIND[PROGRAM[i+1][0]][1]  # 마지막 3초 깜빡임
    if flash:
        d.rectangle((0,0,W*SS,H*SS),fill=tuple(int(BG[c]*0.7+flash[c]*0.3) for c in range(3)))
    d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=(20,24,36))
    rr=r-8*SS; w=13*SS
    d.arc((cx-rr,cy-rr,cx+rr,cy+rr),0,360,fill=(46,51,66),width=w)
    if frac>0: d.arc((cx-rr,cy-rr,cx+rr,cy+rr),-90,-90+360*frac,fill=col,width=w)
    d.text((cx,cy),time,font=f_time,fill=(255,255,255),anchor='mm')
    x=252*SS
    d.text((x,82*SS),sub,font=f_sub,fill=(205,210,222),anchor='ls')
    fl=f_label
    if d.textlength(label,font=fl)>(W-270)*SS:  # 긴 이름(COOL DOWN)은 칸에 맞게 줄임
        fl=ImageFont.truetype(F+'Inter-ExtraBold.otf',int(74*SS*(W-270)*SS/d.textlength(label,font=fl)))
    d.text((x,170*SS),label,font=fl,fill=col,anchor='ls')
    return im.resize((W,H),Image.LANCZOS)
n=(LEAD+TOTAL+TAIL)*FPS
p=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
  '-c:v','libx264','-preset','slow','-crf','26','-tune','animation','-pix_fmt','yuv420p','-g','20','-movflags','+faststart',out],stdin=subprocess.PIPE)
for f in range(n):
    p.stdin.write(frame(f/FPS).tobytes())
p.stdin.close(); p.wait()
if len(sys.argv)>2:
    for t in map(float,sys.argv[2:]): frame(t).save(out.replace('.mp4',f'_{int(t)}.png'))
