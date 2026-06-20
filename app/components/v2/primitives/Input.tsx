import type { InputHTMLAttributes } from 'react'
import styles from '../styles/primitives.module.css'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${styles.input} ${className}`} {...props} />
}
