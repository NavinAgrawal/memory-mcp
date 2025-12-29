/**
 * Export Manager
 *
 * Exports knowledge graphs to various formats (JSON, CSV, GraphML, GEXF, DOT, Markdown, Mermaid).
 *
 * @module features/ExportManager
 */

import type { KnowledgeGraph, ReadonlyKnowledgeGraph } from '../types/index.js';

/**
 * Supported export formats.
 */
export type ExportFormat = 'json' | 'csv' | 'graphml' | 'gexf' | 'dot' | 'markdown' | 'mermaid';

/**
 * Manages knowledge graph exports to multiple formats.
 */
export class ExportManager {
  /**
   * Export graph to specified format.
   *
   * @param graph - Knowledge graph to export
   * @param format - Export format
   * @returns Formatted export string
   */
  exportGraph(graph: ReadonlyKnowledgeGraph, format: ExportFormat): string {
    switch (format) {
      case 'json':
        return this.exportAsJson(graph);
      case 'csv':
        return this.exportAsCsv(graph);
      case 'graphml':
        return this.exportAsGraphML(graph);
      case 'gexf':
        return this.exportAsGEXF(graph);
      case 'dot':
        return this.exportAsDOT(graph);
      case 'markdown':
        return this.exportAsMarkdown(graph);
      case 'mermaid':
        return this.exportAsMermaid(graph);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export as pretty-printed JSON.
   */
  private exportAsJson(graph: ReadonlyKnowledgeGraph): string {
    return JSON.stringify(graph, null, 2);
  }

  /**
   * Export as CSV with proper escaping.
   */
  private exportAsCsv(graph: ReadonlyKnowledgeGraph): string {
    const lines: string[] = [];

    const escapeCsvField = (field: string | undefined | null): string => {
      if (field === undefined || field === null) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Entities section
    lines.push('# ENTITIES');
    lines.push('name,entityType,observations,createdAt,lastModified,tags,importance');

    for (const entity of graph.entities) {
      const observationsStr = entity.observations.join('; ');
      const tagsStr = entity.tags ? entity.tags.join('; ') : '';
      const importanceStr = entity.importance !== undefined ? String(entity.importance) : '';

      lines.push(
        [
          escapeCsvField(entity.name),
          escapeCsvField(entity.entityType),
          escapeCsvField(observationsStr),
          escapeCsvField(entity.createdAt),
          escapeCsvField(entity.lastModified),
          escapeCsvField(tagsStr),
          escapeCsvField(importanceStr),
        ].join(',')
      );
    }

    // Relations section
    lines.push('');
    lines.push('# RELATIONS');
    lines.push('from,to,relationType,createdAt,lastModified');

    for (const relation of graph.relations) {
      lines.push(
        [
          escapeCsvField(relation.from),
          escapeCsvField(relation.to),
          escapeCsvField(relation.relationType),
          escapeCsvField(relation.createdAt),
          escapeCsvField(relation.lastModified),
        ].join(',')
      );
    }

    return lines.join('\n');
  }

  /**
   * Export as GraphML XML format.
   */
  private exportAsGraphML(graph: ReadonlyKnowledgeGraph): string {
    const lines: string[] = [];

    const escapeXml = (str: string | undefined | null): string => {
      if (str === undefined || str === null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<graphml xmlns="http://graphml.graphdrawing.org/xmlns">');
    lines.push('  <key id="d0" for="node" attr.name="entityType" attr.type="string"/>');
    lines.push('  <key id="d1" for="node" attr.name="observations" attr.type="string"/>');
    lines.push('  <key id="d2" for="node" attr.name="createdAt" attr.type="string"/>');
    lines.push('  <key id="d3" for="node" attr.name="lastModified" attr.type="string"/>');
    lines.push('  <key id="d4" for="node" attr.name="tags" attr.type="string"/>');
    lines.push('  <key id="d5" for="node" attr.name="importance" attr.type="double"/>');
    lines.push('  <key id="e0" for="edge" attr.name="relationType" attr.type="string"/>');
    lines.push('  <key id="e1" for="edge" attr.name="createdAt" attr.type="string"/>');
    lines.push('  <key id="e2" for="edge" attr.name="lastModified" attr.type="string"/>');
    lines.push('  <graph id="G" edgedefault="directed">');

    // Nodes
    for (const entity of graph.entities) {
      const nodeId = escapeXml(entity.name);
      lines.push(`    <node id="${nodeId}">`);
      lines.push(`      <data key="d0">${escapeXml(entity.entityType)}</data>`);
      lines.push(`      <data key="d1">${escapeXml(entity.observations.join('; '))}</data>`);
      if (entity.createdAt) lines.push(`      <data key="d2">${escapeXml(entity.createdAt)}</data>`);
      if (entity.lastModified) lines.push(`      <data key="d3">${escapeXml(entity.lastModified)}</data>`);
      if (entity.tags?.length) lines.push(`      <data key="d4">${escapeXml(entity.tags.join('; '))}</data>`);
      if (entity.importance !== undefined) lines.push(`      <data key="d5">${entity.importance}</data>`);
      lines.push('    </node>');
    }

    // Edges
    let edgeId = 0;
    for (const relation of graph.relations) {
      const sourceId = escapeXml(relation.from);
      const targetId = escapeXml(relation.to);
      lines.push(`    <edge id="e${edgeId}" source="${sourceId}" target="${targetId}">`);
      lines.push(`      <data key="e0">${escapeXml(relation.relationType)}</data>`);
      if (relation.createdAt) lines.push(`      <data key="e1">${escapeXml(relation.createdAt)}</data>`);
      if (relation.lastModified) lines.push(`      <data key="e2">${escapeXml(relation.lastModified)}</data>`);
      lines.push('    </edge>');
      edgeId++;
    }

    lines.push('  </graph>');
    lines.push('</graphml>');
    return lines.join('\n');
  }

  /**
   * Export as GEXF format for Gephi.
   */
  private exportAsGEXF(graph: ReadonlyKnowledgeGraph): string {
    const lines: string[] = [];

    const escapeXml = (str: string | undefined | null): string => {
      if (str === undefined || str === null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">');
    lines.push('  <meta>');
    lines.push('    <creator>Memory MCP Server</creator>');
    lines.push('  </meta>');
    lines.push('  <graph mode="static" defaultedgetype="directed">');
    lines.push('    <attributes class="node">');
    lines.push('      <attribute id="0" title="entityType" type="string"/>');
    lines.push('      <attribute id="1" title="observations" type="string"/>');
    lines.push('    </attributes>');
    lines.push('    <nodes>');

    for (const entity of graph.entities) {
      const nodeId = escapeXml(entity.name);
      lines.push(`      <node id="${nodeId}" label="${nodeId}">`);
      lines.push('        <attvalues>');
      lines.push(`          <attvalue for="0" value="${escapeXml(entity.entityType)}"/>`);
      lines.push(`          <attvalue for="1" value="${escapeXml(entity.observations.join('; '))}"/>`);
      lines.push('        </attvalues>');
      lines.push('      </node>');
    }

    lines.push('    </nodes>');
    lines.push('    <edges>');

    let edgeId = 0;
    for (const relation of graph.relations) {
      const sourceId = escapeXml(relation.from);
      const targetId = escapeXml(relation.to);
      const label = escapeXml(relation.relationType);
      lines.push(`      <edge id="${edgeId}" source="${sourceId}" target="${targetId}" label="${label}"/>`);
      edgeId++;
    }

    lines.push('    </edges>');
    lines.push('  </graph>');
    lines.push('</gexf>');
    return lines.join('\n');
  }

  /**
   * Export as DOT format for GraphViz.
   */
  private exportAsDOT(graph: ReadonlyKnowledgeGraph): string {
    const lines: string[] = [];

    const escapeDot = (str: string): string => {
      return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
    };

    lines.push('digraph KnowledgeGraph {');
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=box, style=rounded];');
    lines.push('');

    for (const entity of graph.entities) {
      const nodeId = escapeDot(entity.name);
      const label = [`${entity.name}`, `Type: ${entity.entityType}`];
      if (entity.tags?.length) label.push(`Tags: ${entity.tags.join(', ')}`);
      const labelStr = escapeDot(label.join('\\n'));
      lines.push(`  ${nodeId} [label=${labelStr}];`);
    }

    lines.push('');

    for (const relation of graph.relations) {
      const fromId = escapeDot(relation.from);
      const toId = escapeDot(relation.to);
      const label = escapeDot(relation.relationType);
      lines.push(`  ${fromId} -> ${toId} [label=${label}];`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Export as Markdown documentation.
   */
  private exportAsMarkdown(graph: ReadonlyKnowledgeGraph): string {
    const lines: string[] = [];

    lines.push('# Knowledge Graph Export');
    lines.push('');
    lines.push(`**Exported:** ${new Date().toISOString()}`);
    lines.push(`**Entities:** ${graph.entities.length}`);
    lines.push(`**Relations:** ${graph.relations.length}`);
    lines.push('');
    lines.push('## Entities');
    lines.push('');

    for (const entity of graph.entities) {
      lines.push(`### ${entity.name}`);
      lines.push('');
      lines.push(`- **Type:** ${entity.entityType}`);
      if (entity.tags?.length) lines.push(`- **Tags:** ${entity.tags.map(t => `\`${t}\``).join(', ')}`);
      if (entity.importance !== undefined) lines.push(`- **Importance:** ${entity.importance}/10`);
      if (entity.observations.length > 0) {
        lines.push('');
        lines.push('**Observations:**');
        for (const obs of entity.observations) {
          lines.push(`- ${obs}`);
        }
      }
      lines.push('');
    }

    if (graph.relations.length > 0) {
      lines.push('## Relations');
      lines.push('');
      for (const relation of graph.relations) {
        lines.push(`- **${relation.from}** → *${relation.relationType}* → **${relation.to}**`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Export as Mermaid diagram.
   */
  private exportAsMermaid(graph: ReadonlyKnowledgeGraph): string {
    const lines: string[] = [];

    const sanitizeId = (str: string): string => str.replace(/[^a-zA-Z0-9_]/g, '_');
    const escapeLabel = (str: string): string => str.replace(/"/g, '#quot;');

    lines.push('graph LR');
    lines.push('  %% Knowledge Graph');
    lines.push('');

    const nodeIds = new Map<string, string>();
    for (const entity of graph.entities) {
      nodeIds.set(entity.name, sanitizeId(entity.name));
    }

    for (const entity of graph.entities) {
      const nodeId = nodeIds.get(entity.name)!;
      const labelParts: string[] = [entity.name, `Type: ${entity.entityType}`];
      if (entity.tags?.length) labelParts.push(`Tags: ${entity.tags.join(', ')}`);
      const label = escapeLabel(labelParts.join('<br/>'));
      lines.push(`  ${nodeId}["${label}"]`);
    }

    lines.push('');

    for (const relation of graph.relations) {
      const fromId = nodeIds.get(relation.from);
      const toId = nodeIds.get(relation.to);
      if (fromId && toId) {
        const label = escapeLabel(relation.relationType);
        lines.push(`  ${fromId} -->|"${label}"| ${toId}`);
      }
    }

    return lines.join('\n');
  }
}
