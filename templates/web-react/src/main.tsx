import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function Wallpaper() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCount(c => c + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <main
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0b10",
        color: "#f5f5f7",
        fontFamily: "system-ui, sans-serif",
        fontSize: "clamp(24px, 6vw, 96px)"
      }}
    >
      Hello, Fluxlay! {count}
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Wallpaper />
  </StrictMode>
);
