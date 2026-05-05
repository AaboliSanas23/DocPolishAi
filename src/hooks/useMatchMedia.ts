import { useEffect, useState } from "react";

/**
 * Subscribes to `window.matchMedia(query)`. SSR-safe (false until mounted).
 */
export function useMatchMedia(
  query: string
): boolean {
  const [matches, setMatches] =
    useState(false);

  useEffect(() => {
    if (
      typeof window.matchMedia !==
      "function"
    ) {
      return;
    }

    let mq: MediaQueryList;

    try {
      mq = window.matchMedia(query);
    } catch {
      return;
    }

    if (!mq) {
      return;
    }

    const update = () =>
      setMatches(mq.matches);

    update();

    mq.addEventListener(
      "change",
      update
    );

    return () =>
      mq.removeEventListener(
        "change",
        update
      );
  }, [query]);

  return matches;
}
