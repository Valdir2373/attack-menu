import ora from "ora";

export function spinner(message: string) {
  return ora(message);
}

