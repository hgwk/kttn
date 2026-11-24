// 창 안에 내리는 눈. 도트 몇 개가 위에서 아래로 천천히 떨어진다(12월).
// 줄임 동작이면 멈춘 눈송이만 보인다(styles.css의 kttn-snow).

const FLAKES = [
  { left: "12%", delay: "0s", duration: "3.2s" },
  { left: "34%", delay: "1.1s", duration: "2.7s" },
  { left: "55%", delay: "0.4s", duration: "3.6s" },
  { left: "73%", delay: "1.8s", duration: "2.9s" },
  { left: "88%", delay: "0.9s", duration: "3.3s" },
]

export function Snow() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-[12%] overflow-hidden"
    >
      {FLAKES.map((flake) => (
        <span
          key={flake.left}
          className="absolute top-0 size-[3px] bg-white motion-safe:animate-[kttn-snow_linear_infinite]"
          style={{
            left: flake.left,
            animationDelay: flake.delay,
            animationDuration: flake.duration,
          }}
        />
      ))}
    </span>
  )
}
