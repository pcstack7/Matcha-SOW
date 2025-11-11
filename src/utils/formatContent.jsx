// Helper function to parse markdown tables
function parseTable(lines, startIndex) {
  const tableLines = [];
  let i = startIndex;

  // Collect all consecutive table lines
  while (i < lines.length && lines[i].trim().startsWith('|')) {
    tableLines.push(lines[i]);
    i++;
  }

  if (tableLines.length < 2) return null;

  // Parse header
  const headerCells = tableLines[0]
    .split('|')
    .map(cell => cell.trim())
    .filter(cell => cell !== '');

  // Skip separator row (index 1)
  // Parse data rows
  const dataRows = [];
  for (let j = 2; j < tableLines.length; j++) {
    const cells = tableLines[j]
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell !== '');
    if (cells.length > 0) {
      dataRows.push(cells);
    }
  }

  return {
    headers: headerCells,
    rows: dataRows,
    endIndex: i
  };
}

// Helper function to parse inline markdown (bold, etc.)
export function parseInlineMarkdown(text) {
  const parts = [];
  let currentIndex = 0;
  const boldRegex = /\*\*(.*?)\*\*/g;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > currentIndex) {
      parts.push(text.substring(currentIndex, match.index));
    }
    // Add bold text
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    currentIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  return parts.length > 0 ? parts : text;
}

// Helper function to format content with proper styling
export function formatContent(content) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      elements.push(<br key={`br-${i}`} />);
      i++;
      continue;
    }

    // Check if this is the start of a table
    if (line.trim().startsWith('|')) {
      const table = parseTable(lines, i);
      if (table) {
        elements.push(
          <table
            key={`table-${i}`}
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '12px',
              marginBottom: '12px',
              fontFamily: 'Verdana, sans-serif',
              fontSize: '9.5px',
            }}
          >
            <thead>
              <tr>
                {table.headers.map((header, idx) => (
                  <th
                    key={idx}
                    style={{
                      border: '1px solid #ddd',
                      padding: '8px',
                      backgroundColor: '#707CF1',
                      color: '#FFFFFF',
                      fontWeight: 'bold',
                      textAlign: 'left',
                      fontFamily: 'Verdana, sans-serif',
                      fontSize: '9.5px',
                    }}
                  >
                    {parseInlineMarkdown(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      style={{
                        border: '1px solid #ddd',
                        padding: '8px',
                        fontFamily: 'Verdana, sans-serif',
                        fontSize: '9.5px',
                      }}
                    >
                      {parseInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
        i = table.endIndex;
        continue;
      }
    }

    // Main headers (## or all caps)
    if (line.match(/^#{1,2}\s+/) || line.match(/^[A-Z\s]{3,}:?\s*$/)) {
      const headerText = line.replace(/^#{1,2}\s+/, '').trim();
      elements.push(
        <div
          key={i}
          style={{
            fontFamily: 'Verdana, sans-serif',
            fontSize: '16px',
            color: '#707CF1',
            fontWeight: 'bold',
            marginTop: '16px',
            marginBottom: '8px',
          }}
        >
          {headerText}
        </div>
      );
      i++;
      continue;
    }

    // Subheaders (### or **text**)
    if (line.match(/^#{3,4}\s+/) || line.match(/^\*\*.*\*\*$/)) {
      const subHeaderText = line.replace(/^#{3,4}\s+/, '').replace(/\*\*/g, '').trim();
      elements.push(
        <div
          key={i}
          style={{
            fontFamily: 'Verdana, sans-serif',
            fontSize: '14px',
            color: '#383392',
            fontWeight: 'bold',
            marginTop: '12px',
            marginBottom: '6px',
          }}
        >
          {subHeaderText}
        </div>
      );
      i++;
      continue;
    }

    // Bullet points (-, *, or •) but NOT if the content after bullet is all bold
    if (line.match(/^\s*[-*•]\s+/)) {
      const bulletContent = line.replace(/^\s*[-*•]\s+/, '').trim();

      // If the content after the bullet is entirely bold (like * **Header**), treat as subheader
      if (bulletContent.match(/^\*\*.*\*\*$/)) {
        const subHeaderText = bulletContent.replace(/\*\*/g, '').trim();
        elements.push(
          <div
            key={i}
            style={{
              fontFamily: 'Verdana, sans-serif',
              fontSize: '14px',
              color: '#383392',
              fontWeight: 'bold',
              marginTop: '12px',
              marginBottom: '6px',
            }}
          >
            {subHeaderText}
          </div>
        );
        i++;
        continue;
      }

      // Regular bullet point
      elements.push(
        <div
          key={i}
          style={{
            fontFamily: 'Verdana, sans-serif',
            fontSize: '9.5px',
            color: '#000000',
            lineHeight: '1.6',
            paddingLeft: '30px',
            textIndent: '-20px',
            marginBottom: '4px',
          }}
        >
          <span style={{ color: '#5E63CD', fontSize: '9.5px' }}>•&nbsp;&nbsp;</span>
          {parseInlineMarkdown(bulletContent)}
        </div>
      );
      i++;
      continue;
    }

    // Regular content with inline markdown
    elements.push(
      <div
        key={i}
        style={{
          fontFamily: 'Verdana, sans-serif',
          fontSize: '9.5px',
          color: '#000000',
          lineHeight: '1.6',
        }}
      >
        {parseInlineMarkdown(line)}
      </div>
    );
    i++;
  }

  return elements;
}
