import { describe, expect, it } from 'vitest';
import Elk, { type ElkNode } from 'elkjs/lib/elk.bundled.js';

describe('ELK diagram compatibility', () => {
  it.each(['DOWN', 'RIGHT'])('lays out branches without overlaps in %s direction', async (direction) => {
    const graph = await new Elk().layout<ElkNode>({
      id: 'branch-and-join',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': direction,
        'elk.edgeRouting': 'SPLINES',
        'elk.spacing.nodeNode': '56',
        'elk.layered.spacing.nodeNodeBetweenLayers': '92',
        'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
      },
      children: ['start', 'left', 'right', 'end'].map((id) => ({ id, width: 240, height: 190 })),
      edges: [['start', 'left'], ['start', 'right'], ['left', 'end'], ['right', 'end']].map(([source, target]) => ({ id: `${source}-${target}`, sources: [source], targets: [target] })),
    });
    const nodes = graph.children!;
    expect(nodes).toHaveLength(4);
    for (const node of nodes) {
      expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true);
      for (const other of nodes.filter((candidate) => candidate.id !== node.id)) {
        expect(node.x! + node.width! <= other.x! || other.x! + other.width! <= node.x! || node.y! + node.height! <= other.y! || other.y! + other.height! <= node.y!).toBe(true);
      }
    }
    const axis = direction === 'DOWN' ? 'y' : 'x';
    for (const edge of graph.edges!) {
      expect(nodes.find((node) => node.id === edge.sources[0])![axis]).toBeLessThan(nodes.find((node) => node.id === edge.targets[0])![axis]!);
      expect(edge.sections?.length).toBeGreaterThan(0);
    }
  });
});
