"use client"

// global-error는 루트 레이아웃 밖에서 렌더돼 토큰 CSS가 로드되지 않을 수 있다.
// 이 화면 한 곳만 예외로 다크 팔레트 hex를 직접 기입한다 (design-2026-08-03-v2).
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, backgroundColor: "#182A24", color: "#F4F1E9" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 16px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
            문제가 생겼어요. 잠시 후 다시 시도해 주세요.
          </h1>
          <button
            onClick={reset}
            style={{
              marginTop: "24px",
              backgroundColor: "#C9A54A",
              color: "#182A24",
              padding: "8px 16px",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
            }}
          >
            새로고침
          </button>
        </div>
      </body>
    </html>
  )
}
