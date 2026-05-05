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
    const mq =
      window.matchMedia(query);

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
