import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// 手機：從螢幕左緣往右滑 → 回上一頁
export function useSwipeBack() {
  const navigate = useNavigate()
  useEffect(() => {
    let startX = 0
    let startY = 0
    let tracking = false

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t && t.clientX <= 30) {
        startX = t.clientX
        startY = t.clientY
        tracking = true
      } else {
        tracking = false
      }
    }

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      // 明顯往右、且不是垂直滑動
      if (dx > 80 && Math.abs(dy) < 60) navigate(-1)
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [navigate])
}
