'use client'

import { useEffect, useRef, useState } from 'react'
import type { MatchingCallcardModel } from '@/lib/matching-studio-model'
import styles from './matchingStudio.module.css'

function formatOption(callcard: MatchingCallcardModel): string {
  const date = callcard.callDate ?? '날짜 없음'
  const hour = callcard.hourSlot !== null ? `${callcard.hourSlot}시` : '-'
  return `${date} ${hour} / ${callcard.id}`
}

export function CallcardSelect({
  callcards,
  selectedId,
  onSelect,
}: {
  callcards: MatchingCallcardModel[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const selected = callcards.find((callcard) => callcard.id === selectedId) ?? callcards[0] ?? null

  function place() {
    const r = buttonRef.current?.getBoundingClientRect()
    if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  function toggle() {
    if (!open) place()
    setOpen((o) => !o)
  }

  // Close on outside click, Escape, or any scroll/resize (the fixed menu would otherwise drift).
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return
      const menu = document.getElementById('km-v2-callcard-menu')
      if (menu?.contains(event.target as Node)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onScroll(event: Event) {
      // Ignore the menu's own internal scrolling — only close when an outer container scrolls.
      const menu = document.getElementById('km-v2-callcard-menu')
      if (menu && event.target instanceof Node && menu.contains(event.target)) return
      setOpen(false)
    }
    function onResize() {
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <div className={styles.callcardSelect} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.callcardSelectBtn}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="분석할 콜카드 선택"
      >
        <span>{selected ? formatOption(selected) : '콜카드 없음'}</span>
        <i aria-hidden data-open={open}>▾</i>
      </button>
      {open && rect ? (
        <div
          id="km-v2-callcard-menu"
          className={styles.callcardSelectMenu}
          role="listbox"
          style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
        >
          {callcards.map((callcard) => (
            <button
              key={callcard.id}
              type="button"
              role="option"
              aria-selected={callcard.id === selectedId}
              data-active={callcard.id === selectedId}
              onClick={() => {
                onSelect(callcard.id)
                setOpen(false)
              }}
            >
              {formatOption(callcard)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
