import { createContext, useContext, useState, ReactNode } from 'react';

interface TagContextType {
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
}

const TagContext = createContext<TagContextType | undefined>(undefined);

export const TagProvider = ({ children }: { children: ReactNode }) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  return (
    <TagContext.Provider value={{ selectedTags, setSelectedTags }}>
      {children}
    </TagContext.Provider>
  );
};

export const useTags = () => {
  const context = useContext(TagContext);
  if (context === undefined) {
    throw new Error('useTags must be used within a TagProvider');
  }
  return context;
};
