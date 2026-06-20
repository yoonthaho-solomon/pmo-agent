import styles from '../styles/primitives.module.css'

function StateBox({
  title,
  message,
  children,
}: {
  title: string
  message?: string
  children?: React.ReactNode
}) {
  return (
    <div className={`${styles.panel} ${styles.stateBox}`}>
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
        {children}
      </div>
    </div>
  )
}

export function LoadingState({ message = '데이터를 확인하고 있습니다.' }: { message?: string }) {
  return (
    <StateBox title="Loading" message={message}>
      <div style={{ height: 16 }} />
      <div className={styles.skeleton} />
    </StateBox>
  )
}

export function EmptyState({ message = '표시할 데이터가 없습니다.' }: { message?: string }) {
  return <StateBox title="Empty" message={message} />
}

export function PartialState({ message = '일부 데이터만 준비되었습니다.' }: { message?: string }) {
  return <StateBox title="Partial" message={message} />
}

export function ErrorState({ message = '데이터를 불러오지 못했습니다.' }: { message?: string }) {
  return <StateBox title="Error" message={message} />
}
