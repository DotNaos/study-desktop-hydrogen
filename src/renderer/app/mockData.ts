export interface Task {
    id: string;
    title: string;
    description: string; // MDX content
    solution: string; // MDX content
    starterCode?: string;
}

export interface Chapter {
    id: string;
    title: string;
    scriptContent: string; // MDX content for the "Script Window"
    tasks: Task[];
}

export interface Course {
    id: string;
    title: string;
    description: string;
    chapters: Chapter[];
}

export const MOCK_COURSES: Course[] = [
    {
        id: 'alg-101',
        title: 'Advanced Algorithms',
        description: 'Master complex algorithms and data structures.',
        chapters: [
            {
                id: 'ch-1',
                title: 'Graph Theory Basics',
                scriptContent: `
# Graph Theory Basics

Graphs are mathematical structures used to model pairwise relations between objects. A graph in this context is made up of vertices (also called nodes or points) which are connected by edges (also called links or lines).

## Types of Graphs
- **Undirected Graph**: Edges have no orientation.
- **Directed Graph (Digraph)**: Edges have a direction.
- **Weighted Graph**: Edges have weights/costs associated with them.

## Representation
Graphs can be represented in memory using:
1. **Adjacency Matrix**: A 2D array where cell [i][j] represents an edge.
2. **Adjacency List**: An array of lists, where index i contains a list of nodes connected to node i.

## Breadth-First Search (BFS)
BFS is an algorithm for traversing or searching tree or graph data structures. It starts at the tree root (or some arbitrary node of a graph, sometimes referred to as a 'search key') and explores all of the neighbor nodes at the present depth prior to moving on to the nodes at the next depth level.

## Depth-First Search (DFS)
DFS is an algorithm for traversing or searching tree or graph data structures. The algorithm starts at the root node (selecting some arbitrary node as the root in the case of a graph) and explores as far as possible along each branch before backtracking.
        `,
                tasks: [
                    {
                        id: 'task-1',
                        title: 'Implement BFS',
                        description: `
# Task: Implement Breadth-First Search

Write a function \`bfs(startNode, graph)\` that traverses the graph using Breadth-First Search and prints each visited node.

**Input Format:**
- \`startNode\`: The ID of the starting node.
- \`graph\`: An adjacency list representation.

**Example:**
\`\`\`js
const graph = {
  A: ['B', 'C'],
  B: ['D', 'E'],
  C: ['F'],
  D: [],
  E: ['F'],
  F: []
};
bfs('A', graph);
\`\`\`
            `,
                        solution: `
\`\`\`javascript
function bfs(startNode, graph) {
  const queue = [startNode];
  const visited = new Set([startNode]);

  while (queue.length > 0) {
    const node = queue.shift();
    console.log(node);

    for (const neighbor of graph[node]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
}
\`\`\`
            `,
                    },
                    {
                        id: 'task-2',
                        title: 'Detect Cycle in Directed Graph',
                        description: `
# Task: Detect Cycle

Given a directed graph, write a function to return \`true\` if the graph contains a cycle, else \`false\`.

**Hint:** Use DFS and keep track of nodes currently in the recursion stack.
            `,
                        solution: `
\`\`\`javascript
function hasCycle(graph) {
// Solution implementation...
}
\`\`\`
            `,
                    },
                ],
            },
            {
                id: 'ch-2',
                title: 'Dynamic Programming',
                scriptContent:
                    '# Dynamic Programming\n\nDP is an algorithmic technique...',
                tasks: [],
            },
        ],
    },
    {
        id: 'react-202',
        title: 'React Internals',
        description: 'Deep dive into React Fiber and Reconciliation.',
        chapters: [],
    },
];
