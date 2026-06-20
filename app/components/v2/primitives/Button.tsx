import type { ButtonHTMLAttributes } from 'react'
import styles from '../styles/primitives.module.css'

export function Button({
  variant = 'default',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary'
}) {
  return (
    <button
      className={`${styles.button} ${variant === 'primary' ? styles.buttonPrimary : ''} ${className}`}
      type={props.type ?? 'button'}
      {...props}
    />
  )
}
