import { useEffect, useState } from "react";

export type MouseState = {
  x: number;
  y: number;
  isPressed: boolean;
};

const ENABLE  = "\x1b[?1000h\x1b[?1002h\x1b[?1006h";
const DISABLE = "\x1b[?1006l\x1b[?1002l\x1b[?1000l";


export function useMouse(active: boolean): MouseState {
  const [state, setState] = useState<MouseState>({ x: 0, y: 0, isPressed: false });

  useEffect(() => {
    if (!active) {
      process.stdout.write(DISABLE);
      setState({ x: 0, y: 0, isPressed: false });
      return;
    }

    process.stdout.write(ENABLE);

    const onData = (buf: Buffer | string) => {
      const s = typeof buf === "string" ? buf : buf.toString("binary");
      const re = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s)) !== null) {
        const cb      = parseInt(m[1]);
        const x       = parseInt(m[2]) - 1;
        const y       = parseInt(m[3]) - 1;
        const release = m[4] === "m";
        const isMotion = (cb & 32) !== 0;
        const button   = cb & 3;

        if (release) {
          setState((prev) => ({ ...prev, x, y, isPressed: false }));
        } else if (!isMotion && button === 0) {
          setState({ x, y, isPressed: true });
        } else if (isMotion) {
          setState((prev) => ({ ...prev, x, y }));
        }
      }
    };

    process.stdin.on("data", onData);
    return () => {
      process.stdin.off("data", onData);
      process.stdout.write(DISABLE);
    };
  }, [active]);

  return state;
}

