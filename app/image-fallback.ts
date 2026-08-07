import type { SyntheticEvent } from "react";

/** Remove optional artwork cleanly when a deployment does not include it. */
export function removeBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.remove();
}
