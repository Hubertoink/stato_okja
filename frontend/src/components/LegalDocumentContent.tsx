import type { ReactNode } from 'react';

function renderParagraph(lines: string[], key: string) {
  return <p key={key}>{lines.join(' ')}</p>;
}

/**
 * Deliberately small Markdown renderer for deployment-provided legal text.
 * It renders text only, never raw HTML, so changing a document cannot inject UI.
 */
export default function LegalDocumentContent({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  let paragraph: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    nodes.push(renderParagraph(paragraph, `paragraph-${index}`));
    paragraph = [];
  };

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      flushParagraph();
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,2})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const Tag = heading[1].length === 1 ? 'h2' : 'h3';
      nodes.push(<Tag key={`heading-${index}`} className="text-base font-semibold text-gray-900">{heading[2]}</Tag>);
      index += 1;
      continue;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('- ')) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      nodes.push(
        <ul key={`list-${index}`} className="list-disc space-y-1 pl-5 text-gray-600">
          {items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
        </ul>,
      );
      continue;
    }

    if (line.startsWith('> ')) {
      flushParagraph();
      nodes.push(
        <p key={`note-${index}`} className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
          {line.slice(2)}
        </p>,
      );
      index += 1;
      continue;
    }

    paragraph.push(line);
    index += 1;
  }

  flushParagraph();
  return <div className="space-y-5 text-sm text-gray-700">{nodes}</div>;
}
