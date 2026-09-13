import {
  CreateSubmissionSchema,
  normalizeAttachments,
  UpdateSubmissionSchema,
} from './dto/submissions.dto';

describe('Multiple Document Submissions Schema & Normalization', () => {
  describe('normalizeAttachments', () => {
    it('returns empty array for null/undefined/empty string', () => {
      expect(normalizeAttachments(null)).toEqual([]);
      expect(normalizeAttachments(undefined)).toEqual([]);
      expect(normalizeAttachments('')).toEqual([]);
      expect(normalizeAttachments('[]')).toEqual([]);
    });

    it('parses JSON string of array of documents', () => {
      const jsonStr = JSON.stringify([
        { name: 'doc1.pdf', url: 'https://cdn.example.com/doc1.pdf', size: 1000 },
        { name: 'doc2.png', url: 'https://cdn.example.com/doc2.png', size: 2000 },
      ]);
      const result = normalizeAttachments(jsonStr);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('doc1.pdf');
      expect(result[1].name).toBe('doc2.png');
    });

    it('normalizes single plain url string into document object', () => {
      const result = normalizeAttachments('https://cdn.example.com/doc.pdf');
      expect(result).toEqual([
        { url: 'https://cdn.example.com/doc.pdf', name: 'doc.pdf' },
      ]);
    });

    it('normalizes array containing string URLs and objects', () => {
      const input = [
        'https://cdn.example.com/file1.pdf',
        { name: 'file2.docx', url: 'https://cdn.example.com/file2.docx', size: 5000 },
      ];
      const result = normalizeAttachments(input);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        url: 'https://cdn.example.com/file1.pdf',
        name: 'file1.pdf',
      });
      expect(result[1].name).toBe('file2.docx');
    });
  });

  describe('CreateSubmissionSchema validation', () => {
    const validConceptId = '11111111-1111-4111-8111-111111111111';

    it('accepts up to 5 documents', () => {
      const docs = Array.from({ length: 5 }, (_, i) => ({
        name: `doc-${i + 1}.pdf`,
        url: `https://cdn.example.com/doc-${i + 1}.pdf`,
        size: 1024 * 1024,
      }));

      const parsed = CreateSubmissionSchema.parse({
        concept_id: validConceptId,
        title: 'Valid Idea with 5 docs',
        body: 'Here is the detailed body content...',
        attachments: docs,
      });

      expect(parsed.attachments).toHaveLength(5);
    });

    it('rejects more than 5 documents', () => {
      const docs = Array.from({ length: 6 }, (_, i) => ({
        name: `doc-${i + 1}.pdf`,
        url: `https://cdn.example.com/doc-${i + 1}.pdf`,
        size: 1024,
      }));

      expect(() => {
        CreateSubmissionSchema.parse({
          concept_id: validConceptId,
          title: 'Idea with 6 docs',
          body: 'Detailed body content...',
          attachments: docs,
        });
      }).toThrow();
    });

    it('accepts stringified JSON attachments in CreateSubmissionSchema', () => {
      const docs = [
        { name: 'file.pdf', url: 'https://cdn.example.com/file.pdf' },
      ];
      const parsed = CreateSubmissionSchema.parse({
        concept_id: validConceptId,
        title: 'Idea with JSON string attachments',
        body: 'Detailed body content...',
        attachments: JSON.stringify(docs),
      });

      expect(parsed.attachments).toHaveLength(1);
      expect(parsed.attachments?.[0].name).toBe('file.pdf');
    });
  });

  describe('UpdateSubmissionSchema validation', () => {
    it('accepts up to 5 documents in patch', () => {
      const docs = [
        { name: 'updated.pdf', url: 'https://cdn.example.com/updated.pdf' },
      ];
      const parsed = UpdateSubmissionSchema.parse({
        title: 'Updated title',
        attachments: docs,
      });
      expect(parsed.attachments).toHaveLength(1);
    });

    it('rejects more than 5 documents in patch', () => {
      const docs = Array.from({ length: 6 }, (_, i) => ({
        name: `doc-${i + 1}.pdf`,
        url: `https://cdn.example.com/doc-${i + 1}.pdf`,
      }));
      expect(() => {
        UpdateSubmissionSchema.parse({
          attachments: docs,
        });
      }).toThrow();
    });
  });
});
