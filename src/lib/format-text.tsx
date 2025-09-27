import React from 'react';

// URL regex pattern for matching web links
const URL_PATTERN = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

/**
 * Formats text by making URLs clickable with proper styling
 */
export function formatText(text: string) {
  const parts = text.split(URL_PATTERN);
  const matches = text.match(URL_PATTERN) || [];
  
  return parts.reduce((acc: React.ReactNode[], part, i) => {
    if (i > 0 && matches[i - 1]) {
      acc.push(
        <a 
          key={`link-${i}`}
          href={matches[i - 1]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-600 hover:underline transition-colors"
        >
          {matches[i - 1]}
        </a>
      );
    }
    if (part) {
      acc.push(<React.Fragment key={`text-${i}`}>{part}</React.Fragment>);
    }
    return acc;
  }, []);
}