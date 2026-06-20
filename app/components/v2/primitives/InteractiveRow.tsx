import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from '../styles/primitives.module.css'

export function InteractiveRow({
  children,
  selected = false,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  selected?: boolean
}) {
  return (
    <button className={`${styles.interactiveRow} ${className}`} data-selected={selected} type="button" {...props}>
      {children}
    </button>
  )
}
