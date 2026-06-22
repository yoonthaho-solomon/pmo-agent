export default function MatchingStudioLoading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 'calc(100vh - 52px)',
      flexDirection: 'column',
      gap: '14px',
      color: '#7c89a0',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '13px',
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '2px solid rgba(99,126,164,.2)',
        borderTop: '2px solid #a78bfa',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span>매칭 스튜디오 로딩 중...</span>
      <span style={{ fontSize: '11px', color: '#4d596b' }}>콜카드 + 기사 벡터 계산 중</span>
    </div>
  )
}
