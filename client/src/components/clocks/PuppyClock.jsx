import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getDayName } from '../../utils/time.js'
import './PuppyClock.css'

// 舞台座標＝吃飯 sprite 的一格（424×532）。每張 sprite 以「碗中心、碗底」錨點對齊到這裡，
// 並依碗寬縮放，所以不同 sprite、同 sprite 內位置不一的格子都不會跳（原型見 client/test2.html）。
const STAGE = { width: 424, height: 532, anchor: [189, 501], bowlWidth: 234 }

// sheet：整張圖尺寸；crop：每格裁切窗；cropAnchor：錨點在裁切窗內的位置；
// anchors：每格錨點在整張圖上的座標；sequence = [格, 停留 ms]，播完一輪回到待機（吃飯第 1 格）。
const SPRITES = {
  happy: {
    src: '/puppy/eating.png',
    sheet: [3392, 532],
    crop: [424, 532],
    cropAnchor: STAGE.anchor,
    bowlWidth: STAGE.bowlWidth,
    anchors: Array.from({ length: 8 }, (_, i) => [424 * i + STAGE.anchor[0], STAGE.anchor[1]]),
    // 低頭咀嚼兩次後抬頭微笑
    sequence: [
      [0, 850], [1, 180], [2, 190], [3, 180], [5, 190],
      [3, 180], [2, 190], [3, 180], [5, 190], [4, 180],
      [1, 160], [6, 240], [7, 850], [0, 350],
    ],
    stillFrame: 7,
  },
  angry: {
    src: '/puppy/angry.png',
    // 4×2 格：笑臉、收舌頭、閉嘴、皺眉 / 生氣、轉頭、撇頭、閉眼
    sheet: [1774, 887],
    crop: [420, 430],
    cropAnchor: [200, 420],
    bowlWidth: 205,
    // 從圖量出的碗中心 x、碗底 y（兩排碗底高度不同、每格左右也不一，錨點把它們對齊）。
    // 換圖時要重新量，否則播放會左右晃或上下跳。
    anchors: [
      [208, 434], [636, 434], [1075, 434], [1519, 434],
      [209.5, 865], [638.5, 865], [1081, 865], [1524.5, 865],
    ],
    // 笑臉 → 逐步生氣 → 撇頭閉眼停留 → 倒回笑臉
    sequence: [
      [0, 450], [1, 180], [2, 200], [3, 180], [4, 180], [5, 170], [6, 180], [7, 650],
      [6, 180], [5, 170], [4, 180], [3, 180], [2, 200], [1, 180], [0, 500],
    ],
    stillFrame: 4,
  },
}
const REDUCED_MOTION_MS = 1600
// 播放倍率：sequence 的停留時間一律除以它（保留原本節奏比例）。>1 較快，<1 較慢。
const PLAYBACK_RATE = 1.5

function framePosition(sprite, frame) {
  const [sheetW, sheetH] = sprite.sheet
  const [cropW, cropH] = sprite.crop
  const [ax, ay] = sprite.anchors[frame]
  // 百分比定位：p% 代表裁切窗左上 = 整張圖的 p × (sheet − crop)
  const px = sheetW === cropW ? 0 : ((ax - sprite.cropAnchor[0]) / (sheetW - cropW)) * 100
  const py = sheetH === cropH ? 0 : ((ay - sprite.cropAnchor[1]) / (sheetH - cropH)) * 100
  return `${px}% ${py}%`
}

function spriteStyle(sprite, frame) {
  const [sheetW, sheetH] = sprite.sheet
  const [cropW, cropH] = sprite.crop
  const [cax, cay] = sprite.cropAnchor
  const scale = STAGE.bowlWidth / sprite.bowlWidth
  const stageGapBelow = STAGE.height - 1 - STAGE.anchor[1]
  const cropGapBelow = (cropH - 1 - cay) * scale
  return {
    width: `${((cropW * scale) / STAGE.width) * 100}%`,
    aspectRatio: `${cropW} / ${cropH}`,
    left: `${((STAGE.anchor[0] - cax * scale) / STAGE.width) * 100}%`,
    bottom: `${((stageGapBelow - cropGapBelow) / STAGE.height) * 100}%`,
    backgroundImage: `url("${sprite.src}")`,
    backgroundSize: `${(sheetW / cropW) * 100}% ${(sheetH / cropH) * 100}%`,
    backgroundPosition: framePosition(sprite, frame),
  }
}

// 逐格直接改 DOM，避免每格觸發 re-render；播完呼叫 onDone(id)。
function SpritePlayer({ id, sprite, onDone }) {
  const ref = useRef(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sequence = reduced
      ? [[sprite.stillFrame, REDUCED_MOTION_MS]]
      : sprite.sequence.map(([frame, ms]) => [frame, ms / PLAYBACK_RATE])
    const total = sequence.reduce((sum, [, ms]) => sum + ms, 0)
    let start = null
    let raf = requestAnimationFrame(function tick(now) {
      start ??= now
      let elapsed = now - start
      if (elapsed >= total) {
        onDone(id)
        return
      }
      let frame = sequence[0][0]
      for (const [index, ms] of sequence) {
        frame = index
        if (elapsed < ms) break
        elapsed -= ms
      }
      ref.current.style.backgroundPosition = framePosition(sprite, frame)
      raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
  }, [id, sprite, onDone])

  return <span ref={ref} className="puppy-clock-sprite" style={spriteStyle(sprite, sprite.sequence[0][0])} />
}

/**
 * 小狗打卡鐘。reaction = { id, mood: 'happy' | 'angry' }：每次打卡成功由父層給一個新 id，
 * 這裡播一輪對應動畫。動畫只是回饋，不觸發也不完成任何請求。
 */
export default function PuppyClock({ isClockedIn, isPunching, currentTime, onClick, hint, reaction }) {
  const { t, i18n } = useTranslation()
  const [finishedId, setFinishedId] = useState(null)
  const handleDone = useCallback((id) => setFinishedId(id), [])
  const playing = reaction && reaction.id !== finishedId ? reaction : null

  // 吃飯 sprite 就是待機圖、已載入；先暖好生氣那張，反應才能即時播
  useEffect(() => {
    const img = new Image()
    img.src = SPRITES.angry.src
  }, [])

  return (
    <button
      className="puppy-clock"
      type="button"
      onClick={onClick}
      disabled={isPunching}
      aria-busy={isPunching}
      aria-label={isPunching ? t('common.submitting') : hint}
    >
      <span className="puppy-clock-stage" aria-hidden="true">
        <span className="puppy-clock-ground" />
        {playing ? (
          <SpritePlayer key={playing.id} id={playing.id} sprite={SPRITES[playing.mood]} onDone={handleDone} />
        ) : (
          <span className="puppy-clock-sprite" style={spriteStyle(SPRITES.happy, 0)} />
        )}
      </span>
      <span className="puppy-clock-time">
        <span>{String(currentTime.getHours()).padStart(2, '0')}:{String(currentTime.getMinutes()).padStart(2, '0')}</span>
        <span className="puppy-clock-seconds">{String(currentTime.getSeconds()).padStart(2, '0')}</span>
      </span>
      <span className="puppy-clock-action" role="status">
        {isPunching ? t('common.submitting') : t(isClockedIn ? 'attendance.clockOutEn' : 'attendance.clockInEn')}
      </span>
      <span className="puppy-clock-date">
        {currentTime.getFullYear()}.{currentTime.getMonth() + 1}.{currentTime.getDate()} {getDayName(currentTime, i18n.resolvedLanguage)}
      </span>
    </button>
  )
}
