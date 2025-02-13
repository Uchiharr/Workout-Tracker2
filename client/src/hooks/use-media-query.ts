
import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const updateMatch = () => setMatches(media.matches);
    
    // Set initial value
    updateMatch();
    
    // Listen for changes
    media.addEventListener("change", updateMatch);
    
    // Cleanup
    return () => media.removeEventListener("change", updateMatch);
  }, [query]);

  return matches;
}
