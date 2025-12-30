/**
 * ExportManager Unit Tests
 *
 * Tests for JSON, CSV, GraphML, GEXF, DOT, Markdown, and Mermaid exports.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExportManager, type ExportFormat } from '../../../features/ExportManager.js';
import type { KnowledgeGraph } from '../../../types/index.js';

describe('ExportManager', () => {
  let manager: ExportManager;
  let sampleGraph: KnowledgeGraph;

  beforeEach(() => {
    manager = new ExportManager();
    sampleGraph = {
      entities: [
        {
          name: 'Alice',
          entityType: 'person',
          observations: ['Developer', 'Works remotely'],
          tags: ['backend', 'senior'],
          importance: 8,
          createdAt: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-02T00:00:00Z',
        },
        {
          name: 'Bob',
          entityType: 'person',
          observations: ['Manager'],
          tags: ['leadership'],
          importance: 7,
        },
      ],
      relations: [
        {
          from: 'Alice',
          to: 'Bob',
          relationType: 'reports_to',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    };
  });

  describe('Constructor', () => {
    it('should create manager instance', () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(ExportManager);
    });
  });

  describe('exportGraph dispatcher', () => {
    it('should dispatch to JSON export', () => {
      const result = manager.exportGraph(sampleGraph, 'json');
      expect(result).toContain('"entities"');
    });

    it('should dispatch to CSV export', () => {
      const result = manager.exportGraph(sampleGraph, 'csv');
      expect(result).toContain('# ENTITIES');
    });

    it('should dispatch to GraphML export', () => {
      const result = manager.exportGraph(sampleGraph, 'graphml');
      expect(result).toContain('<graphml');
    });

    it('should dispatch to GEXF export', () => {
      const result = manager.exportGraph(sampleGraph, 'gexf');
      expect(result).toContain('<gexf');
    });

    it('should dispatch to DOT export', () => {
      const result = manager.exportGraph(sampleGraph, 'dot');
      expect(result).toContain('digraph');
    });

    it('should dispatch to Markdown export', () => {
      const result = manager.exportGraph(sampleGraph, 'markdown');
      expect(result).toContain('# Knowledge Graph Export');
    });

    it('should dispatch to Mermaid export', () => {
      const result = manager.exportGraph(sampleGraph, 'mermaid');
      expect(result).toContain('graph LR');
    });

    it('should throw error for unsupported format', () => {
      expect(() => manager.exportGraph(sampleGraph, 'yaml' as ExportFormat)).toThrow(
        'Unsupported export format'
      );
    });
  });

  describe('JSON Export', () => {
    it('should export valid JSON', () => {
      const result = manager.exportGraph(sampleGraph, 'json');
      const parsed = JSON.parse(result);

      expect(parsed.entities).toHaveLength(2);
      expect(parsed.relations).toHaveLength(1);
    });

    it('should pretty-print with indentation', () => {
      const result = manager.exportGraph(sampleGraph, 'json');
      expect(result).toContain('  '); // Indentation
      expect(result.split('\n').length).toBeGreaterThan(1);
    });

    it('should preserve all entity properties', () => {
      const result = manager.exportGraph(sampleGraph, 'json');
      const parsed = JSON.parse(result);

      expect(parsed.entities[0].name).toBe('Alice');
      expect(parsed.entities[0].entityType).toBe('person');
      expect(parsed.entities[0].observations).toContain('Developer');
      expect(parsed.entities[0].tags).toContain('backend');
      expect(parsed.entities[0].importance).toBe(8);
    });

    it('should preserve all relation properties', () => {
      const result = manager.exportGraph(sampleGraph, 'json');
      const parsed = JSON.parse(result);

      expect(parsed.relations[0].from).toBe('Alice');
      expect(parsed.relations[0].to).toBe('Bob');
      expect(parsed.relations[0].relationType).toBe('reports_to');
    });

    it('should handle empty graph', () => {
      const result = manager.exportGraph({ entities: [], relations: [] }, 'json');
      const parsed = JSON.parse(result);

      expect(parsed.entities).toEqual([]);
      expect(parsed.relations).toEqual([]);
    });
  });

  describe('CSV Export', () => {
    it('should have entities section header', () => {
      const result = manager.exportGraph(sampleGraph, 'csv');
      expect(result).toContain('# ENTITIES');
      expect(result).toContain('name,entityType,observations,createdAt,lastModified,tags,importance');
    });

    it('should have relations section header', () => {
      const result = manager.exportGraph(sampleGraph, 'csv');
      expect(result).toContain('# RELATIONS');
      expect(result).toContain('from,to,relationType,createdAt,lastModified');
    });

    it('should export entity data', () => {
      const result = manager.exportGraph(sampleGraph, 'csv');
      expect(result).toContain('Alice');
      expect(result).toContain('person');
      expect(result).toContain('Developer; Works remotely');
    });

    it('should export relation data', () => {
      const result = manager.exportGraph(sampleGraph, 'csv');
      expect(result).toContain('Alice,Bob,reports_to');
    });

    it('should join observations with semicolon', () => {
      const result = manager.exportGraph(sampleGraph, 'csv');
      expect(result).toContain('Developer; Works remotely');
    });

    it('should join tags with semicolon', () => {
      const result = manager.exportGraph(sampleGraph, 'csv');
      expect(result).toContain('backend; senior');
    });

    it('should escape fields with commas', () => {
      const graph: KnowledgeGraph = {
        entities: [
          { name: 'Name, with comma', entityType: 'test', observations: [] },
        ],
        relations: [],
      };
      const result = manager.exportGraph(graph, 'csv');
      expect(result).toContain('"Name, with comma"');
    });

    it('should escape fields with quotes', () => {
      const graph: KnowledgeGraph = {
        entities: [
          { name: 'Test', entityType: 'test', observations: ['Said "hello"'] },
        ],
        relations: [],
      };
      const result = manager.exportGraph(graph, 'csv');
      expect(result).toContain('""hello""');
    });

    it('should escape fields with newlines', () => {
      const graph: KnowledgeGraph = {
        entities: [
          { name: 'Test', entityType: 'test', observations: ['Line1\nLine2'] },
        ],
        relations: [],
      };
      const result = manager.exportGraph(graph, 'csv');
      expect(result).toContain('"Line1\nLine2"');
    });

    it('should handle empty graph', () => {
      const result = manager.exportGraph({ entities: [], relations: [] }, 'csv');
      expect(result).toContain('# ENTITIES');
      expect(result).toContain('# RELATIONS');
    });

    it('should handle undefined optional fields', () => {
      const graph: KnowledgeGraph = {
        entities: [{ name: 'Basic', entityType: 'test', observations: [] }],
        relations: [],
      };
      const result = manager.exportGraph(graph, 'csv');
      expect(result).toContain('Basic,test');
    });
  });

  describe('GraphML Export', () => {
    it('should have XML declaration', () => {
      const result = manager.exportGraph(sampleGraph, 'graphml');
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    });

    it('should have graphml root element with namespace', () => {
      const result = manager.exportGraph(sampleGraph, 'graphml');
      expect(result).toContain('<graphml xmlns="http://graphml.graphdrawing.org/xmlns">');
    });

    it('should define node attribute keys', () => {
      const result = manager.exportGraph(sampleGraph, 'graphml');
      expect(result).toContain('key id="d0"');
      expect(result).toContain('attr.name="entityType"');
      expect(result).toContain('attr.name="observations"');
      expect(result).toContain('attr.name="tags"');
      expect(result).toContain('attr.name="importance"');
    });

    it('should define edge attribute keys', () => {
      const result = manager.exportGraph(sampleGraph, 'graphml');
      expect(result).toContain('key id="e0"');
      expect(result).toContain('attr.name="relationType"');
    });

    it('should export nodes with id', () => {
      const result = manager.exportGraph(sampleGraph, 'graphml');
      expect(result).toContain('<node id="Alice">');
      expect(result).toContain('<node id="Bob">');
    });

    it('should export node data', () => {
      const result = manager.exportGraph(sampleGraph, 'graphml');
      expect(result).toContain('<data key="d0">person</data>');
      expect(result).toContain('<data key="d1">Developer; Works remotely</data>');
    });

    it('should export edges with source and target', () => {
      const result = manager.exportGraph(sampleGraph, 'graphml');
      expect(result).toMatch(/<edge id="e\d+" source="Alice" target="Bob">/);
    });

    it('should export edge data', () => {
      const result = manager.exportGraph(sampleGraph, 'graphml');
      expect(result).toContain('<data key="e0">reports_to</data>');
    });

    it('should escape XML special characters in names', () => {
      const graph: KnowledgeGraph = {
        entities: [{ name: 'Test<>&"\'', entityType: 'test', observations: [] }],
        relations: [],
      };
      const result = manager.exportGraph(graph, 'graphml');
      expect(result).toContain('Test&lt;&gt;&amp;&quot;&apos;');
    });

    it('should close all elements properly', () => {
      const result = manager.exportGraph(sampleGraph, 'graphml');
      expect(result).toContain('</node>');
      expect(result).toContain('</edge>');
      expect(result).toContain('</graph>');
      expect(result).toContain('</graphml>');
    });

    it('should handle empty graph', () => {
      const result = manager.exportGraph({ entities: [], relations: [] }, 'graphml');
      expect(result).toContain('<graphml');
      expect(result).toContain('</graphml>');
    });
  });

  describe('GEXF Export', () => {
    it('should have XML declaration', () => {
      const result = manager.exportGraph(sampleGraph, 'gexf');
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    });

    it('should have gexf root element with namespace and version', () => {
      const result = manager.exportGraph(sampleGraph, 'gexf');
      expect(result).toContain('<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">');
    });

    it('should have meta creator element', () => {
      const result = manager.exportGraph(sampleGraph, 'gexf');
      expect(result).toContain('<creator>Memory MCP Server</creator>');
    });

    it('should define node attributes', () => {
      const result = manager.exportGraph(sampleGraph, 'gexf');
      expect(result).toContain('<attribute id="0" title="entityType" type="string"/>');
      expect(result).toContain('<attribute id="1" title="observations" type="string"/>');
    });

    it('should export nodes with id and label', () => {
      const result = manager.exportGraph(sampleGraph, 'gexf');
      expect(result).toContain('<node id="Alice" label="Alice">');
      expect(result).toContain('<node id="Bob" label="Bob">');
    });

    it('should export node attribute values', () => {
      const result = manager.exportGraph(sampleGraph, 'gexf');
      expect(result).toContain('<attvalue for="0" value="person"/>');
    });

    it('should export edges with id, source, target, and label', () => {
      const result = manager.exportGraph(sampleGraph, 'gexf');
      expect(result).toMatch(/<edge id="\d+" source="Alice" target="Bob" label="reports_to"\/>/);
    });

    it('should escape XML special characters', () => {
      const graph: KnowledgeGraph = {
        entities: [{ name: '<Test>', entityType: 'test', observations: [] }],
        relations: [],
      };
      const result = manager.exportGraph(graph, 'gexf');
      expect(result).toContain('&lt;Test&gt;');
    });

    it('should close all elements properly', () => {
      const result = manager.exportGraph(sampleGraph, 'gexf');
      expect(result).toContain('</nodes>');
      expect(result).toContain('</edges>');
      expect(result).toContain('</graph>');
      expect(result).toContain('</gexf>');
    });
  });

  describe('DOT Export', () => {
    it('should have digraph declaration', () => {
      const result = manager.exportGraph(sampleGraph, 'dot');
      expect(result).toContain('digraph KnowledgeGraph {');
    });

    it('should set graph direction', () => {
      const result = manager.exportGraph(sampleGraph, 'dot');
      expect(result).toContain('rankdir=LR;');
    });

    it('should set default node style', () => {
      const result = manager.exportGraph(sampleGraph, 'dot');
      expect(result).toContain('node [shape=box, style=rounded];');
    });

    it('should export nodes with labels', () => {
      const result = manager.exportGraph(sampleGraph, 'dot');
      expect(result).toContain('"Alice"');
      expect(result).toContain('Type: person');
    });

    it('should include tags in node labels', () => {
      const result = manager.exportGraph(sampleGraph, 'dot');
      expect(result).toContain('Tags: backend, senior');
    });

    it('should export edges with labels', () => {
      const result = manager.exportGraph(sampleGraph, 'dot');
      expect(result).toContain('"Alice" -> "Bob"');
      expect(result).toContain('label="reports_to"');
    });

    it('should escape quotes in names', () => {
      const graph: KnowledgeGraph = {
        entities: [{ name: 'Test "quoted"', entityType: 'test', observations: [] }],
        relations: [],
      };
      const result = manager.exportGraph(graph, 'dot');
      expect(result).toContain('\\"quoted\\"');
    });

    it('should escape backslashes', () => {
      const graph: KnowledgeGraph = {
        entities: [{ name: 'Test\\Path', entityType: 'test', observations: [] }],
        relations: [],
      };
      const result = manager.exportGraph(graph, 'dot');
      expect(result).toContain('\\\\');
    });

    it('should close graph properly', () => {
      const result = manager.exportGraph(sampleGraph, 'dot');
      expect(result.trim().endsWith('}')).toBe(true);
    });
  });

  describe('Markdown Export', () => {
    it('should have title header', () => {
      const result = manager.exportGraph(sampleGraph, 'markdown');
      expect(result).toContain('# Knowledge Graph Export');
    });

    it('should include export timestamp', () => {
      const result = manager.exportGraph(sampleGraph, 'markdown');
      expect(result).toContain('**Exported:**');
    });

    it('should include entity and relation counts', () => {
      const result = manager.exportGraph(sampleGraph, 'markdown');
      expect(result).toContain('**Entities:** 2');
      expect(result).toContain('**Relations:** 1');
    });

    it('should have entities section', () => {
      const result = manager.exportGraph(sampleGraph, 'markdown');
      expect(result).toContain('## Entities');
    });

    it('should export entity headers', () => {
      const result = manager.exportGraph(sampleGraph, 'markdown');
      expect(result).toContain('### Alice');
      expect(result).toContain('### Bob');
    });

    it('should export entity type', () => {
      const result = manager.exportGraph(sampleGraph, 'markdown');
      expect(result).toContain('**Type:** person');
    });

    it('should export tags with code formatting', () => {
      const result = manager.exportGraph(sampleGraph, 'markdown');
      expect(result).toContain('**Tags:** `backend`, `senior`');
    });

    it('should export importance', () => {
      const result = manager.exportGraph(sampleGraph, 'markdown');
      expect(result).toContain('**Importance:** 8/10');
    });

    it('should export observations as list', () => {
      const result = manager.exportGraph(sampleGraph, 'markdown');
      expect(result).toContain('**Observations:**');
      expect(result).toContain('- Developer');
      expect(result).toContain('- Works remotely');
    });

    it('should have relations section', () => {
      const result = manager.exportGraph(sampleGraph, 'markdown');
      expect(result).toContain('## Relations');
    });

    it('should export relations with arrow format', () => {
      const result = manager.exportGraph(sampleGraph, 'markdown');
      expect(result).toContain('**Alice** → *reports_to* → **Bob**');
    });

    it('should omit relations section when empty', () => {
      const graph: KnowledgeGraph = {
        entities: [{ name: 'Test', entityType: 'test', observations: [] }],
        relations: [],
      };
      const result = manager.exportGraph(graph, 'markdown');
      expect(result).not.toContain('## Relations');
    });

    it('should handle entities without optional fields', () => {
      const graph: KnowledgeGraph = {
        entities: [{ name: 'Basic', entityType: 'test', observations: [] }],
        relations: [],
      };
      const result = manager.exportGraph(graph, 'markdown');
      expect(result).toContain('### Basic');
      expect(result).not.toContain('**Tags:**');
      expect(result).not.toContain('**Importance:**');
    });
  });

  describe('Mermaid Export', () => {
    it('should have graph LR declaration', () => {
      const result = manager.exportGraph(sampleGraph, 'mermaid');
      expect(result).toContain('graph LR');
    });

    it('should have comment header', () => {
      const result = manager.exportGraph(sampleGraph, 'mermaid');
      expect(result).toContain('%% Knowledge Graph');
    });

    it('should export nodes with sanitized ids', () => {
      const result = manager.exportGraph(sampleGraph, 'mermaid');
      expect(result).toContain('Alice["');
      expect(result).toContain('Bob["');
    });

    it('should include entity type in node labels', () => {
      const result = manager.exportGraph(sampleGraph, 'mermaid');
      expect(result).toContain('Type: person');
    });

    it('should include tags in node labels', () => {
      const result = manager.exportGraph(sampleGraph, 'mermaid');
      expect(result).toContain('Tags: backend, senior');
    });

    it('should export edges with labels', () => {
      const result = manager.exportGraph(sampleGraph, 'mermaid');
      expect(result).toContain('Alice -->|"reports_to"| Bob');
    });

    it('should sanitize special characters in node ids', () => {
      const graph: KnowledgeGraph = {
        entities: [
          { name: 'Test-Node.123', entityType: 'test', observations: [] },
        ],
        relations: [],
      };
      const result = manager.exportGraph(graph, 'mermaid');
      expect(result).toContain('Test_Node_123["');
    });

    it('should escape quotes in labels', () => {
      const graph: KnowledgeGraph = {
        entities: [{ name: 'Test', entityType: 'test "type"', observations: [] }],
        relations: [],
      };
      const result = manager.exportGraph(graph, 'mermaid');
      expect(result).toContain('#quot;');
    });

    it('should use HTML line breaks in labels', () => {
      const result = manager.exportGraph(sampleGraph, 'mermaid');
      expect(result).toContain('<br/>');
    });

    it('should not export edges for non-existent nodes', () => {
      const graph: KnowledgeGraph = {
        entities: [{ name: 'Alice', entityType: 'test', observations: [] }],
        relations: [{ from: 'Alice', to: 'NonExistent', relationType: 'knows' }],
      };
      const result = manager.exportGraph(graph, 'mermaid');
      expect(result).not.toContain('NonExistent');
    });

    it('should handle empty graph', () => {
      const result = manager.exportGraph({ entities: [], relations: [] }, 'mermaid');
      expect(result).toContain('graph LR');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long entity names', () => {
      const longName = 'A'.repeat(1000);
      const graph: KnowledgeGraph = {
        entities: [{ name: longName, entityType: 'test', observations: [] }],
        relations: [],
      };

      for (const format of ['json', 'csv', 'graphml', 'gexf', 'dot', 'markdown', 'mermaid'] as ExportFormat[]) {
        const result = manager.exportGraph(graph, format);
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it('should handle unicode characters', () => {
      const graph: KnowledgeGraph = {
        entities: [
          { name: '日本語', entityType: 'test', observations: ['观察', 'مراقبة'] },
        ],
        relations: [],
      };

      for (const format of ['json', 'csv', 'markdown'] as ExportFormat[]) {
        const result = manager.exportGraph(graph, format);
        expect(result).toContain('日本語');
      }
    });

    it('should handle entities with empty observations', () => {
      const graph: KnowledgeGraph = {
        entities: [{ name: 'Empty', entityType: 'test', observations: [] }],
        relations: [],
      };

      for (const format of ['json', 'csv', 'graphml', 'gexf', 'dot', 'markdown', 'mermaid'] as ExportFormat[]) {
        const result = manager.exportGraph(graph, format);
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it('should handle large graph', () => {
      const largeGraph: KnowledgeGraph = {
        entities: Array.from({ length: 100 }, (_, i) => ({
          name: `Entity${i}`,
          entityType: 'test',
          observations: [`Obs ${i}`],
        })),
        relations: Array.from({ length: 99 }, (_, i) => ({
          from: `Entity${i}`,
          to: `Entity${i + 1}`,
          relationType: 'next',
        })),
      };

      for (const format of ['json', 'csv', 'graphml', 'gexf', 'dot', 'markdown', 'mermaid'] as ExportFormat[]) {
        const result = manager.exportGraph(largeGraph, format);
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it('should handle graph with only entities (no relations)', () => {
      const graph: KnowledgeGraph = {
        entities: [
          { name: 'Lonely1', entityType: 'test', observations: [] },
          { name: 'Lonely2', entityType: 'test', observations: [] },
        ],
        relations: [],
      };

      for (const format of ['json', 'csv', 'graphml', 'gexf', 'dot', 'markdown', 'mermaid'] as ExportFormat[]) {
        const result = manager.exportGraph(graph, format);
        expect(result).toContain('Lonely1');
        expect(result).toContain('Lonely2');
      }
    });

    it('should handle special regex characters in names', () => {
      const graph: KnowledgeGraph = {
        entities: [
          { name: 'Test.*+?^${}()|[]\\', entityType: 'test', observations: [] },
        ],
        relations: [],
      };

      // These formats should handle special characters without crashing
      const jsonResult = manager.exportGraph(graph, 'json');
      expect(JSON.parse(jsonResult).entities[0].name).toBe('Test.*+?^${}()|[]\\');
    });
  });
});
