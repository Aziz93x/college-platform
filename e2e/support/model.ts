import type { Locator } from "@playwright/test";

// The keystroke-level model's times (Card, Moran and Newell), in seconds: a mental step before each
// action a person decides on, pointing at a control, pressing a button, and a key of an average
// typist. A usability run counts a person's time by it as it works a screen, so a Done-when's time
// is a person's, not the browser robot's (Audit 7; lead review D, M4).
const KLM = { think: 1.35, point: 1.1, press: 0.2, key: 0.28 };

// A person at a screen: each action done, and its time as the model counts it. `pick` opens one of
// the screen's lists and picks an option, as that screen does it.
export function modelledPerson(
  pick: (label: string, option: string) => Promise<void>,
) {
  let seconds = 0;
  return {
    seconds: () => seconds,
    // Decides, points and presses.
    click: async (target: Locator) => {
      seconds += KLM.think + KLM.point + KLM.press;
      await target.click();
    },
    // Decides, points, then presses a stepper's button as often as it takes.
    step: async (target: Locator, times: number) => {
      seconds += KLM.think + KLM.point + times * KLM.press;
      for (let pressed = 0; pressed < times; pressed++) await target.click();
    },
    // Decides and types into the field that has the focus.
    type: async (target: Locator, words: string) => {
      seconds += KLM.think + words.length * KLM.key;
      await target.fill(words);
    },
    // Opens one of the screen's lists and picks an option.
    choose: async (label: string, option: string) => {
      seconds += KLM.think + 2 * (KLM.point + KLM.press);
      await pick(label, option);
    },
  };
}
