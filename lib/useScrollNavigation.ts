import { useRef, useState, useEffect } from 'react';

interface UseScrollNavigationProps {
  welcomeSectionRef: React.RefObject<HTMLDivElement>;
  experienceSectionRef: React.RefObject<HTMLDivElement>;
  postsScrollRef: React.RefObject<HTMLDivElement>;
}

export function useScrollNavigation({
  welcomeSectionRef,
  experienceSectionRef,
  postsScrollRef,
}: UseScrollNavigationProps) {
  const [currentSection, setCurrentSection] = useState(0); // 0: Welcome, 1: Experience/Projects

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevent default scroll behavior

    const deltaY = e.deltaY;

    if (currentSection === 0) { // Currently on Welcome section
      if (deltaY > 0) { // Scrolling down
        experienceSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
        setCurrentSection(1);
      }
    } else if (currentSection === 1) { // Currently on Experience/Projects section
      if (deltaY > 0) { // Scrolling down (trying to go into carousel)
        if (postsScrollRef.current) {
          const { scrollWidth, clientWidth, scrollLeft } = postsScrollRef.current;
          if (scrollLeft + clientWidth < scrollWidth) { // More to scroll horizontally
            postsScrollRef.current.scrollBy({ left: clientWidth, behavior: 'smooth' }); // Scroll one card width
          }
        }
      } else { // Scrolling up (trying to go back to Welcome or previous carousel card)
        if (postsScrollRef.current) {
          const { scrollLeft } = postsScrollRef.current;
          if (scrollLeft > 0) { // More to scroll horizontally to the left
            postsScrollRef.current.scrollBy({ left: -postsScrollRef.current.clientWidth, behavior: 'smooth' }); // Scroll one card width back
          } else { // At the beginning of the carousel, go back to Welcome
            welcomeSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
            setCurrentSection(0);
          }
        }
      }
    }
  };

  return { handleWheel, currentSection, setCurrentSection };
}
