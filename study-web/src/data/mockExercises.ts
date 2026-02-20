import type { Exercise } from '../types/exercise';

export const MOCK_SCRIPT_CONTENT = `
# Algorithmen und Datenstrukturen

## Kapitel 1: Graph-Algorithmen

### 1.1 Breadth-First Search (BFS)

Die Breitensuche (BFS) ist ein Algorithmus zum Durchlaufen oder Suchen von Graphen.
Der Algorithmus beginnt an einem Startknoten und erkundet alle Nachbarknoten auf der
aktuellen Tiefe, bevor er zu Knoten der nächsten Tiefenebene übergeht.

**Eigenschaften:**
- Verwendet eine **Queue** (Warteschlange) als Datenstruktur
- Findet den kürzesten Pfad in ungewichteten Graphen
- Zeitkomplexität: O(V + E), wobei V = Knoten, E = Kanten

\`\`\`javascript
function bfs(start, graph) {
    const visited = new Set();
    const queue = [start];

    while (queue.length > 0) {
        const node = queue.shift();
        if (visited.has(node)) continue;

        visited.add(node);
        console.log(node);

        for (const neighbor of graph[node]) {
            if (!visited.has(neighbor)) {
                queue.push(neighbor);
            }
        }
    }
}
\`\`\`

### 1.2 Depth-First Search (DFS)

Die Tiefensuche (DFS) ist ein weiterer grundlegender Graph-Algorithmus. Im Gegensatz
zu BFS geht DFS so tief wie möglich in einen Pfad, bevor es zurückkehrt.

**Eigenschaften:**
- Verwendet einen **Stack** (oder Rekursion)
- Nützlich für Topologische Sortierung, Zyklen-Erkennung
- Zeitkomplexität: O(V + E)
`;

export const MOCK_EXERCISES: Record<string, Exercise> = {
    'task-1': {
        id: 'task-1',
        title: 'Grundlagen der Graphen-Algorithmen',
        description:
            'In dieser Übung testen wir dein Verständnis von BFS und DFS.',
        scriptReference: {
            sectionId: 'ch-1',
            anchor: 'breadth-first-search-bfs',
        },
        questions: [
            {
                id: 'q1',
                type: 'single_choice',
                question:
                    'Welche Datenstruktur verwendet der BFS-Algorithmus?',
                options: [
                    {
                        id: 'a',
                        label: 'Stack (Stapel)',
                        explanation:
                            'Falsch. Ein Stack wird bei DFS verwendet, nicht bei BFS.',
                    },
                    {
                        id: 'b',
                        label: 'Queue (Warteschlange)',
                        explanation:
                            'Richtig! BFS verwendet eine Queue, um Knoten in der Reihenfolge zu besuchen, in der sie entdeckt wurden.',
                    },
                    {
                        id: 'c',
                        label: 'Heap',
                        explanation:
                            'Falsch. Ein Heap wird z.B. bei Dijkstra verwendet.',
                    },
                    {
                        id: 'd',
                        label: 'Binary Tree',
                        explanation:
                            'Falsch. Ein Binary Tree ist eine Datenstruktur, kein Hilfsmittel für BFS.',
                    },
                ],
                correctAnswer: 'b',
            },
            {
                id: 'q2',
                type: 'true_false',
                question:
                    'BFS findet garantiert den kürzesten Pfad in einem ungewichteten Graphen.',
                correctAnswer: true,
                explanation:
                    'BFS erkundet Knoten Ebene für Ebene, daher findet es immer den kürzesten Pfad (gemessen an der Anzahl der Kanten) in ungewichteten Graphen.',
            },
            {
                id: 'q3',
                type: 'multiple_choice',
                question:
                    'Welche der folgenden Aussagen über DFS sind korrekt? (Mehrfachauswahl)',
                options: [
                    {
                        id: 'a',
                        label: 'DFS kann mit Rekursion implementiert werden',
                        explanation: 'Richtig! DFS eignet sich sehr gut für rekursive Implementierung.',
                    },
                    {
                        id: 'b',
                        label: 'DFS findet immer den kürzesten Pfad',
                        explanation: 'Falsch. DFS findet nicht notwendigerweise den kürzesten Pfad.',
                    },
                    {
                        id: 'c',
                        label: 'DFS kann zur Zyklenerkennung verwendet werden',
                        explanation: 'Richtig! DFS ist sehr effektiv für Zyklenerkennung in Graphen.',
                    },
                    {
                        id: 'd',
                        label: 'DFS hat eine Zeitkomplexität von O(V + E)',
                        explanation: 'Richtig! Wie BFS hat DFS eine Zeitkomplexität von O(V + E).',
                    },
                ],
                correctAnswers: ['a', 'c', 'd'],
            },
            {
                id: 'q4',
                type: 'free_text',
                question:
                    'Erkläre in eigenen Worten, wann du BFS statt DFS verwenden würdest und warum.',
                placeholder: 'Schreibe deine Antwort hier...',
                minLength: 50,
                sampleAnswer:
                    'BFS sollte verwendet werden, wenn man den kürzesten Pfad in einem ungewichteten Graphen finden möchte, da BFS alle Knoten auf einer Ebene besucht, bevor es zur nächsten Ebene übergeht. DFS ist besser geeignet für Aufgaben wie topologische Sortierung oder wenn der Speicherplatz begrenzt ist (da DFS weniger Speicher benötigt als BFS für breite Graphen).',
            },
            {
                id: 'q5',
                type: 'code',
                question:
                    'Implementiere eine DFS-Funktion, die alle erreichbaren Knoten von einem Startknoten aus besucht.',
                language: 'javascript',
                starterCode: `function dfs(start, graph) {
    // Dein Code hier

}`,
                sampleSolution: `function dfs(start, graph, visited = new Set()) {
    if (visited.has(start)) return;

    visited.add(start);
    console.log(start);

    for (const neighbor of graph[start] || []) {
        dfs(neighbor, graph, visited);
    }

    return visited;
}`,
            },
        ],
        metadata: {
            difficulty: 'medium',
            tags: ['algorithmen', 'graphen', 'bfs', 'dfs'],
            estimatedMinutes: 15,
        },
    },
};

/**
 * Get exercise by task ID (mock implementation)
 */
export function getExerciseByTaskId(taskId: string): Exercise | null {
    return MOCK_EXERCISES[taskId] ?? null;
}

/**
 * Get default mock exercise for testing
 */
export function getDefaultMockExercise(): Exercise {
    return MOCK_EXERCISES['task-1'];
}
