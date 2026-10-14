import type { Step } from "../ble/protocol";

export type Ink = "sun" | "flame" | "grape" | "sea" | "sky" | "rose" | "leaf";

export interface Program {
  id: string;
  name: string;
  ink: Ink;
  steps: Step[];
}

const run = (seconds: number, speed = 0xa0): Step => ({ q: seconds * 4, speed });
const rest = (seconds: number): Step => ({ q: seconds * 4, speed: 0 });

/** The factory programs, byte for byte as the original app sent them. */
export const PROGRAMS: Program[] = [
  {
    id: "standard",
    name: "Blend",
    ink: "sun",
    steps: [run(45)],
  },
  {
    id: "super",
    name: "Super blend",
    ink: "sea",
    steps: [run(10), rest(3), run(10), rest(3), run(25)],
  },
  {
    id: "crush",
    name: "Crush",
    ink: "sky",
    steps: [run(5), rest(3), run(5), rest(3), run(15)],
  },
  {
    id: "pulsed",
    name: "Pulsed blend",
    ink: "rose",
    steps: [run(5), rest(3), run(5), rest(3), run(5)],
  },
  {
    id: "pulse",
    name: "Pulse",
    ink: "grape",
    steps: [run(1), rest(3), run(1), rest(3), run(1), rest(3), run(1), rest(3), run(1)],
  },
];

export const CUSTOM_DEFAULT: Step[] = [run(5, 0x40), run(10, 0x70), run(20)];
